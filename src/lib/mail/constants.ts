import {
  Inbox,
  FileEdit,
  Send,
  Archive,
  ShieldAlert,
  Trash2,
  Folder,
  type LucideIcon,
} from "lucide-react";
import type { FolderType } from "@/types/mail";

export const SYSTEM_FOLDER_TYPES: Exclude<FolderType, "custom">[] = [
  "inbox",
  "drafts",
  "sent",
  "archive",
  "spam",
  "trash",
];

export const FOLDER_LABELS: Record<FolderType, string> = {
  inbox: "Boîte de réception",
  drafts: "Brouillons",
  sent: "Envoyés",
  archive: "Archive",
  spam: "Spam",
  trash: "Corbeille",
  custom: "Dossier",
};

export const FOLDER_ICONS: Record<FolderType, LucideIcon> = {
  inbox: Inbox,
  drafts: FileEdit,
  sent: Send,
  archive: Archive,
  spam: ShieldAlert,
  trash: Trash2,
  custom: Folder,
};

export const FOLDER_ORDER: Record<FolderType, number> = {
  inbox: 0,
  drafts: 1,
  sent: 2,
  archive: 3,
  spam: 4,
  trash: 5,
  custom: 100,
};

export const DEFAULT_ACCOUNT_COLOR = "#2563eb";

export const ACCOUNT_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#dc2626",
  "#ea580c",
  "#16a34a",
  "#0891b2",
  "#4b5563",
];

export const IMAP_FOLDER_MAP: Record<string, Exclude<FolderType, "custom">> = {
  inbox: "inbox",
  "boîte de réception": "inbox",
  drafts: "drafts",
  brouillons: "drafts",
  sent: "sent",
  "sent items": "sent",
  envoyés: "sent",
  "éléments envoyés": "sent",
  archive: "archive",
  archives: "archive",
  spam: "spam",
  junk: "spam",
  "junk e-mail": "spam",
  trash: "trash",
  corbeille: "trash",
  deleted: "trash",
  "deleted items": "trash",
};

export function resolveFolderTypeFromImap(
  imapName: string
): Exclude<FolderType, "custom"> | null {
  const normalized = imapName.trim().toLowerCase();
  return IMAP_FOLDER_MAP[normalized] ?? null;
}
