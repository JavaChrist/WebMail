import Imap from "imap";
import { simpleParser, AddressObject } from "mailparser";
import { adminDb } from "@/config/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { FolderType, MailAddress, MailAttachment } from "@/types/mail";
import {
  FOLDER_LABELS,
  FOLDER_ORDER,
  SYSTEM_FOLDER_TYPES,
  resolveFolderTypeFromImap,
} from "./constants";
import { decryptPassword } from "./crypto";

const ACCOUNTS = "mailAccounts";
const FOLDERS = "mailFolders";
const MESSAGES = "mailMessages";

/** Nombre maximum de messages récupérés par dossier et par passe de synchro. */
const PER_FOLDER_LIMIT = 60;
/** Nombre maximum de dossiers traités par passe (tient dans la fenêtre serverless). */
const MAX_FOLDERS_PER_SYNC = 8;
/** Timeout global de la passe de synchro (< maxDuration Vercel de 60 s). */
const SYNC_TIMEOUT_MS = 50000;

/**
 * Firestore limite chaque champ (et document) à ~1 Mio. On borne le contenu
 * HTML/texte sous cette limite (avec marge) pour éviter les erreurs
 * INVALID_ARGUMENT lors de la sauvegarde d'e-mails volumineux (images base64…).
 */
const HTML_MAX_BYTES = 700_000;
const TEXT_MAX_BYTES = 120_000;

/**
 * Bornes de commit Firestore : la limite de payload d'une requête batch est
 * ~10 Mio (11 534 336 octets). On reste largement en dessous (≈8 Mo) et on
 * borne aussi le nombre de documents, en committant dès que l'une des deux
 * limites est atteinte.
 */
const MAX_BATCH_BYTES = 8_000_000;
const MAX_DOCS_PER_BATCH = 50;

function clampToBytes(
  value: string | undefined | null,
  maxBytes: number
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  let slice = value;
  while (Buffer.byteLength(slice, "utf8") > maxBytes && slice.length > 0) {
    slice = slice.slice(0, Math.floor(slice.length * 0.9));
  }
  return `${slice}\n\n[… message tronqué — trop volumineux pour l'aperçu]`;
}

/** Estimation (octets) de la taille d'un document message pour le découpage des batches. */
function estimateDocBytes(doc: Record<string, unknown>): number {
  const html = (doc.contentHtml as string) || "";
  const text = (doc.contentText as string) || "";
  const meta =
    ((doc.subject as string) || "") +
    ((doc.snippet as string) || "") +
    JSON.stringify(doc.from ?? {}) +
    JSON.stringify(doc.to ?? []) +
    JSON.stringify(doc.cc ?? []) +
    JSON.stringify(doc.attachments ?? []);
  return (
    Buffer.byteLength(html, "utf8") +
    Buffer.byteLength(text, "utf8") +
    Buffer.byteLength(meta, "utf8") +
    2000
  );
}

interface AccountData {
  email: string;
  password: string;
  imapServer: string;
  imapPort: number;
  imapSecure?: boolean;
  userId: string;
}

interface MailboxInfo {
  path: string;
  name: string;
  attribs: string[];
  selectable: boolean;
  folderType: FolderType;
}

interface FolderRecord {
  id: string;
  folderType: FolderType;
  imapPath: string;
  lastSeenUid: number;
  uidValidity: number;
}

interface ExistingFolder {
  id: string;
  folderType?: FolderType;
  systemFolder?: boolean;
  imapPath?: string;
  lastSeenUid?: number;
  uidValidity?: number;
}

interface ParsedMessage {
  messageId: string;
  imapUid: number;
  from: MailAddress;
  to: MailAddress[];
  cc: MailAddress[];
  subject: string;
  snippet: string;
  contentHtml: string;
  contentText: string;
  timestamp: Date;
  hasAttachments: boolean;
  attachments: MailAttachment[];
  read: boolean;
  starred: boolean;
}

function addressToList(
  value: AddressObject | AddressObject[] | undefined
): MailAddress[] {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  const out: MailAddress[] = [];
  arr.forEach((a) => {
    a.value.forEach((v) => {
      if (v.address) {
        const addr: MailAddress = { email: v.address };
        if (v.name) addr.name = v.name;
        out.push(addr);
      }
    });
  });
  return out;
}

function createImap(account: AccountData, password: string): Imap {
  return new Imap({
    user: account.email,
    password,
    host: account.imapServer || "imap.ionos.com",
    port: account.imapPort || 993,
    tls: account.imapSecure !== false,
    tlsOptions: {
      rejectUnauthorized: false,
      servername: account.imapServer,
      minVersion: "TLSv1.2",
    },
    // Échouer vite et proprement plutôt que de « pendre » jusqu'au kill Vercel.
    connTimeout: 15000,
    authTimeout: 15000,
  });
}

