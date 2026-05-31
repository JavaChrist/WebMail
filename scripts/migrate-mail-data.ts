/**
 * Script de migration des anciennes collections (emailAccounts, emails,
 * customFolders) vers le nouveau schéma (mailAccounts, mailFolders,
 * mailMessages).
 *
 * Les anciennes collections ne sont PAS supprimées (période de grâce).
 * Le script est idempotent : il ignore les documents déjà migrés.
 *
 * Lancement :
 *   npx tsx scripts/migrate-mail-data.ts            (migration réelle)
 *   npx tsx scripts/migrate-mail-data.ts --dry-run  (simulation)
 *
 * Prérequis : le fichier de service account Firebase Admin à la racine
 * (webmail-b926e-firebase-adminsdk-*.json) ou les variables
 * d'environnement FIREBASE_ADMIN_*.
 */

import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

const DRY_RUN = process.argv.includes("--dry-run");

type FolderType =
  | "inbox"
  | "drafts"
  | "sent"
  | "archive"
  | "spam"
  | "trash"
  | "custom";

const SYSTEM_FOLDER_TYPES: Exclude<FolderType, "custom">[] = [
  "inbox",
  "drafts",
  "sent",
  "archive",
  "spam",
  "trash",
];

const FOLDER_LABELS: Record<FolderType, string> = {
  inbox: "Boîte de réception",
  drafts: "Brouillons",
  sent: "Envoyés",
  archive: "Archive",
  spam: "Spam",
  trash: "Corbeille",
  custom: "Dossier",
};

const FOLDER_ORDER: Record<FolderType, number> = {
  inbox: 0,
  drafts: 1,
  sent: 2,
  archive: 3,
  spam: 4,
  trash: 5,
  custom: 100,
};

function initAdmin(): App {
  if (getApps().length) return getApps()[0];

  const root = process.cwd();
  const candidate = fs
    .readdirSync(root)
    .find((f) => /firebase-adminsdk.*\.json$/.test(f));

  if (candidate) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(path.join(root, candidate), "utf8")
    );
    return initializeApp({ credential: cert(serviceAccount) });
  }

  if (
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ) {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  }

  throw new Error(
    "Impossible d'initialiser Firebase Admin : aucun service account trouvé."
  );
}

function normalizeOldFolder(folder: string | undefined): {
  type: Exclude<FolderType, "custom"> | null;
  customId: string | null;
} {
  if (!folder) return { type: "inbox", customId: null };
  if (folder.startsWith("folder_")) {
    return { type: null, customId: folder.replace("folder_", "") };
  }
  const f = folder.toLowerCase();
  if (SYSTEM_FOLDER_TYPES.includes(f as Exclude<FolderType, "custom">)) {
    return { type: f as Exclude<FolderType, "custom">, customId: null };
  }
  return { type: "inbox", customId: null };
}

function parseAddress(value: string | undefined): { email: string; name?: string } {
  if (!value) return { email: "" };
  const match = value.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].trim() || undefined, email: match[2].trim() };
  }
  return { email: value.trim() };
}

async function migrateAccounts(db: Firestore) {
  console.log("→ Migration des comptes (emailAccounts → mailAccounts)");
  const snap = await db.collection("emailAccounts").get();
  let migrated = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const targetRef = db.collection("mailAccounts").doc(docSnap.id);
    const existing = await targetRef.get();
    if (existing.exists) continue;

    const now = Timestamp.now();
    const payload = {
      userId: data.userId,
      email: data.email,
      displayName: data.name || data.email,
      signature: "",
      password: data.password || "",
      imapServer: data.imapServer || "",
      imapPort: data.imapPort || 993,
      imapSecure: data.useTLS !== undefined ? Boolean(data.useTLS) : true,
      smtpServer: data.smtpServer || "",
      smtpPort: data.smtpPort || 587,
      smtpSecure: Boolean(data.useSSL),
      color: "#2563eb",
      icon: "",
      isActive: Boolean(data.isActive),
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
      lastSyncAt: null,
    };

    if (DRY_RUN) {
      console.log(`  [dry-run] compte ${data.email} (${docSnap.id})`);
    } else {
      await targetRef.set(payload);
    }
    migrated++;
  }
  console.log(`  ${migrated} compte(s) migré(s).`);
}

