"use client";

import {
  X,
  Star,
  Archive,
  Trash2,
  Reply,
  Forward,
  Paperclip,
  Download,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface EmailViewProps {
  email: {
    id: string;
    from: string;
    to: string;
    subject: string;
    content: string;
    timestamp: Date;
    read: boolean;
    starred: boolean;
    attachments?: {
      name: string;
      url: string;
      size: number;
    }[];
  };
  onClose: () => void;
  onStar: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onReply: () => void;
  onForward: () => void;
}

export default function EmailView({
  email,
  onClose,
  onStar,
  onArchive,
  onDelete,
  onReply,
  onForward,
}: EmailViewProps) {
  const { isDarkMode } = useTheme();

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div
      className={`h-full flex flex-col ${
        isDarkMode ? "text-white" : "text-gray-900"
      }`}
    >
      {/* En-tête */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-bold truncate">{email.subject}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"
            }`}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Barre d'actions */}
      <div
        className={`flex items-center gap-2 p-4 border-b ${
          isDarkMode ? "border-gray-700" : "border-gray-200"
        }`}
      >
        <button
          onClick={onStar}
          className={`p-2 rounded-lg transition-colors ${
            email.starred
              ? "text-yellow-400"
              : isDarkMode
              ? "text-gray-400"
              : "text-gray-500"
          } ${isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"}`}
          title={email.starred ? "Retirer des favoris" : "Ajouter aux favoris"}
        >
          <Star size={20} />
        </button>
        <button
          onClick={onArchive}
          className={`p-2 rounded-lg transition-colors ${
            isDarkMode
              ? "hover:bg-gray-700 text-gray-400"
              : "hover:bg-gray-200 text-gray-500"
          }`}
          title="Archiver"
        >
          <Archive size={20} />
        </button>
        <button
          onClick={onDelete}
          className={`p-2 rounded-lg transition-colors text-red-500 ${
            isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"
          }`}
          title="Supprimer"
        >
          <Trash2 size={20} />
        </button>
        <div className="flex-1" />
        <button
          onClick={onReply}
          className={`p-2 rounded-lg transition-colors ${
            isDarkMode
              ? "hover:bg-gray-700 text-gray-400"
              : "hover:bg-gray-200 text-gray-500"
          }`}
          title="Répondre"
        >
          <Reply size={20} />
        </button>
        <button
          onClick={onForward}
          className={`p-2 rounded-lg transition-colors ${
            isDarkMode
              ? "hover:bg-gray-700 text-gray-400"
              : "hover:bg-gray-200 text-gray-500"
          }`}
          title="Transférer"
        >
          <Forward size={20} />
        </button>
      </div>

      {/* Métadonnées de l'email */}
      <div
        className={`p-4 border-b ${
          isDarkMode ? "border-gray-700" : "border-gray-200"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="font-semibold">{email.from}</div>
            <div className="text-sm text-gray-500">À: {email.to}</div>
          </div>
          <div className="text-sm text-gray-500">
            {format(new Date(email.timestamp), "d MMMM yyyy 'à' HH:mm", {
              locale: fr,
            })}
          </div>
        </div>
      </div>

      {/* Contenu de l'email */}
      <div className="flex-1 p-4 overflow-auto">
        {/* Pièces jointes */}
        {email.attachments && email.attachments.length > 0 && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              isDarkMode ? "bg-gray-700" : "bg-gray-100"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Paperclip size={20} className="text-gray-500" />
              <span className="font-medium">Pièces jointes</span>
            </div>
            <div className="space-y-2">
              {email.attachments.map((attachment, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    isDarkMode ? "bg-gray-600" : "bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate">{attachment.name}</span>
                    <span className="text-sm text-gray-500">
                      ({formatFileSize(attachment.size)})
                    </span>
                  </div>
                  <a
                    href={attachment.url}
                    download={attachment.name}
                    className={`p-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? "hover:bg-gray-500 text-gray-300"
                        : "hover:bg-gray-100 text-gray-600"
                    }`}
                  >
                    <Download size={20} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contenu HTML */}
        <div
          className={`prose max-w-none ${
            isDarkMode ? "prose-invert" : ""
          } prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto`}
          dangerouslySetInnerHTML={{ __html: email.content }}
        />
      </div>
    </div>
  );
}
