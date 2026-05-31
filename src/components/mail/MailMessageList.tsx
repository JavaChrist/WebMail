"use client";

import { useMemo, useState } from "react";
import { Paperclip, RefreshCw, Inbox, MoreHorizontal, Check } from "lucide-react";
import { format, isToday, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useTheme } from "@/context/ThemeContext";
import { useMail } from "@/context/MailContext";
import type { MailMessage } from "@/types/mail";
import MailActionBar from "./MailActionBar";

function formatDate(date: Date): string {
  if (isToday(date)) return format(date, "HH:mm", { locale: fr });
  return format(date, "d MMM", { locale: fr });
}

function addressLabel(addr: { email: string; name?: string }): string {
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
}

export default function MailMessageList() {
  const { isDarkMode } = useTheme();
  const {
    messages,
    messagesLoading,
    selectedMessage,
    openMessage,
    toggleStar,
    folders,
    selectedFolderId,
    syncing,
    syncActiveAccount,
    activeAccount,
    archiveMessage,
    trashMessage,
    spamMessage,
    moveToFolder,
    openCompose,
    showToast,
  } = useMail();

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);

  const currentFolder = folders.find((f) => f.id === selectedFolderId);

  const toggleCheck = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allChecked = messages.length > 0 && checked.size === messages.length;
  const toggleAll = () =>
    setChecked(allChecked ? new Set() : new Set(messages.map((m) => m.id)));

  // Cible des actions : cases cochées, sinon message ouvert
  const targets = useMemo<MailMessage[]>(() => {
    if (checked.size > 0) return messages.filter((m) => checked.has(m.id));
    if (selectedMessage) return [selectedMessage];
    return [];
  }, [checked, messages, selectedMessage]);

  const runOnTargets = async (fn: (m: MailMessage) => Promise<void> | void) => {
    for (const m of targets) await fn(m);
    setChecked(new Set());
  };

  const buildReply = (mode: "reply" | "replyAll" | "forward") => {
    if (!selectedMessage) return;
    const m = selectedMessage;
    const quoted = `\n\n------ ${
      mode === "forward" ? "Message transféré" : "Message original"
    } ------\nDe: ${addressLabel(m.from)}\nDate: ${format(
      m.timestamp,
      "d MMMM yyyy 'à' HH:mm",
      { locale: fr }
    )}\nObjet: ${m.subject}\n\n${m.contentText || ""}`;

    let to = "";
    if (mode === "reply") to = m.from.email;
    if (mode === "replyAll") {
      const all = [m.from, ...(m.to ?? []), ...(m.cc ?? [])]
        .map((a) => a.email)
        .filter((e) => e && e !== activeAccount?.email);
      to = Array.from(new Set(all)).join(", ");
    }
    openCompose({
      accountId: activeAccount?.id,
      to,
      subject: `${mode === "forward" ? "Tr" : "Re"}: ${m.subject}`,
      body: quoted,
    });
  };

  const handleDragStart = (e: React.DragEvent, message: MailMessage) => {
    e.dataTransfer.setData("text/messageId", message.id);
  };

  const lastSync = activeAccount?.lastSyncAt
    ? formatDistanceToNow(activeAccount.lastSyncAt, { locale: fr, addSuffix: true })
    : null;

  const moveTargets = folders.filter((f) => f.id !== selectedFolderId);

  return (
    <div
      className={`flex flex-col h-full border-r ${
        isDarkMode
          ? "bg-gray-900 border-gray-800 text-gray-100"
          : "bg-white border-gray-200 text-gray-900"
      }`}
    >
      <div className="relative">
        <MailActionBar
          hasTarget={targets.length > 0}
          hasSingle={!!selectedMessage}
          flagged={selectedMessage?.starred}
          onAssistant={() => showToast("Assistant IA bientôt disponible")}
          onDelete={() => runOnTargets((m) => trashMessage(m))}
          onArchive={() => runOnTargets((m) => archiveMessage(m))}
          onSpam={() => runOnTargets((m) => spamMessage(m))}
          onReply={() => buildReply("reply")}
          onReplyAll={() => buildReply("replyAll")}
          onForward={() => buildReply("forward")}
          onFlag={() => runOnTargets((m) => toggleStar(m))}
          onMove={() => setMoveOpen((v) => !v)}
          onMore={() => showToast("Plus d'actions bientôt disponibles")}
        />
        {moveOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMoveOpen(false)}
            />
            <div
              className={`absolute z-20 right-2 top-12 w-56 max-h-72 overflow-y-auto rounded-lg shadow-lg border ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700"
                  : "bg-white border-gray-200"
              }`}
            >
              <div className="px-3 py-2 text-xs font-semibold opacity-60">
                Déplacer vers…
              </div>
              {moveTargets.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={async () => {
                    if (targets.length === 0) {
                      showToast("Sélectionnez un message", "error");
                    } else {
                      await runOnTargets((m) => moveToFolder(m, f.id));
                      showToast(`Déplacé vers ${f.name}`);
                    }
                    setMoveOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm ${
                    isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Titre du dossier + nombre de messages */}
      <div
        className={`flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0 ${
          isDarkMode ? "border-gray-800" : "border-gray-200"
        }`}
      >
        <div className="min-w-0">
          <h2 className="font-semibold text-lg truncate leading-tight">
            {currentFolder?.name ?? "Messages"}
          </h2>
          <p className="text-xs opacity-60">{messages.length} message(s)</p>
        </div>
        <button
          type="button"
          title="Options du dossier"
          className={`p-2 rounded-lg ${
            isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"
          }`}
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      {/* En-tête de colonnes léger */}
      <div
        className={`flex items-center gap-3 px-4 py-1.5 border-b text-xs flex-shrink-0 ${
          isDarkMode ? "border-gray-800 text-gray-500" : "border-gray-200 text-gray-400"
        }`}
      >
        <button
          type="button"
          onClick={toggleAll}
          className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
            allChecked
              ? "bg-blue-600 border-blue-600 text-white"
              : isDarkMode
              ? "border-gray-600"
              : "border-gray-300"
          }`}
        >
          {allChecked && <Check size={12} />}
        </button>
        <span className="flex-1">Expéditeur / Objet</span>
        <span>Date</span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-32 opacity-60">
            <RefreshCw size={20} className="animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 opacity-50">
            <Inbox size={32} />
            <p className="text-sm">Aucun message</p>
          </div>
        ) : (
          <ul className={isDarkMode ? "divide-y divide-gray-800" : "divide-y divide-gray-100"}>
            {messages.map((message) => {
              const isSelected = selectedMessage?.id === message.id;
              const isChecked = checked.has(message.id);
              return (
                <li
                  key={message.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, message)}
                  onClick={() => openMessage(message)}
                  className={`group flex gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    isSelected || isChecked
                      ? isDarkMode
                        ? "bg-blue-500/10"
                        : "bg-blue-50"
                      : isDarkMode
                      ? "hover:bg-gray-800/60"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {/* Case à cocher (visible au survol / si cochée) + pastille non-lu */}
                  <div className="flex-shrink-0 flex items-start pt-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCheck(message.id);
                      }}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-opacity ${
                        isChecked
                          ? "bg-blue-600 border-blue-600 text-white opacity-100"
                          : `opacity-0 group-hover:opacity-100 ${
                              isDarkMode ? "border-gray-600" : "border-gray-300"
                            }`
                      }`}
                    >
                      {isChecked && <Check size={12} />}
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-sm ${
                          message.read ? "" : "font-semibold"
                        }`}
                      >
                        {message.from.name || message.from.email || "(inconnu)"}
                      </span>
                      <span className="flex-shrink-0 text-xs opacity-60">
                        {formatDate(message.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {message.hasAttachments && (
                        <Paperclip size={12} className="opacity-50 flex-shrink-0" />
                      )}
                      <span
                        className={`truncate text-sm ${
                          message.read ? "opacity-80" : "font-medium"
                        }`}
                      >
                        {message.subject || "(sans objet)"}
                      </span>
                    </div>
                    <div className="truncate text-xs opacity-50">
                      {message.snippet}
                    </div>
                  </div>

                  {!message.read && (
                    <span className="flex-shrink-0 mt-2 w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer : dernière mise à jour */}
      <div
        className={`flex items-center justify-center gap-2 px-4 py-1.5 border-t text-xs flex-shrink-0 ${
          isDarkMode ? "border-gray-800 text-gray-500" : "border-gray-200 text-gray-400"
        }`}
      >
        <button
          type="button"
          onClick={syncActiveAccount}
          disabled={syncing}
          className="flex items-center gap-1.5 hover:underline"
        >
          <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
          {syncing
            ? "Mise à jour…"
            : lastSync
            ? `Mis à jour ${lastSync}`
            : "Actualiser"}
        </button>
      </div>
    </div>
  );
}
