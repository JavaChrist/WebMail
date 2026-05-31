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
  onMore: () => void;
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
}: MailActionBarProps) {
  const { isDarkMode } = useTheme();

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
      className={`flex items-center gap-0.5 px-2 h-12 border-b flex-shrink-0 ${
        isDarkMode ? "border-gray-800" : "border-gray-200"
      }`}
    >
      <Btn onClick={onAssistant} title="Assistant IA">
        <Sparkles size={18} className="text-violet-500" />
      </Btn>

      <span className={`mx-1 w-px h-5 ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />

      <Btn onClick={onDelete} title="Supprimer" disabled={!hasTarget} className="hover:text-red-500">
        <Trash2 size={18} />
      </Btn>
      <Btn onClick={onArchive} title="Archiver" disabled={!hasTarget}>
        <Archive size={18} />
      </Btn>
      <Btn onClick={onSpam} title="Marquer comme spam" disabled={!hasTarget}>
        <ShieldAlert size={18} />
      </Btn>

      <span className={`mx-1 w-px h-5 ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />

      <Btn onClick={onReply} title="Répondre" disabled={!hasSingle}>
        <Reply size={18} />
      </Btn>
      <Btn onClick={onReplyAll} title="Répondre à tous" disabled={!hasSingle}>
        <ReplyAll size={18} />
      </Btn>
      <Btn onClick={onForward} title="Transférer" disabled={!hasSingle}>
        <Forward size={18} />
      </Btn>

      <span className={`mx-1 w-px h-5 ${isDarkMode ? "bg-gray-800" : "bg-gray-200"}`} />

      <Btn onClick={onFlag} title="Drapeau" disabled={!hasTarget}>
        <Flag
          size={18}
          className={flagged ? "text-amber-500" : ""}
          fill={flagged ? "currentColor" : "none"}
        />
      </Btn>
      <Btn onClick={onMove} title="Déplacer vers" disabled={!hasTarget}>
        <FolderInput size={18} />
      </Btn>
      <Btn onClick={onMore} title="Plus d'actions">
        <MoreHorizontal size={18} />
      </Btn>
    </div>
  );
}
