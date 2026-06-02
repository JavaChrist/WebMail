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
  writeBatch,
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type {
  MailAccount,
  CreateMailAccountInput,
  UpdateMailAccountInput,
  SignatureData,
} from "@/types/mail";
import { DEFAULT_ACCOUNT_COLOR } from "./constants";
import { encryptPassword } from "./crypto";
import { createDefaultFolders } from "./folderService";

const COLLECTION = "mailAccounts";

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number")
    return new Date(value);
  return new Date();
}

function mapAccount(id: string, data: Record<string, unknown>): MailAccount {
  return {
    id,
    userId: data.userId as string,
    email: data.email as string,
    displayName: (data.displayName as string) ?? (data.email as string),
    signature: data.signature as string | undefined,
    signatureData: (data.signatureData as SignatureData) ?? null,
    password: (data.password as string) ?? "",
    imapServer: (data.imapServer as string) ?? "",
    imapPort: (data.imapPort as number) ?? 993,
    imapSecure: data.imapSecure !== undefined ? Boolean(data.imapSecure) : true,
    smtpServer: (data.smtpServer as string) ?? "",
    smtpPort: (data.smtpPort as number) ?? 587,
    smtpSecure: Boolean(data.smtpSecure),
    color: (data.color as string) ?? DEFAULT_ACCOUNT_COLOR,
    icon: data.icon as string | undefined,
    isActive: Boolean(data.isActive),
    sortOrder: (data.sortOrder as number) ?? 0,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    lastSyncAt: data.lastSyncAt ? toDate(data.lastSyncAt) : null,
    quotaUsedMb:
      typeof data.quotaUsedMb === "number" ? (data.quotaUsedMb as number) : null,
    quotaTotalMb:
      typeof data.quotaTotalMb === "number"
        ? (data.quotaTotalMb as number)
        : null,
    quotaCheckedAt: data.quotaCheckedAt ? toDate(data.quotaCheckedAt) : null,
    blockedSenders: Array.isArray(data.blockedSenders)
      ? (data.blockedSenders as string[])
      : [],
  };
}

/** Ajoute une adresse à la liste des expéditeurs bloqués du compte (scoping strict). */
export async function addBlockedSender(
  accountId: string,
  email: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, accountId), {
    blockedSenders: arrayUnion(email.trim().toLowerCase()),
    updatedAt: Timestamp.now(),
  });
}

export async function getAccountsByUser(
  userId: string
): Promise<MailAccount[]> {
  const q = query(collection(db, COLLECTION), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => mapAccount(d.id, d.data()))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getAccount(
  accountId: string
): Promise<MailAccount | null> {
  const snap = await getDoc(doc(db, COLLECTION, accountId));
  if (!snap.exists()) return null;
  return mapAccount(snap.id, snap.data());
}

export async function createAccount(
  input: CreateMailAccountInput,
  options: { encrypt?: boolean } = {}
): Promise<MailAccount> {
  const existing = await getAccountsByUser(input.userId);
  const now = Timestamp.now();
  const password =
    options.encrypt && input.password
      ? encryptPassword(input.password)
      : input.password;

  const payload = {
    userId: input.userId,
    email: input.email,
    displayName: input.displayName || input.email,
    signature: input.signature ?? "",
    signatureData: input.signatureData ?? null,
    password,
    imapServer: input.imapServer,
    imapPort: input.imapPort,
    imapSecure: input.imapSecure,
    smtpServer: input.smtpServer,
    smtpPort: input.smtpPort,
    smtpSecure: input.smtpSecure,
    color: input.color ?? DEFAULT_ACCOUNT_COLOR,
    icon: input.icon ?? "",
    isActive: input.isActive ?? existing.length === 0,
    sortOrder: input.sortOrder ?? existing.length,
    createdAt: now,
    updatedAt: now,
    lastSyncAt: null,
  };

  const ref = await addDoc(collection(db, COLLECTION), payload);
  const account = mapAccount(ref.id, payload);
  await createDefaultFolders(input.userId, ref.id);
  return account;
}

export async function updateAccount(
  accountId: string,
  input: UpdateMailAccountInput,
  options: { encrypt?: boolean } = {}
): Promise<void> {
  const payload: Record<string, unknown> = { ...input, updatedAt: Timestamp.now() };
  if (input.password !== undefined && input.password !== "") {
    payload.password = options.encrypt
      ? encryptPassword(input.password)
      : input.password;
  } else {
    delete payload.password;
  }
  await updateDoc(doc(db, COLLECTION, accountId), payload as Record<string, any>);
}

/** Supprime par lots tous les documents d'une collection liés au compte (scoping strict). */
async function deleteByAccount(
  collectionName: string,
  accountId: string,
  userId?: string
): Promise<number> {
  const constraints = [where("accountId", "==", accountId)];
  if (userId) constraints.push(where("userId", "==", userId));
  const snap = await getDocs(query(collection(db, collectionName), ...constraints));
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return docs.length;
}

/**
 * Supprime un compte ET, en cascade, tous ses dossiers (`mailFolders`) et
 * messages (`mailMessages`), scopés par `accountId` (+ `userId` du compte),
 * par lots ≤ 400 docs. Évite les dossiers/messages orphelins.
 */
export async function deleteAccount(
  accountId: string
): Promise<{ folders: number; messages: number }> {
  const accSnap = await getDoc(doc(db, COLLECTION, accountId));
  const userId = accSnap.exists()
    ? (accSnap.data().userId as string | undefined)
    : undefined;

  const messages = await deleteByAccount("mailMessages", accountId, userId);
  const folders = await deleteByAccount("mailFolders", accountId, userId);
  await deleteDoc(doc(db, COLLECTION, accountId));

  return { folders, messages };
}

export async function setActiveAccount(
  userId: string,
  accountId: string
): Promise<void> {
  const accounts = await getAccountsByUser(userId);
  const batch = writeBatch(db);
  accounts.forEach((acc) => {
    batch.update(doc(db, COLLECTION, acc.id), {
      isActive: acc.id === accountId,
    });
  });
  await batch.commit();
}
