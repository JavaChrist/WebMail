"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, MoreHorizontal, Trash2, FolderPlus } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { FOLDER_ICONS } from "@/lib/mail/constants";
import type { MailFolderNode } from "@/types/mail";
import MailUnreadBadge from "./MailUnreadBadge";

const MENU_WIDTH = 190;
const MENU_HEIGHT_EST = 130;

interface MailFolderItemProps {
  node: MailFolderNode;
  selected: boolean;
  unread: number;
  hasChildren: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onDropMessage: (messageId: string, folderId: string) => void;
  onContextAction?: (
    node: MailFolderNode,
    action: "rename" | "delete" | "empty" | "subfolder"
  ) => void;
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
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const Icon = FOLDER_ICONS[node.folderType];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const messageId = e.dataTransfer.getData("text/messageId");
    if (messageId) onDropMessage(messageId, node.id);
  };

  // Positionne le menu en `fixed` à partir du bouton, avec flip vers le haut
  // si l'espace sous le bouton est insuffisant (évite le clipping par la sidebar).
  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const margin = 8;
      let top = rect.bottom + 4;
      if (top + MENU_HEIGHT_EST > window.innerHeight - margin) {
        top = rect.top - MENU_HEIGHT_EST - 4;
      }
      if (top < margin) top = margin;
      let left = rect.right - MENU_WIDTH;
      if (left < margin) left = margin;
      if (left + MENU_WIDTH > window.innerWidth - margin) {
        left = window.innerWidth - margin - MENU_WIDTH;
      }
      setMenuPos({ top, left });
    }
    setMenuOpen(true);
  };

  // Fermeture sur Échap / scroll / redimensionnement (le menu fixed se
  // décalerait sinon au scroll de la sidebar).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const close = () => setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menuOpen]);

  const menuClass = `rounded-lg shadow-lg border py-1 text-sm ${
    isDarkMode
      ? "bg-gray-800 border-gray-700 text-gray-100"
      : "bg-white border-gray-200 text-gray-900"
  }`;
  const itemClass = (danger = false) =>
    `w-full flex items-center gap-2 text-left px-3 py-1.5 ${
      danger ? "text-red-500" : ""
    } ${isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`;

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
          <button
            ref={buttonRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (menuOpen) setMenuOpen(false);
              else openMenu();
            }}
            title="Options du dossier"
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10"
          >
            <MoreHorizontal size={14} />
          </button>
        )}
        {onContextAction &&
          menuOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <>
              <div
                className="fixed inset-0 z-[190]"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              />
              <div
                style={{
                  position: "fixed",
                  top: menuPos.top,
                  left: menuPos.left,
                  width: MENU_WIDTH,
                  zIndex: 200,
                }}
                className={menuClass}
                onClick={(e) => e.stopPropagation()}
              >
                {node.folderType === "trash" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onContextAction(node, "empty");
                    }}
                    className={itemClass(true)}
                  >
                    <Trash2 size={14} />
                    Vider la corbeille
                  </button>
                ) : (
                  <>
                    {(node.folderType === "archive" ||
                      node.folderType === "custom") && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onContextAction(node, "subfolder");
                        }}
                        className={itemClass()}
                      >
                        <FolderPlus size={14} />
                        Nouveau sous-dossier
                      </button>
                    )}
                    {!node.systemFolder ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            onContextAction(node, "rename");
                          }}
                          className={itemClass()}
                        >
                          Renommer
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            onContextAction(node, "delete");
                          }}
                          className={itemClass(true)}
                        >
                          Supprimer
                        </button>
                      </>
                    ) : (
                      node.folderType !== "archive" && (
                        <div className="px-3 py-1.5 opacity-50">
                          Dossier système
                        </div>
                      )
                    )}
                  </>
                )}
              </div>
            </>,
            document.body
          )}
        <MailUnreadBadge
          count={unread}
          className={selected ? "bg-blue-600" : ""}
        />
      </div>
    </div>
  );
}
