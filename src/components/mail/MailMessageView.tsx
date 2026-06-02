"use client";

import { useEffect, useRef, useState } from "react";
import {
  Star,
  Archive,
  Trash2,
  ShieldAlert,
  Reply,
  Forward,
  Mail,
  MailOpen,
  Paperclip,
  ArrowLeft,
  Download,
  Eye,
  Loader2,
  Languages,
  X,
  MoreHorizontal,
  Printer,
  FileDown,
  Code,
  Ban,
  FolderInput,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useTheme } from "@/context/ThemeContext";
import { useMail } from "@/context/MailContext";
import { auth } from "@/config/firebase";
import type { MailAttachment, MailMessage } from "@/types/mail";
import PortalMenu, { MenuItem, MenuLabel, MenuSeparator } from "./PortalMenu";
import MailSourceModal from "./MailSourceModal";
import MailConfirmModal from "./MailConfirmModal";
import { downloadEml, printMessage } from "@/lib/mail/messageExport";

function addressLabel(addr: { email: string; name?: string }): string {
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
}

function formatBytes(bytes?: number): string {
  if (typeof bytes !== "number") return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function canPreview(contentType?: string): boolean {
  if (!contentType) return false;
  return contentType.startsWith("image/") || contentType === "application/pdf";
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
    viewMode,
    searchActive,
    showToast,
    markRead,
    moveToFolder,
    folders,
    blockSender,
  } = useMail();

  const [loadingAtt, setLoadingAtt] = useState<Set<number>>(new Set());
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const moreAnchorRef = useRef<HTMLButtonElement | null>(null);

  // Réinitialise la traduction quand on change de message.
  useEffect(() => {
    setTranslation(null);
  }, [selectedMessage?.id]);

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

  const handleAttachment = async (
    att: MailAttachment,
    index: number,
    mode: "download" | "open"
  ) => {
    if (!auth.currentUser) {
      showToast("Vous devez être connecté", "error");
      return;
    }
    setLoadingAtt((prev) => new Set(prev).add(index));
    try {
      const token = await auth.currentUser.getIdToken();
      const params = new URLSearchParams({
        accountId: message.accountId,
        messageId: message.id,
        index: String(att.index ?? index),
        disposition: mode === "open" ? "inline" : "attachment",
      });
      if (att.filename) params.set("filename", att.filename);

      const res = await fetch(`/api/mail/attachment?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Pièce jointe introuvable");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (mode === "open") {
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = att.filename || "piece-jointe";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Erreur de téléchargement",
        "error"
      );
    } finally {
      setLoadingAtt((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  const handleTranslate = async () => {
    if (!auth.currentUser) {
      showToast("Vous devez être connecté", "error");
      return;
    }
    const text =
      message.contentText && message.contentText.trim()
        ? message.contentText
        : htmlToPlainText(message.contentHtml || "");
    if (!text.trim()) {
      showToast("Aucun texte à traduire", "error");
      return;
    }
    setTranslating(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/mail/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text,
          action: "translate",
          targetLang: "français",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur de traduction");
      }
      const data = await res.json();
      setTranslation(data.result as string);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Erreur de traduction",
        "error"
      );
    } finally {
      setTranslating(false);
    }
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
          viewMode === "list" || searchActive ? "" : "lg:hidden"
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
        {actionBtn(
          handleTranslate,
          "Traduire en français",
          translating ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Languages size={18} className="text-violet-500" />
          )
        )}
        <div className="flex-1" />
        {actionBtn(() => buildReply(false), "Répondre", <Reply size={18} />)}
        {actionBtn(() => buildReply(true), "Transférer", <Forward size={18} />)}
        <button
          ref={moreAnchorRef}
          type="button"
          title="Plus d'actions"
          onClick={() => setMoreOpen(true)}
          className={`p-2 rounded-lg transition-colors ${
            isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"
          }`}
        >
          <MoreHorizontal size={18} />
        </button>
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
            className={`px-6 py-3 border-b ${
              isDarkMode ? "border-gray-800" : "border-gray-200"
            }`}
          >
            <div className="text-xs font-medium opacity-60 mb-2">
              {message.attachments.length} pièce(s) jointe(s)
            </div>
            <div className="flex flex-wrap gap-2">
              {message.attachments.map((att, i) => {
                const loading = loadingAtt.has(i);
                const previewable = canPreview(att.contentType);
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-lg text-sm border ${
                      isDarkMode
                        ? "bg-gray-800 border-gray-700"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <Paperclip size={14} className="flex-shrink-0 opacity-60" />
                    <div className="min-w-0">
                      <div className="truncate max-w-[180px]">
                        {att.filename}
                      </div>
                      {formatBytes(att.size) && (
                        <div className="text-xs opacity-50">
                          {formatBytes(att.size)}
                        </div>
                      )}
                    </div>
                    {loading ? (
                      <span className="p-1.5">
                        <Loader2 size={16} className="animate-spin" />
                      </span>
                    ) : (
                      <div className="flex items-center">
                        {previewable && (
                          <button
                            type="button"
                            title="Ouvrir / aperçu"
                            onClick={() => handleAttachment(att, i, "open")}
                            className={`p-1.5 rounded-md ${
                              isDarkMode
                                ? "hover:bg-gray-700"
                                : "hover:bg-gray-200"
                            }`}
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Télécharger"
                          onClick={() => handleAttachment(att, i, "download")}
                          className={`p-1.5 rounded-md ${
                            isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"
                          }`}
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {translation !== null && (
          <div
            className={`mx-6 mt-4 rounded-lg border p-3 ${
              isDarkMode
                ? "border-violet-500/40 bg-violet-500/10"
                : "border-violet-300 bg-violet-50"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-500">
                <Languages size={14} />
                Traduction (français)
              </div>
              <button
                type="button"
                onClick={() => setTranslation(null)}
                title="Masquer la traduction (voir l'original)"
                className={`p-1 rounded ${
                  isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"
                }`}
              >
                <X size={14} />
              </button>
            </div>
            <div className="text-sm whitespace-pre-wrap">{translation}</div>
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

      {/* Menu « Plus d'actions » (portail) */}
      <PortalMenu
        open={moreOpen}
        anchorRef={moreAnchorRef}
        onClose={() => setMoreOpen(false)}
      >
        <MenuItem
          icon={message.read ? <Mail size={16} /> : <MailOpen size={16} />}
          onClick={() => {
            markRead(message, !message.read);
            setMoreOpen(false);
          }}
        >
          {message.read ? "Marquer comme non lu" : "Marquer comme lu"}
        </MenuItem>

        <MenuSeparator />
        <MenuLabel>Déplacer vers…</MenuLabel>
        {folders
          .filter((f) => f.id !== message.primaryFolderId)
          .map((f) => (
            <MenuItem
              key={f.id}
              icon={<FolderInput size={16} />}
              onClick={() => {
                setMoreOpen(false);
                moveToFolder(message, f.id);
                showToast(`Déplacé vers ${f.name}`);
              }}
            >
              {f.name}
            </MenuItem>
          ))}

        <MenuSeparator />
        <MenuItem
          icon={<Printer size={16} />}
          onClick={() => {
            printMessage(message);
            setMoreOpen(false);
          }}
        >
          Imprimer
        </MenuItem>
        <MenuItem
          icon={<FileDown size={16} />}
          onClick={() => {
            downloadEml(message);
            setMoreOpen(false);
          }}
        >
          Télécharger (.eml)
        </MenuItem>
        <MenuItem
          icon={<Code size={16} />}
          onClick={() => {
            setSourceOpen(true);
            setMoreOpen(false);
          }}
        >
          Afficher la source
        </MenuItem>

        <MenuSeparator />
        <MenuItem
          danger
          icon={<Ban size={16} />}
          onClick={() => {
            setBlockOpen(true);
            setMoreOpen(false);
          }}
        >
          Bloquer l&apos;expéditeur
        </MenuItem>
      </PortalMenu>

      <MailSourceModal
        message={sourceOpen ? message : null}
        onClose={() => setSourceOpen(false)}
      />

      <MailConfirmModal
        isOpen={blockOpen}
        title="Bloquer l'expéditeur"
        destructive
        confirmLabel="Bloquer et signaler"
        message={`Bloquer « ${
          message.from.email || "cet expéditeur"
        } » ? Ce message sera déplacé dans le Spam et l'adresse sera ajoutée à votre liste d'expéditeurs bloqués.`}
        onCancel={() => setBlockOpen(false)}
        onConfirm={async () => {
          setBlockOpen(false);
          await blockSender(message);
        }}
      />
    </div>
  );
}