/** Heuristique : déduit le folderType d'une boîte IMAP via ses attributs SPECIAL-USE puis son nom. */
function resolveType(name: string, attribs: string[]): FolderType {
  const upper = attribs.map((a) => a.toUpperCase());
  if (name.toUpperCase() === "INBOX") return "inbox";
  if (upper.includes("\\SENT")) return "sent";
  if (upper.includes("\\DRAFTS")) return "drafts";
  if (upper.includes("\\JUNK")) return "spam";
  if (upper.includes("\\TRASH")) return "trash";
  if (upper.includes("\\ARCHIVE")) return "archive";
  const byName = resolveFolderTypeFromImap(name);
  if (byName) return byName;
  return "custom";
}

function flattenBoxes(
  boxes: Imap.MailBoxes,
  prefix: string,
  parentDelimiter: string
): MailboxInfo[] {
  const out: MailboxInfo[] = [];
  for (const name of Object.keys(boxes)) {
    const box = boxes[name];
    const delim = box.delimiter || parentDelimiter || "/";
    const path = prefix ? `${prefix}${delim}${name}` : name;
    const attribs = box.attribs || [];
    const selectable = !attribs
      .map((a) => a.toUpperCase())
      .includes("\\NOSELECT");
    out.push({
      path,
      name,
      attribs,
      selectable,
      folderType: resolveType(name, attribs),
    });
    if (box.children) {
      out.push(...flattenBoxes(box.children, path, delim));
    }
  }
  return out;
}

function getBoxesP(imap: Imap): Promise<Imap.MailBoxes> {
  return new Promise((resolve, reject) => {
    imap.getBoxes((err, boxes) => (err ? reject(err) : resolve(boxes)));
  });
}

function openBoxP(
  imap: Imap,
  path: string,
  readOnly = true
): Promise<Imap.Box | null> {
  return new Promise((resolve) => {
    imap.openBox(path, readOnly, (err, box) => resolve(err ? null : box));
  });
}

function searchP(imap: Imap, criteria: unknown[]): Promise<number[]> {
  return new Promise((resolve) => {
    imap.search(criteria as never[], (err, uids) =>
      resolve(err || !uids ? [] : uids)
    );
  });
}

function fetchByUids(imap: Imap, uids: number[]): Promise<ParsedMessage[]> {
  return new Promise((resolve) => {
    if (uids.length === 0) {
      resolve([]);
      return;
    }
    const messages: ParsedMessage[] = [];
    let expected = 0;
    let parsed = 0;
    let ended = false;

    const maybeResolve = () => {
      if (ended && parsed >= expected) resolve(messages);
    };

    const f = imap.fetch(uids, { bodies: "", struct: true, markSeen: false });
    f.on("message", (msg) => {
      expected++;
      let buffer = "";
      let uid = 0;
      let flags: string[] = [];
      msg.on("body", (stream) => {
        stream.on("data", (chunk) => {
          buffer += chunk.toString("utf8");
        });
      });
      msg.once("attributes", (attrs) => {
        uid = attrs.uid;
        flags = attrs.flags || [];
      });
      msg.once("end", async () => {
        try {
          const p = await simpleParser(buffer);
          const text = p.text || "";
          const upperFlags = flags.map((fl) => fl.toUpperCase());
          messages.push({
            messageId: p.messageId || `uid_${uid}@imap`,
            imapUid: uid,
            from: addressToList(p.from)[0] ?? { email: "" },
            to: addressToList(p.to),
            cc: addressToList(p.cc),
            subject: p.subject || "",
            snippet: text.replace(/\s+/g, " ").trim().slice(0, 160),
            contentHtml: p.html || p.textAsHtml || "",
            contentText: text,
            timestamp: p.date || new Date(),
            hasAttachments: (p.attachments?.length ?? 0) > 0,
            attachments: (p.attachments || []).map((a, i) => {
              const att: MailAttachment = {
                filename: a.filename || "piece-jointe",
                index: i,
              };
              if (a.contentType) att.contentType = a.contentType;
              if (typeof a.size === "number") att.size = a.size;
              return att;
            }),
            read: upperFlags.includes("\\SEEN"),
            starred: upperFlags.includes("\\FLAGGED"),
          });
        } catch {
          // erreurs de parsing ignorées par message
        } finally {
          parsed++;
          maybeResolve();
        }
      });
    });
    f.once("error", () => {
      ended = true;
      maybeResolve();
    });
    f.once("end", () => {
      ended = true;
      maybeResolve();
    });
  });
}

