"use client";

import {
  Sparkles,
  Trash2,
  Archive,
  ShieldAlert,
  Reply,
  ReplyAll,
  Forward,
  Flag,
  FolderInput,
  MoreHorizontal,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface MailActionBarProps {
  /** Au moins un message ciblé (sélection ou cases cochées). */
  hasTarget: boolean;
  /** Un seul message ouvert (pour répondre / transférer). */
  hasSingle: boolean;
  flagged?: boolean;
  onAssistant: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onSpam: () => void;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onFlag: () => void;
  onMove: () => void;
  onMore: (e: React.MouseEvent<HTMLButtonElement>) => void;
  selectedCount?: number;
}

export default function MailActionBar({
  hasTarget,
  hasSingle,
  flagged = false,
  onAssistant,
  onDelete,
  onArchive,
  onSpam,
  onReply,
  onReplyAll,
  onForward,
  onFlag,
  onMove,
  onMore,
  selectedCount = 0,
}: MailActionBarProps) {
  const { isDarkMode } = useTheme();

  const HINT = "Sélectionnez ou ouvrez un message";

  const base = `p-2 rounded-lg transition-colors ${
    isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"
  }`;
  const disabledCls = "opacity-30 cursor-not-allowed";

  const Btn = ({
    onClick,
    title,
    disabled,
    children,
    className = "",
  }: {
    onClick: () => void;
    title: string;
    disabled?: boolean;
    children: React.ReactNode;
    className?: string;
  }) => (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${disabled ? disabledCls : ""} ${className}`}
    >
      {children}
    </button>
  );

  return (
    <div
      className={`flex items-center gap-0.5 px-2 h-12 border-b flex-shrink-0 overflow-x-auto ${
        isDarkMode ? "border-gray-800" : "border-gray-200"
      }`}
    >
      <Btn onClick={onAssistant} title="Assistant IA">
        <Sparkles size={18} className="text-violet-500" />
      </Btn>

      <span className={`mx-1 w-px h-5 ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />

      <Btn
        onClick={onDelete}
        title={hasTarget ? "Supprimer" : HINT}
        disabled={!hasTarget}
        className="hover:text-red-500"
      >
        <Trash2 size={18} />
      </Btn>
      <Btn onClick={onArchive} title={hasTarget ? "Archiver" : HINT} disabled={!hasTarget}>
        <Archive size={18} />
      </Btn>
      <Btn
        onClick={onSpam}
        title={hasTarget ? "Marquer comme spam" : HINT}
        disabled={!hasTarget}
      >
        <ShieldAlert size={18} />
      </Btn>

      <span className={`mx-1 w-px h-5 ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />

      <Btn onClick={onReply} title={hasSingle ? "Répondre" : HINT} disabled={!hasSingle}>
        <Reply size={18} />
      </Btn>
      <Btn
        onClick={onReplyAll}
        title={hasSingle ? "Répondre à tous" : HINT}
        disabled={!hasSingle}
      >
        <ReplyAll size={18} />
      </Btn>
      <Btn onClick={onForward} title={hasSingle ? "Transférer" : HINT} disabled={!hasSingle}>
        <Forward size={18} />
      </Btn>

      <span className={`mx-1 w-px h-5 ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />

      <Btn onClick={onFlag} title={hasTarget ? "Drapeau / favori" : HINT} disabled={!hasTarget}>
        <Flag
          size={18}
          className={flagged ? "text-amber-500" : ""}
          fill={flagged ? "currentColor" : "none"}
        />
      </Btn>
      <Btn onClick={onMove} title={hasTarget ? "Déplacer vers" : HINT} disabled={!hasTarget}>
        <FolderInput size={18} />
      </Btn>
      <button
        type="button"
        title="Plus d'actions"
        onClick={onMore}
        className={base}
      >
        <MoreHorizontal size={18} />
      </button>

      {selectedCount > 0 && (
        <span
          className={`ml-auto mr-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            isDarkMode ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-700"
          }`}
        >
          {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
