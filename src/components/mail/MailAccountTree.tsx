"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import type { MailAccount, MailFolderNode } from "@/types/mail";
import { DEFAULT_ACCOUNT_COLOR } from "@/lib/mail/constants";
import MailFolderTree from "./MailFolderTree";
import MailUnreadBadge from "./MailUnreadBadge";

interface MailAccountTreeProps {
  account: MailAccount;
  isActive: boolean;
  folderTree: MailFolderNode[];
  unreadCounts: Record<string, number>;
  totalUnread: number;
  selectedFolderId: string | null;
  onSelectAccount: () => void;
  onSelectFolder: (folderId: string) => void;
  onDropMessage: (messageId: string, folderId: string) => void;
  onCreateFolder: () => void;
  onFolderContext?: (
    node: MailFolderNode,
    action: "rename" | "delete" | "empty" | "subfolder"
  ) => void;
}

// Ordre d'affichage des dossiers racine :
// Boîte de réception → dossiers personnalisés → Brouillons → Envoyés → Spam →
// Corbeille → Archives (en dernier, dépliable).
const ROOT_ORDER: Record<string, number> = {
  inbox: 0,
  drafts: 2,
  sent: 3,
  spam: 4,
  trash: 5,
  archive: 6,
};
function rootOrderKey(node: MailFolderNode): number {
  if (node.folderType === "custom") return 1;
  return ROOT_ORDER[node.folderType] ?? 1.5;
}

export default function MailAccountTree({
  account,
  isActive,
  folderTree,
  unreadCounts,
  totalUnread,
  selectedFolderId,
  onSelectAccount,
  onSelectFolder,
  onDropMessage,
  onCreateFolder,
  onFolderContext,
}: MailAccountTreeProps) {
  const { isDarkMode } = useTheme();
  const [expanded, setExpanded] = useState(isActive);

  const orderedRoots = [...folderTree].sort((a, b) => {
    const ka = rootOrderKey(a);
    const kb = rootOrderKey(b);
    if (ka !== kb) return ka - kb;
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  });

  return (
    <div className="rounded-lg">
      <div
        className={`group flex items-center gap-1.5 px-2 py-2 rounded-lg cursor-pointer ${
          isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"
        }`}
        onClick={() => {
          onSelectAccount();
          setExpanded(true);
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="flex-shrink-0"
        >
          <ChevronDown
            size={16}
            className={`transition-transform ${expanded ? "" : "-rotate-90"}`}
          />
        </button>
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: account.color || DEFAULT_ACCOUNT_COLOR }}
        />
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-bold">{account.displayName}</div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCreateFolder();
          }}
          title="Nouveau dossier"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10"
        >
          <Plus size={14} />
        </button>
        <MailUnreadBadge count={totalUnread} />
      </div>

      {expanded && (
        <div className="pl-2 pr-1 pb-1">
          <MailFolderTree
            nodes={orderedRoots}
            selectedFolderId={isActive ? selectedFolderId : null}
            unreadCounts={unreadCounts}
            onSelectFolder={onSelectFolder}
            onDropMessage={onDropMessage}
            onContextAction={onFolderContext}
          />
        </div>
      )}
    </div>
  );
}