async function ensureSystemFolders(
  db: Firestore,
  userId: string,
  accountId: string
): Promise<Record<string, string>> {
  const snap = await db
    .collection("mailFolders")
    .where("accountId", "==", accountId)
    .get();
  const map: Record<string, string> = {};
  snap.docs.forEach((d) => {
    const type = d.data().folderType as string;
    if (type && type !== "custom") map[type] = d.id;
  });

  const now = Timestamp.now();
  for (const type of SYSTEM_FOLDER_TYPES) {
    if (map[type]) continue;
    const ref = db.collection("mailFolders").doc();
    const payload = {
      userId,
      accountId,
      parentFolderId: null,
      name: FOLDER_LABELS[type],
      folderType: type,
      systemFolder: true,
      sortOrder: FOLDER_ORDER[type],
      imapPath: "",
      unreadCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    if (!DRY_RUN) await ref.set(payload);
    map[type] = ref.id;
  }
  return map;
}

async function migrateCustomFolders(
  db: Firestore,
  userId: string,
  accountId: string
): Promise<Record<string, string>> {
  const snap = await db
    .collection("customFolders")
    .where("userId", "==", userId)
    .get();
  const map: Record<string, string> = {};
  const now = Timestamp.now();

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    // Idempotence : retrouver un dossier déjà migré via imapPath marqueur
    const existing = await db
      .collection("mailFolders")
      .where("accountId", "==", accountId)
      .where("imapPath", "==", `legacy:${docSnap.id}`)
      .limit(1)
      .get();
    if (!existing.empty) {
      map[docSnap.id] = existing.docs[0].id;
      continue;
    }

    const ref = db.collection("mailFolders").doc();
    const payload = {
      userId,
      accountId,
      parentFolderId: null,
      name: data.name || "Dossier",
      folderType: "custom",
      systemFolder: false,
      sortOrder: FOLDER_ORDER.custom,
      imapPath: `legacy:${docSnap.id}`,
      unreadCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    if (!DRY_RUN) await ref.set(payload);
    map[docSnap.id] = ref.id;
  }
  return map;
}

async function migrateMessages(db: Firestore) {
  console.log("→ Migration des messages (emails → mailMessages)");
  const accountsSnap = await db.collection("mailAccounts").get();

  // Compte principal par utilisateur (actif sinon premier)
  const accountByUser = new Map<string, string>();
  accountsSnap.docs.forEach((d) => {
    const userId = d.data().userId as string;
    const isActive = Boolean(d.data().isActive);
    if (!accountByUser.has(userId) || isActive) {
      accountByUser.set(userId, d.id);
    }
  });

  let migrated = 0;
  let skipped = 0;

  const userAccountPairs = Array.from(accountByUser.entries());
  for (const [userId, accountId] of userAccountPairs) {
    const systemFolders = await ensureSystemFolders(db, userId, accountId);
    const customFolders = await migrateCustomFolders(db, userId, accountId);

    const emailsSnap = await db
      .collection("emails")
      .where("userId", "==", userId)
      .get();

    // Index des messageId déjà présents pour ce compte
    const existingSnap = await db
      .collection("mailMessages")
      .where("accountId", "==", accountId)
      .get();
    const existingIds = new Set(
      existingSnap.docs.map((d) => d.data().messageId as string)
    );

    for (const docSnap of emailsSnap.docs) {
      const data = docSnap.data();
      const messageId = (data.messageId as string) || `legacy_${docSnap.id}`;
      if (existingIds.has(messageId)) {
        skipped++;
        continue;
      }

      const { type, customId } = normalizeOldFolder(data.folder);
      let folderId: string | undefined;
      if (customId) folderId = customFolders[customId];
      if (!folderId && type) folderId = systemFolders[type];
      if (!folderId) folderId = systemFolders.inbox;

      const ts = data.timestamp;
      const timestamp =
        ts && typeof ts.toDate === "function"
          ? ts
          : Timestamp.fromDate(new Date(ts || Date.now()));
      const now = Timestamp.now();

      const payload = {
        userId,
        accountId,
        folderIds: [folderId],
        primaryFolderId: folderId,
        messageId,
        imapUid: null,
        from: parseAddress(data.from),
        to: data.to ? [parseAddress(data.to)] : [],
        cc: [],
        bcc: [],
        subject: data.subject || "",
        snippet: (data.content || "")
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 160),
        contentHtml: data.content || "",
        contentText: "",
        timestamp,
        read: Boolean(data.read),
        starred: Boolean(data.starred),
        hasAttachments: Array.isArray(data.attachments)
          ? data.attachments.length > 0
          : false,
        attachments: data.attachments || [],
        flags: [],
        createdAt: now,
        updatedAt: now,
      };

      if (DRY_RUN) {
        console.log(`  [dry-run] message "${payload.subject}" → ${folderId}`);
      } else {
        await db.collection("mailMessages").add(payload);
      }
      migrated++;
    }
  }

  console.log(`  ${migrated} message(s) migré(s), ${skipped} ignoré(s).`);
}

async function main() {
  console.log(
    `=== Migration WebMail ${DRY_RUN ? "(DRY RUN)" : "(RÉELLE)"} ===`
  );
  const app = initAdmin();
  const db = getFirestore(app);

  await migrateAccounts(db);
  await migrateMessages(db);

  console.log("=== Migration terminée ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Échec de la migration:", err);
  process.exit(1);
});
