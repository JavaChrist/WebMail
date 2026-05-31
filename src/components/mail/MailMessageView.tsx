"use client";

import {
  Star,
  Archive,
  Trash2,
  ShieldAlert,
  Reply,
  Forward,
  Mail,
  Paperclip,
  ArrowLeft,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useTheme } from "@/context/ThemeContext";
import { useMail } from "@/context/MailContext";
import type { MailMessage } from "@/types/mail";

function addressLabel(addr: { email: string; name?: string }): string {
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
}

export default function MailMessageView() {
  const { isDarkMode } = useTheme();
  const {
    selectedMessage,
    toggleStar,
    archiveMessage,
    trashMessage,
    spamMessage,
    openCompose,
    activeAccount,
    closeMessage,
  } = useMail();

  if (!selectedMessage) {
    return (
      <div
        className={`flex flex-col items-center justify-center h-full gap-3 ${
          isDarkMode ? "bg-gray-900 text-gray-500" : "bg-gray-50 text-gray-400"
        }`}
      >
        <Mail size={48} />
        <p className="text-sm">Sélectionnez un message à lire</p>
      </div>
    );
  }

  const message = selectedMessage;

  const buildReply = (forward: boolean) => {
    const quoted = `\n\n------ ${
      forward ? "Message transféré" : "Message original"
    } ------\nDe: ${addressLabel(message.from)}\nDate: ${format(
      message.timestamp,
      "d MMMM yyyy 'à' HH:mm",
      { locale: fr }
    )}\nObjet: ${message.subject}\n\n${message.contentText || ""}`;
    openCompose({
      accountId: activeAccount?.id,
      to: forward ? "" : message.from.email,
      subject: `${forward ? "Tr" : "Re"}: ${message.subject}`,
      body: quoted,
    });
  };

  const actionBtn = (
    onClick: () => void,
    title: string,
    children: React.ReactNode,
    extra = ""
  ) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg transition-colors ${
        isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"
      } ${extra}`}
    >
      {children}
    </button>
  );

  return (
    <div
      className={`flex flex-col h-full ${
        isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"
      }`}
    >
      <div
        className={`flex items-center gap-1 px-4 h-14 border-b flex-shrink-0 ${
          isDarkMode ? "border-gray-800" : "border-gray-200"
        }`}
      >
        {actionBtn(
          () => closeMessage(),
          "Retour",
          <ArrowLeft size={18} />,
          "lg:hidden"
        )}
        {actionBtn(
          () => toggleStar(message),
          message.starred ? "Retirer des favoris" : "Ajouter aux favoris",
          <Star
            size={18}
            className={message.starred ? "text-yellow-400" : ""}
            fill={message.starred ? "currentColor" : "none"}
          />
        )}
        {actionBtn(() => archiveMessage(message), "Archiver", <Archive size={18} />)}
        {actionBtn(() => spamMessage(message), "Spam", <ShieldAlert size={18} />)}
        {actionBtn(
          () => trashMessage(message),
          "Corbeille",
          <Trash2 size={18} />,
          "text-red-500"
        )}
        <div className="flex-1" />
        {actionBtn(() => buildReply(false), "Répondre", <Reply size={18} />)}
        {actionBtn(() => buildReply(true), "Transférer", <Forward size={18} />)}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div
          className={`px-6 py-4 border-b ${
            isDarkMode ? "border-gray-800" : "border-gray-200"
          }`}
        >
          <h1 className="text-xl font-semibold mb-3">
            {message.subject || "(sans objet)"}
          </h1>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="font-medium truncate">
                {addressLabel(message.from)}
              </div>
              <div className="text-sm opacity-60 truncate">
                À : {message.to.map(addressLabel).join(", ") || "—"}
              </div>
              {message.cc && message.cc.length > 0 && (
                <div className="text-sm opacity-60 truncate">
                  Cc : {message.cc.map(addressLabel).join(", ")}
                </div>
              )}
            </div>
            <div className="text-sm opacity-60 flex-shrink-0">
              {format(message.timestamp, "d MMM yyyy 'à' HH:mm", { locale: fr })}
            </div>
          </div>
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div
            className={`px-6 py-3 border-b flex flex-wrap gap-2 ${
              isDarkMode ? "border-gray-800" : "border-gray-200"
            }`}
          >
            {message.attachments.map((att, i) => (
              <a
                key={i}
                href={att.url || "#"}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                  isDarkMode ? "bg-gray-800" : "bg-gray-100"
                }`}
              >
                <Paperclip size={14} />
                <span className="truncate max-w-[180px]">{att.filename}</span>
              </a>
            ))}
          </div>
        )}

        <div className="px-6 py-5">
          {message.contentHtml ? (
            <div
              className={`prose max-w-none ${isDarkMode ? "prose-invert" : ""}`}
              dangerouslySetInnerHTML={{ __html: message.contentHtml }}
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm">
              {message.contentText || "(message vide)"}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
