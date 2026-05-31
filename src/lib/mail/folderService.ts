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
  Timestamp,
  orderBy,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type {
  MailFolder,
  MailFolderNode,
  FolderType,
  CreateMailFolderInput,
  UpdateMailFolderInput,
} from "@/types/mail";
import { FOLDER_LABELS, FOLDER_ORDER, SYSTEM_FOLDER_TYPES } from "./constants";

const COLLECTION = "mailFolders";

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number")
    return new Date(value);
  return new Date();
}

function mapFolder(id: string, data: Record<string, unknown>): MailFolder {
  return {
    id,
    userId: data.userId as string,
    accountId: data.accountId as string,
    parentFolderId: (data.parentFolderId as string | null) ?? null,
    name: data.name as string,
    folderType: (data.folderType as FolderType) ?? "custom",
    systemFolder: Boolean(data.systemFolder),
    sortOrder: (data.sortOrder as number) ?? 0,
    imapPath: data.imapPath as string | undefined,
    unreadCount: (data.unreadCount as number) ?? 0,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export async function getFoldersByAccount(
  accountId: string
): Promise<MailFolder[]> {
  const q = query(
    collection(db, COLLECTION),
    where("accountId", "==", accountId)
  );
  const snap = await getDocs(q);
  const folders = snap.docs.map((d) => mapFolder(d.id, d.data()));
  return folders.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getFoldersByUser(userId: string): Promise<MailFolder[]> {
  const q = query(collection(db, COLLECTION), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapFolder(d.id, d.data()));
}

export async function getFolder(folderId: string): Promise<MailFolder | null> {
  const ref = doc(db, COLLECTION, folderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapFolder(snap.id, snap.data());
}

export async function createFolder(
  input: CreateMailFolderInput
): Promise<MailFolder> {
  const now = Timestamp.now();
  const payload = {
    userId: input.userId,
    accountId: input.accountId,
    parentFolderId: input.parentFolderId ?? null,
    name: input.name.trim(),
    folderType: input.folderType ?? "custom",
    systemFolder: input.systemFolder ?? false,
    sortOrder: input.sortOrder ?? FOLDER_ORDER.custom,
    imapPath: input.imapPath ?? "",
    unreadCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  const ref = await addDoc(collection(db, COLLECTION), payload);
  return mapFolder(ref.id, payload);
}

export async function createDefaultFolders(
  userId: string,
  accountId: string
): Promise<MailFolder[]> {
  const existing = await getFoldersByAccount(accountId);
  const existingTypes = new Set(existing.map((f) => f.folderType));

  const batch = writeBatch(db);
  const created: MailFolder[] = [];
  const now = Timestamp.now();

  for (const type of SYSTEM_FOLDER_TYPES) {
    if (existingTypes.has(type)) continue;
    const ref = doc(collection(db, COLLECTION));
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
    batch.set(ref, payload);
    created.push(mapFolder(ref.id, payload));
  }

  if (created.length > 0) await batch.commit();
  return [...existing, ...created].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function updateFolder(
  folderId: string,
  input: UpdateMailFolderInput
): Promise<void> {
  const folder = await getFolder(folderId);
  if (!folder) throw new Error("Dossier introuvable");
  if (folder.systemFolder && input.name && input.name !== folder.name) {
    throw new Error("Un dossier système ne peut pas être renommé");
  }
  await updateDoc(doc(db, COLLECTION, folderId), {
    ...input,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteFolder(folderId: string): Promise<void> {
  const folder = await getFolder(folderId);
  if (!folder) return;
  if (folder.systemFolder) {
    throw new Error("Un dossier système ne peut pas être supprimé");
  }
  const children = await getDocs(
    query(collection(db, COLLECTION), where("parentFolderId", "==", folderId))
  );
  const batch = writeBatch(db);
  children.forEach((c) => batch.update(c.ref, { parentFolderId: null }));
  batch.delete(doc(db, COLLECTION, folderId));
  await batch.commit();
}

export async function moveFolder(
  folderId: string,
  newParentId: string | null
): Promise<void> {
  const folder = await getFolder(folderId);
  if (!folder) throw new Error("Dossier introuvable");
  if (folder.systemFolder) {
    throw new Error("Un dossier système ne peut pas être déplacé");
  }
  if (newParentId === folderId) {
    throw new Error("Un dossier ne peut pas être son propre parent");
  }
  await updateDoc(doc(db, COLLECTION, folderId), {
    parentFolderId: newParentId,
    updatedAt: Timestamp.now(),
  });
}

export function buildFolderTree(folders: MailFolder[]): MailFolderNode[] {
  const byId = new Map<string, MailFolderNode>();
  folders.forEach((f) => byId.set(f.id, { ...f, children: [], depth: 0 }));

  const roots: MailFolderNode[] = [];
  byId.forEach((node) => {
    if (node.parentFolderId && byId.has(node.parentFolderId)) {
      byId.get(node.parentFolderId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const assignDepth = (nodes: MailFolderNode[], depth: number) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    nodes.forEach((n) => {
      n.depth = depth;
      assignDepth(n.children, depth + 1);
    });
  };
  assignDepth(roots, 0);

  return roots;
}

export function findSystemFolder(
  folders: MailFolder[],
  type: FolderType
): MailFolder | undefined {
  return folders.find((f) => f.folderType === type);
}
