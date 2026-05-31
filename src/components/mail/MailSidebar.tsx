"use client";

import { useState } from "react";
import Link from "next/link";
import { PenSquare, ChevronDown } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useMail } from "@/context/MailContext";
import type { MailFolderNode } from "@/types/mail";
import { FOLDER_ICONS } from "@/lib/mail/constants";
import MailAccountTree from "./MailAccountTree";
import MailQuota from "./MailQuota";
import MailFolderModal, { type FolderModalMode } from "./MailFolderModal";

interface MailSidebarProps {
  collapsed?: boolean;
}

export default function MailSidebar({ collapsed = false }: MailSidebarProps) {
  const { isDarkMode } = useTheme();
  const {
    accounts,
    activeAccountId,
    selectAccount,
    folderTree,
    unreadCounts,
    totalUnread,
    selectedFolderId,
    selectFolder,
    openCompose,
    moveToFolder,
    messages,
    folders,
    createFolder,
    removeFolder,
    renameFolder,
    quota,
    quotaLoading,
  } = useMail();

  const [folderModal, setFolderModal] = useState<{
    mode: FolderModalMode;
    folder: MailFolderNode | null;
  } | null>(null);

  const handleDropMessage = (messageId: string, folderId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (message) moveToFolder(message, folderId);
  };

  const handleFolderContext = (
    node: MailFolderNode,
    action: "rename" | "delete"
  ) => {
    setFolderModal({ mode: action, folder: node });
  };

  // ---- Mode rail (replié) : icônes uniquement ----
  if (collapsed) {
    const systemNodes = folderTree.filter((n) => n.folderType !== "custom");
    return (
      <aside
        className={`flex flex-col h-full w-16 flex-shrink-0 border-r ${
          isDarkMode
            ? "bg-gray-900 border-gray-800 text-gray-100"
            : "bg-white border-gray-200 text-gray-900"
        }`}
      >
        <div className="p-2 flex justify-center border-b border-inherit">
          <button
            type="button"
            onClick={() => openCompose()}
            title="Nouveau courriel"
            className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <PenSquare size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 flex flex-col items-center gap-1">
          {systemNodes.map((node) => {
            const Icon = FOLDER_ICONS[node.folderType];
            const selected = node.id === selectedFolderId;
            const unread = unreadCounts[node.id] ?? 0;
            return (
              <button
                key={node.id}
                type="button"
                title={node.name}
                onClick={() => selectFolder(node.id)}
                className={`relative p-2.5 rounded-lg transition-colors ${
                  selected
                    ? isDarkMode
                      ? "bg-blue-500/15 text-blue-300"
                      : "bg-blue-50 text-blue-700"
                    : isDarkMode
                    ? "hover:bg-gray-800"
                    : "hover:bg-gray-100"
                }`}
              >
                <Icon size={18} />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold flex items-center justify-center">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <MailQuota
          collapsed
          usedMb={quota?.usedMb ?? null}
          quotaMb={quota?.quotaMb ?? null}
          loading={quotaLoading}
        />
      </aside>
    );
  }

  // ---- Mode complet ----
  return (
    <>
    <aside
      className={`flex flex-col h-full w-64 flex-shrink-0 border-r ${
        isDarkMode
          ? "bg-gray-900 border-gray-800 text-gray-100"
          : "bg-white border-gray-200 text-gray-900"
      }`}
    >
      <div className="p-3 border-b border-inherit">
        <button
          type="button"
          onClick={() => openCompose()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <PenSquare size={18} />
          <span>Nouveau courriel</span>
          <ChevronDown size={16} className="ml-auto opacity-80" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {accounts.length === 0 && (
          <div className="p-4 text-center text-sm opacity-60">
            <p>Aucun compte configuré.</p>
            <Link href="/email/accounts" className="text-blue-500 hover:underline">
              Ajouter un compte
            </Link>
          </div>
        )}

        {accounts.map((account) => {
          const isActive = account.id === activeAccountId;
          return (
            <div key={account.id}>
              <MailAccountTree
                account={account}
                isActive={isActive}
                folderTree={isActive ? folderTree : []}
                unreadCounts={isActive ? unreadCounts : {}}
                totalUnread={isActive ? totalUnread : 0}
                selectedFolderId={selectedFolderId}
                onSelectAccount={() => selectAccount(account.id)}
                onSelectFolder={selectFolder}
                onDropMessage={handleDropMessage}
                onCreateFolder={() => {
                  selectAccount(account.id);
                  setFolderModal({ mode: "create", folder: null });
                }}
                onFolderContext={handleFolderContext}
              />
            </div>
          );
        })}
      </nav>

      <MailQuota
        usedMb={quota?.usedMb ?? null}
        quotaMb={quota?.quotaMb ?? null}
        loading={quotaLoading}
      />
    </aside>

    <MailFolderModal
      isOpen={!!folderModal}
      mode={folderModal?.mode ?? "create"}
      folder={folderModal?.folder ?? null}
      folders={folders}
      onClose={() => setFolderModal(null)}
      onCreate={createFolder}
      onRename={renameFolder}
      onDelete={removeFolder}
    />
    </>
  );
}
