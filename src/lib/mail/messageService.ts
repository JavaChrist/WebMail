import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  orderBy,
  writeBatch,
  getCountFromServer,
  limit as fbLimit,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type { MailMessage, MailAddress, MailAttachment } from "@/types/mail";

function parseAddressesString(value?: string): MailAddress[] {
  if (!value) return [];
  return value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((email) => ({ email }));
}

const COLLECTION = "mailMessages";

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number")
    return new Date(value);
  return new Date();
}

function normalizeAddress(value: unknown): MailAddress {
  if (!value) return { email: "" };
  if (typeof value === "string") return { email: value };
  const obj = value as Record<string, unknown>;
  return { email: (obj.email as string) ?? "", name: obj.name as string | undefined };
}

function normalizeAddressList(value: unknown): MailAddress[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(normalizeAddress);
  return [normalizeAddress(value)];
}

function mapMessage(id: string, data: Record<string, unknown>): MailMessage {
  return {
    id,
    userId: data.userId as string,
    accountId: data.accountId as string,
    folderIds: (data.folderIds as string[]) ?? [],
    primaryFolderId: data.primaryFolderId as string,
    messageId: (data.messageId as string) ?? "",
    imapUid: data.imapUid as number | undefined,
    from: normalizeAddress(data.from),
    to: normalizeAddressList(data.to),
    cc: data.cc ? normalizeAddressList(data.cc) : undefined,
    bcc: data.bcc ? normalizeAddressList(data.bcc) : undefined,
    subject: (data.subject as string) ?? "",
    snippet: data.snippet as string | undefined,
    contentHtml: data.contentHtml as string | undefined,
    contentText: data.contentText as string | undefined,
    timestamp: toDate(data.timestamp),
    read: Boolean(data.read),
    starred: Boolean(data.starred),
    hasAttachments: Boolean(data.hasAttachments),
    attachments: data.attachments as MailMessage["attachments"],
    flags: data.flags as string[] | undefined,
    isDraft: Boolean(data.isDraft),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export async function listMessagesByFolder(
  accountId: string,
  folderId: string
): Promise<MailMessage[]> {
  const q = query(
    collection(db, COLLECTION),
    where("accountId", "==", accountId),
    where("primaryFolderId", "==", folderId),
    orderBy("timestamp", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapMessage(d.id, d.data()));
}

/**
 * Récupère un ensemble de messages de l'utilisateur (tous comptes/dossiers)
 * pour la recherche globale. Firestore ne gère pas le full-text : on rapatrie
 * un lot borné (par défaut 500) puis on filtre `contains` côté client.
 *
 * Pas de `orderBy` ici pour éviter d'imposer un index composite
 * (userId + timestamp) : le tri par date est fait côté client.
 */
export async function searchMessagesByUser(
  userId: string,
  max = 500
): Promise<MailMessage[]> {
  const q = query(
    collection(db, COLLECTION),
    where("userId", "==", userId),
    fbLimit(max)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => mapMessage(d.id, d.data()))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export async function listStarredMessages(
  accountId: string
): Promise<MailMessage[]> {
  const q = query(
    collection(db, COLLECTION),
    where("accountId", "==", accountId),
    where("starred", "==", true)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => mapMessage(d.id, d.data()))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export async function getMessage(
  messageId: string
): Promise<MailMessage | null> {
  const snap = await getDoc(doc(db, COLLECTION, messageId));
  if (!snap.exists()) return null;
  return mapMessage(snap.id, snap.data());
}

export async function getUnreadCountByAccount(
  accountId: string
): Promise<number> {
  const q = query(
    collection(db, COLLECTION),
    where("accountId", "==", accountId),
    where("read", "==", false)
  );
  const snap = await getDocs(q);
  return snap.size;
}

export async function getUnreadCountsByFolder(
  accountId: string
): Promise<Record<string, number>> {
  const q = query(
    collection(db, COLLECTION),
    where("accountId", "==", accountId),
    where("read", "==", false)
  );
  const snap = await getDocs(q);
  const counts: Record<string, number> = {};
  snap.docs.forEach((d) => {
    const primary = d.data().primaryFolderId as string;
    if (primary) counts[primary] = (counts[primary] ?? 0) + 1;
  });
  return counts;
}

export async function getUnreadCountByUser(userId: string): Promise<number> {
  const q = query(
    collection(db, COLLECTION),
    where("userId", "==", userId),
    where("read", "==", false)
  );
  const snap = await getDocs(q);
  return snap.size;
}

export async function markRead(
  messageId: string,
  read: boolean
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, messageId), {
    read,
    updatedAt: Timestamp.now(),
  });
}

export async function toggleStar(
  messageId: string,
  starred: boolean
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, messageId), {
    starred,
    updatedAt: Timestamp.now(),
  });
}

export async function moveMessage(
  messageId: string,
  targetFolderId: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, messageId), {
    primaryFolderId: targetFolderId,
    folderIds: [targetFolderId],
    updatedAt: Timestamp.now(),
  });
}

export async function deleteMessagePermanently(
  messageId: string
): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, messageId));
}

export interface SaveDraftInput {
  id?: string;
  userId: string;
  accountId: string;
  draftsFolderId: string;
  from: MailAddress;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  contentHtml?: string;
  attachments?: MailAttachment[];
}

/**
 * Crée ou met à jour un brouillon (`isDraft: true`) dans le dossier Brouillons
 * du compte (scoping strict par accountId/userId). Renvoie l'id du document.
 */
export async function saveDraft(input: SaveDraftInput): Promise<string> {
  const now = Timestamp.now();
  const html = input.contentHtml ?? "";
  const attachments = input.attachments ?? [];
  const payload = {
    userId: input.userId,
    accountId: input.accountId,
    folderIds: [input.draftsFolderId],
    primaryFolderId: input.draftsFolderId,
    from: input.from,
    to: parseAddressesString(input.to),
    cc: parseAddressesString(input.cc),
    bcc: parseAddressesString(input.bcc),
    subject: input.subject || "(sans objet)",
    snippet: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160),
    contentHtml: html,
    contentText: "",
    timestamp: now,
    read: true,
    starred: false,
    isDraft: true,
    hasAttachments: attachments.length > 0,
    attachments,
    flags: [],
    updatedAt: now,
  };

  if (input.id) {
    await updateDoc(doc(db, COLLECTION, input.id), payload);
    return input.id;
  }
  const ref = await addDoc(collection(db, COLLECTION), {
    ...payload,
    messageId: `draft_${Date.now()}@webmail`,
    imapUid: null,
    createdAt: now,
  });
  return ref.id;
}

/** Compte les messages d'un dossier (scopé par compte). */
export async function countMessagesInFolder(
  accountId: string,
  folderId: string
): Promise<number> {
  const q = query(
    collection(db, COLLECTION),
    where("accountId", "==", accountId),
    where("primaryFolderId", "==", folderId)
  );
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

/**
 * Supprime DÉFINITIVEMENT tous les messages d'un dossier (scopé par compte),
 * par lots de 400 pour rester sous les limites Firestore. Renvoie le nombre
 * de messages supprimés.
 */
export async function emptyFolder(
  accountId: string,
  folderId: string
): Promise<number> {
  const q = query(
    collection(db, COLLECTION),
    where("accountId", "==", accountId),
    where("primaryFolderId", "==", folderId)
  );
  const snap = await getDocs(q);
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const slice = docs.slice(i, i + 400);
    const batch = writeBatch(db);
    slice.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return docs.length;
}
