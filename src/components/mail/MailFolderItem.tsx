"use client";

import { useState } from "react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { FOLDER_ICONS } from "@/lib/mail/constants";
import type { MailFolderNode } from "@/types/mail";
import MailUnreadBadge from "./MailUnreadBadge";

interface MailFolderItemProps {
  node: MailFolderNode;
  selected: boolean;
  unread: number;
  hasChildren: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onDropMessage: (messageId: string, folderId: string) => void;
  onContextAction?: (node: MailFolderNode, action: "rename" | "delete") => void;
}

export default function MailFolderItem({
  node,
  selected,
  unread,
  hasChildren,
  expanded,
  onSelect,
  onToggleExpand,
  onDropMessage,
  onContextAction,
}: MailFolderItemProps) {
  const { isDarkMode } = useTheme();
  const [isDragOver, setIsDragOver] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const Icon = FOLDER_ICONS[node.folderType];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const messageId = e.dataTransfer.getData("text/messageId");
    if (messageId) onDropMessage(messageId, node.id);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      style={{ paddingLeft: `${node.depth * 14}px` }}
    >
      <div
        onClick={onSelect}
        className={`group flex items-center gap-1.5 pr-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
          selected
            ? isDarkMode
              ? "bg-blue-500/15 text-blue-300"
              : "bg-blue-50 text-blue-700"
            : isDarkMode
            ? "hover:bg-gray-800"
            : "hover:bg-gray-100"
        } ${isDragOver ? "ring-2 ring-blue-400" : ""}`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleExpand();
          }}
          className={`flex-shrink-0 w-4 h-4 flex items-center justify-center ${
            hasChildren ? "" : "invisible"
          }`}
        >
          <ChevronRight
            size={14}
            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </button>
        <Icon
          size={16}
          className={`flex-shrink-0 ${selected ? "" : "opacity-70"}`}
        />
        <span
          className={`flex-1 truncate text-sm ${selected ? "font-medium" : ""}`}
        >
          {node.name}
        </span>
        {onContextAction && (
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              title="Options du dossier"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10"
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                  }}
                />
                <div
                  className={`absolute z-40 right-0 top-6 w-40 rounded-lg shadow-lg border py-1 text-sm ${
                    isDarkMode
                      ? "bg-gray-800 border-gray-700 text-gray-100"
                      : "bg-white border-gray-200 text-gray-900"
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {node.systemFolder ? (
                    <div className="px-3 py-1.5 opacity-50">
                      Dossier système
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onContextAction(node, "rename");
                        }}
                        className={`w-full text-left px-3 py-1.5 ${
                          isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                        }`}
                      >
                        Renommer
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onContextAction(node, "delete");
                        }}
                        className={`w-full text-left px-3 py-1.5 text-red-500 ${
                          isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                        }`}
                      >
                        Supprimer
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        <MailUnreadBadge
          count={unread}
          className={selected ? "bg-blue-600" : ""}
        />
      </div>
    </div>
  );
}