/**
 * Réconcilie les boîtes IMAP réelles avec les documents mailFolders :
 * - garantit les 6 dossiers système,
 * - associe chaque boîte système à son folderType (avec imapPath),
 * - crée les dossiers `custom` pour les boîtes non reconnues.
 * Retourne une map imapPath -> FolderRecord pour les boîtes synchronisables.
 */
async function reconcileFolders(
  userId: string,
  accountId: string,
  mailboxes: MailboxInfo[]
): Promise<Map<string, FolderRecord>> {
  const snap = await adminDb
    .collection(FOLDERS)
    .where("accountId", "==", accountId)
    .get();
  const existing: ExistingFolder[] = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ExistingFolder, "id">),
  }));

  const now = Timestamp.now();
  const batch = adminDb.batch();
  let hasWrites = false;

  const byType = new Map<string, string>();
  const byPath = new Map<string, ExistingFolder>();
  existing.forEach((f) => {
    if (f.folderType && f.folderType !== "custom" && !byType.has(f.folderType)) {
      byType.set(f.folderType, f.id);
    }
    if (f.imapPath) byPath.set(f.imapPath, f);
  });

  for (const type of SYSTEM_FOLDER_TYPES) {
    if (byType.has(type)) continue;
    const ref = adminDb.collection(FOLDERS).doc();
    batch.set(ref, {
      userId,
      accountId,
      parentFolderId: null,
      name: FOLDER_LABELS[type],
      folderType: type,
      systemFolder: true,
      sortOrder: FOLDER_ORDER[type],
      imapPath: "",
      unreadCount: 0,
      lastSeenUid: 0,
      uidValidity: 0,
      createdAt: now,
      updatedAt: now,
    });
    const created: ExistingFolder = {
      id: ref.id,
      folderType: type,
      systemFolder: true,
      imapPath: "",
      lastSeenUid: 0,
      uidValidity: 0,
    };
    existing.push(created);
    byType.set(type, ref.id);
    hasWrites = true;
  }

  const result = new Map<string, FolderRecord>();
  const usedSystemTypes = new Set<string>();

  for (const mb of mailboxes) {
    if (!mb.selectable) continue;
    let folderDoc: ExistingFolder | undefined;

    if (mb.folderType !== "custom") {
      // une seule boîte synchronisée par type système (évite les doublons Sent/Sent Items)
      if (usedSystemTypes.has(mb.folderType)) continue;
      usedSystemTypes.add(mb.folderType);
      const id = byType.get(mb.folderType);
      folderDoc = existing.find((f) => f.id === id);
      if (folderDoc && folderDoc.imapPath !== mb.path) {
        batch.update(adminDb.collection(FOLDERS).doc(folderDoc.id), {
          imapPath: mb.path,
          updatedAt: now,
        });
        folderDoc.imapPath = mb.path;
        hasWrites = true;
      }
    } else {
      folderDoc = byPath.get(mb.path);
      if (!folderDoc) {
        const ref = adminDb.collection(FOLDERS).doc();
        const data = {
          userId,
          accountId,
          parentFolderId: null,
          name: mb.name,
          folderType: "custom" as FolderType,
          systemFolder: false,
          sortOrder: FOLDER_ORDER.custom,
          imapPath: mb.path,
          unreadCount: 0,
          lastSeenUid: 0,
          uidValidity: 0,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(ref, data);
        folderDoc = {
          id: ref.id,
          folderType: "custom",
          systemFolder: false,
          imapPath: mb.path,
          lastSeenUid: 0,
          uidValidity: 0,
        };
        byPath.set(mb.path, folderDoc);
        hasWrites = true;
      }
    }

    if (folderDoc) {
      result.set(mb.path, {
        id: folderDoc.id,
        folderType: mb.folderType,
        imapPath: mb.path,
        lastSeenUid: Number(folderDoc.lastSeenUid) || 0,
        uidValidity: Number(folderDoc.uidValidity) || 0,
      });
    }
  }

  if (hasWrites) await batch.commit();
  return result;
}

