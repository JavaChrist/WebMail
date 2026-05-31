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
  onFolderContext?: (node: MailFolderNode, action: "rename" | "delete") => void;
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
  const [customExpanded, setCustomExpanded] = useState(true);

  const systemNodes = folderTree.filter((n) => n.folderType !== "custom");
  const customNodes = folderTree.filter((n) => n.folderType === "custom");

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
        <MailUnreadBadge count={totalUnread} />
      </div>

      {expanded && (
        <div className="pl-2 pr-1 pb-1">
          {/* Dossiers système */}
          <MailFolderTree
            nodes={systemNodes}
            selectedFolderId={isActive ? selectedFolderId : null}
            unreadCounts={unreadCounts}
            onSelectFolder={onSelectFolder}
            onDropMessage={onDropMessage}
            onContextAction={onFolderContext}
          />

          {/* Section "Mes dossiers" */}
          <div className="mt-2">
            <div
              className={`group flex items-center gap-1.5 px-1.5 py-1 rounded-lg cursor-pointer text-xs font-semibold uppercase tracking-wide ${
                isDarkMode ? "text-gray-500 hover:bg-gray-800" : "text-gray-400 hover:bg-gray-100"
              }`}
              onClick={() => setCustomExpanded((v) => !v)}
            >
              <ChevronDown
                size={14}
                className={`transition-transform ${customExpanded ? "" : "-rotate-90"}`}
              />
              <span className="flex-1">Mes dossiers</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateFolder();
                }}
                title="Nouveau dossier"
                className="p-0.5 rounded hover:bg-black/10"
              >
                <Plus size={14} />
              </button>
            </div>

            {customExpanded && (
              <div className="mt-0.5">
                {customNodes.length > 0 ? (
                  <MailFolderTree
                    nodes={customNodes}
                    selectedFolderId={isActive ? selectedFolderId : null}
                    unreadCounts={unreadCounts}
                    onSelectFolder={onSelectFolder}
                    onDropMessage={onDropMessage}
                    onContextAction={onFolderContext}
                  />
                ) : (
                  <p className="px-2 py-1 text-xs opacity-50">Aucun dossier</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