export async function syncAccount(
  accountId: string
): Promise<{ synced: number; total: number; folders: number }> {
  const accountSnap = await adminDb.collection(ACCOUNTS).doc(accountId).get();
  if (!accountSnap.exists) throw new Error("Compte introuvable");
  const account = accountSnap.data() as AccountData;
  if (!account.email || !account.password) {
    throw new Error("Configuration du compte incomplète");
  }

  const userId = account.userId;
  const password = decryptPassword(account.password);
  const imap = createImap(account, password);

  return new Promise((resolve, reject) => {
    const globalTimeout = setTimeout(() => {
      try {
        imap.end();
      } catch {
        /* noop */
      }
      reject(new Error("Délai de synchronisation IMAP dépassé"));
    }, SYNC_TIMEOUT_MS);

    imap.once("ready", async () => {
      try {
        const boxes = await getBoxesP(imap);
        const mailboxes = flattenBoxes(boxes, "", imap.delimiter || "/");
        const recs = await reconcileFolders(userId, accountId, mailboxes);

        const existingSnap = await adminDb
          .collection(MESSAGES)
          .where("accountId", "==", accountId)
          .get();
        const existingIds = new Set(
          existingSnap.docs.map((d) => d.data().messageId as string)
        );

        let syncedCount = 0;
        let totalSeen = 0;
        const now = Timestamp.now();

        // Priorité INBOX puis dossiers système, et bornage du nombre de dossiers
        // par passe pour tenir dans la fenêtre serverless. La sync incrémentale
        // (par UID) reprendra les dossiers restants au prochain appel.
        const priority = (ft: FolderType) =>
          ft === "inbox" ? 0 : ft !== "custom" ? 1 : 2;
        const orderedRecs = Array.from(recs.entries())
          .sort((a, b) => priority(a[1].folderType) - priority(b[1].folderType))
          .slice(0, MAX_FOLDERS_PER_SYNC);

        for (const [path, rec] of orderedRecs) {
          // eslint-disable-next-line no-await-in-loop
          const box = await openBoxP(imap, path, true);
          if (!box) continue;

          let lastUid = rec.lastSeenUid;
          if (box.uidvalidity !== rec.uidValidity) lastUid = 0;

          // eslint-disable-next-line no-await-in-loop
          const found =
            lastUid > 0
              ? await searchP(imap, [["UID", `${lastUid + 1}:*`]])
              : await searchP(imap, ["ALL"]);

          const candidates = found
            .filter((u) => u > lastUid)
            .sort((a, b) => a - b);
          const slice = candidates.slice(-PER_FOLDER_LIMIT);
          totalSeen += slice.length;

          // eslint-disable-next-line no-await-in-loop
          const parsed = await fetchByUids(imap, slice);
          const maxUid = slice.length ? Math.max(...slice) : lastUid;

          const fresh = parsed.filter((m) => !existingIds.has(m.messageId));

          // Découpage des batches borné en TAILLE (~8 Mo) et en nombre (50),
          // pour ne jamais dépasser la limite de payload Firestore (~10 Mio).
          let batch = adminDb.batch();
          let batchCount = 0;
          let batchBytes = 0;
          const flushBatch = async () => {
            if (batchCount === 0) return;
            await batch.commit();
            batch = adminDb.batch();
            batchCount = 0;
            batchBytes = 0;
          };

          for (const m of fresh) {
            existingIds.add(m.messageId);
            const docData = {
              userId,
              accountId,
              folderIds: [rec.id],
              primaryFolderId: rec.id,
              messageId: m.messageId,
              imapUid: m.imapUid,
              from: m.from,
              to: m.to,
              cc: m.cc,
              subject: m.subject,
              snippet: m.snippet,
              contentHtml: clampToBytes(m.contentHtml, HTML_MAX_BYTES),
              contentText: clampToBytes(m.contentText, TEXT_MAX_BYTES),
              timestamp: Timestamp.fromDate(m.timestamp),
              read: rec.folderType === "sent" ? true : m.read,
              starred: m.starred,
              hasAttachments: m.hasAttachments,
              attachments: m.attachments,
              flags: [],
              createdAt: now,
              updatedAt: now,
            };
            const estimated = estimateDocBytes(docData);

            if (
              batchCount > 0 &&
              (batchCount >= MAX_DOCS_PER_BATCH ||
                batchBytes + estimated > MAX_BATCH_BYTES)
            ) {
              // eslint-disable-next-line no-await-in-loop
              await flushBatch();
            }

            batch.set(adminDb.collection(MESSAGES).doc(), docData);
            batchCount++;
            batchBytes += estimated;
            syncedCount++;
          }
          await flushBatch();

          if (
            maxUid !== rec.lastSeenUid ||
            box.uidvalidity !== rec.uidValidity
          ) {
            // eslint-disable-next-line no-await-in-loop
            await adminDb.collection(FOLDERS).doc(rec.id).update({
              lastSeenUid: maxUid,
              uidValidity: box.uidvalidity,
              updatedAt: now,
            });
          }
        }

        await adminDb
          .collection(ACCOUNTS)
          .doc(accountId)
          .update({ lastSyncAt: now });

        clearTimeout(globalTimeout);
        imap.end();
        resolve({ synced: syncedCount, total: totalSeen, folders: recs.size });
      } catch (e) {
        clearTimeout(globalTimeout);
        try {
          imap.end();
        } catch {
          /* noop */
        }
        reject(e);
      }
    });

    imap.once("error", (err: Error) => {
      clearTimeout(globalTimeout);
      reject(new Error(`Erreur de connexion IMAP: ${err.message}`));
    });

    imap.connect();
  });
}
