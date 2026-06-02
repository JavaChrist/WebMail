"use client";

import { useMemo, useRef, useState } from "react";
import {
  Paperclip,
  RefreshCw,
  Inbox,
  MoreHorizontal,
  Check,
  List,
  PanelRight,
  PanelBottom,
  LayoutPanelTop,
  Star,
  Mail,
  MailOpen,
  Archive,
  ShieldAlert,
  Trash2,
  FolderInput,
  Printer,
  FileDown,
  Code,
  Ban,
} from "lucide-react";
import { format, isToday, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useTheme } from "@/context/ThemeContext";
import { useMail } from "@/context/MailContext";
import type { MailMessage } from "@/types/mail";
import MailActionBar from "./MailActionBar";
import PortalMenu, { MenuItem, MenuLabel, MenuSeparator } from "./PortalMenu";
import MailSourceModal from "./MailSourceModal";
import MailConfirmModal from "./MailConfirmModal";
import { downloadEml, printMessage } from "@/lib/mail/messageExport";

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
    viewMode,
    setViewMode,
    markRead,
    openDraft,
    blockSender,
  } = useMail();

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [sourceMsg, setSourceMsg] = useState<MailMessage | null>(null);
  const [blockTarget, setBlockTarget] = useState<MailMessage | null>(null);
  const moreAnchorRef = useRef<HTMLElement | null>(null);

  const layoutOptions = [
    { mode: "list" as const, label: "Liste seule", icon: List },
    { mode: "right" as const, label: "Aperçu à droite", icon: PanelRight },
    { mode: "bottom" as const, label: "Aperçu en bas", icon: PanelBottom },
  ];
  const LayoutIcon =
    layoutOptions.find((o) => o.mode === viewMode)?.icon ?? LayoutPanelTop;

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

  // Cible UNIQUE = exactement une cible (un seul coché, ou le message ouvert
  // si rien n'est coché). `targets` vaut déjà [selectedMessage] dans ce 2e cas.
  const single: MailMessage | null =
    targets.length === 1 ? targets[0] : null;

  const multiHint = "Sélectionnez ou ouvrez un message";
  const monoHint = "Sélectionnez ou ouvrez un seul message";

  const buildReply = (mode: "reply" | "replyAll" | "forward") => {
    if (!single) return;
    const m = single;
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
          hasSingle={!!single}
          flagged={single?.starred}
          onAssistant={() =>
            showToast(
              "Assistant IA disponible à l'ouverture d'un message (Traduire) et dans la rédaction (Corriger/Reformuler/Traduire)"
            )
          }
          onDelete={() => runOnTargets((m) => trashMessage(m))}
          onArchive={() => runOnTargets((m) => archiveMessage(m))}
          onSpam={() => runOnTargets((m) => spamMessage(m))}
          onReply={() => buildReply("reply")}
          onReplyAll={() => buildReply("replyAll")}
          onForward={() => buildReply("forward")}
          onFlag={() => runOnTargets((m) => toggleStar(m))}
          onMove={() => setMoveOpen((v) => !v)}
          onMore={(e) => {
            moreAnchorRef.current = e.currentTarget;
            setMoreOpen(true);
          }}
          selectedCount={checked.size}
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
        <div className="flex items-center gap-1">
          {/* Sélecteur de disposition */}
          <div className="relative">
            <button
              type="button"
              title="Disposition de l'aperçu"
              onClick={() => setLayoutOpen((v) => !v)}
              className={`p-2 rounded-lg ${
                isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"
              }`}
            >
              <LayoutIcon size={18} />
            </button>
            {layoutOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setLayoutOpen(false)}
                />
                <div
                  className={`absolute z-20 right-0 top-11 w-52 rounded-lg shadow-lg border py-1 ${
                    isDarkMode
                      ? "bg-gray-800 border-gray-700"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <div className="px-3 py-1.5 text-xs font-semibold opacity-60">
                    Disposition
                  </div>
                  {layoutOptions.map((opt) => {
                    const OptIcon = opt.icon;
                    const active = opt.mode === viewMode;
                    return (
                      <button
                        key={opt.mode}
                        type="button"
                        onClick={() => {
                          setViewMode(opt.mode);
                          setLayoutOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${
                          active
                            ? isDarkMode
                              ? "bg-blue-500/15 text-blue-300"
                              : "bg-blue-50 text-blue-700"
                            : isDarkMode
                            ? "hover:bg-gray-700"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        <OptIcon size={16} />
                        <span className="flex-1 text-left">{opt.label}</span>
                        {active && <Check size={14} />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
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
                  onClick={() =>
                    currentFolder?.folderType === "drafts" || message.isDraft
                      ? openDraft(message)
                      : openMessage(message)
                  }
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

                  <div className="flex-shrink-0 flex items-center self-center">
                    {/* Actions rapides au survol / focus clavier */}
                    <div className="hidden group-hover:flex group-focus-within:flex items-center gap-0.5">
                      {(() => {
                        const quick = (
                          onClick: () => void,
                          title: string,
                          icon: React.ReactNode,
                          extra = ""
                        ) => (
                          <button
                            type="button"
                            title={title}
                            aria-label={title}
                            onClick={(e) => {
                              e.stopPropagation();
                              onClick();
                            }}
                            className={`p-1 rounded transition-colors ${
                              isDarkMode
                                ? "hover:bg-gray-700"
                                : "hover:bg-gray-200"
                            } ${extra}`}
                          >
                            {icon}
                          </button>
                        );
                        return (
                          <>
                            {quick(
                              () => toggleStar(message),
                              message.starred
                                ? "Retirer des favoris"
                                : "Ajouter aux favoris",
                              <Star
                                size={15}
                                className={message.starred ? "text-yellow-400" : ""}
                                fill={message.starred ? "currentColor" : "none"}
                              />
                            )}
                            {quick(
                              () => markRead(message, !message.read),
                              message.read
                                ? "Marquer comme non lu"
                                : "Marquer comme lu",
                              message.read ? (
                                <Mail size={15} />
                              ) : (
                                <MailOpen size={15} />
                              )
                            )}
                            {quick(
                              () => archiveMessage(message),
                              "Archiver",
                              <Archive size={15} />
                            )}
                            {quick(
                              () => spamMessage(message),
                              "Spam",
                              <ShieldAlert size={15} />
                            )}
                            {quick(
                              () => trashMessage(message),
                              "Corbeille",
                              <Trash2 size={15} />,
                              "hover:text-red-500"
                            )}
                          </>
                        );
                      })()}
                    </div>
                    {/* Pastille non-lu (masquée au survol pour laisser place aux actions) */}
                    {!message.read && (
                      <span className="group-hover:hidden group-focus-within:hidden ml-1 w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer : dernière mise à jour */}
      <div
        className={`flex items-center justify-center gap-2 px-4 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] border-t text-xs flex-shrink-0 ${
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

      {/* Menu « Plus d'actions » (portail, non coupé) */}
      <PortalMenu
        open={moreOpen}
        anchorRef={moreAnchorRef}
        onClose={() => setMoreOpen(false)}
      >
        <MenuLabel>
          {checked.size > 0
            ? `${checked.size} message(s) sélectionné(s)`
            : "Actions"}
        </MenuLabel>
        <MenuItem
          disabled={targets.length === 0}
          title={targets.length === 0 ? multiHint : undefined}
          icon={<MailOpen size={16} />}
          onClick={() => {
            runOnTargets((m) => markRead(m, true));
            setMoreOpen(false);
          }}
        >
          Marquer comme lu
        </MenuItem>
        <MenuItem
          disabled={targets.length === 0}
          title={targets.length === 0 ? multiHint : undefined}
          icon={<Mail size={16} />}
          onClick={() => {
            runOnTargets((m) => markRead(m, false));
            setMoreOpen(false);
          }}
        >
          Marquer comme non lu
        </MenuItem>
        <MenuItem
          disabled={targets.length === 0}
          title={targets.length === 0 ? multiHint : undefined}
          icon={<Star size={16} />}
          onClick={() => {
            runOnTargets((m) => toggleStar(m));
            setMoreOpen(false);
          }}
        >
          Favori (étoile)
        </MenuItem>
        <MenuItem
          disabled={targets.length === 0}
          title={targets.length === 0 ? multiHint : undefined}
          icon={<FolderInput size={16} />}
          onClick={() => {
            setMoreOpen(false);
            setMoveOpen(true);
          }}
        >
          Déplacer vers…
        </MenuItem>

        <MenuSeparator />

        <MenuItem
          disabled={!single}
          title={!single ? monoHint : undefined}
          icon={<Printer size={16} />}
          onClick={() => {
            if (single) printMessage(single);
            setMoreOpen(false);
          }}
        >
          Imprimer
        </MenuItem>
        <MenuItem
          disabled={!single}
          title={!single ? monoHint : undefined}
          icon={<FileDown size={16} />}
          onClick={() => {
            if (single) downloadEml(single);
            setMoreOpen(false);
          }}
        >
          Télécharger (.eml)
        </MenuItem>
        <MenuItem
          disabled={!single}
          title={!single ? monoHint : undefined}
          icon={<Code size={16} />}
          onClick={() => {
            setSourceMsg(single);
            setMoreOpen(false);
          }}
        >
          Afficher la source
        </MenuItem>

        <MenuSeparator />

        <MenuItem
          danger
          disabled={!single}
          title={!single ? monoHint : undefined}
          icon={<Ban size={16} />}
          onClick={() => {
            setBlockTarget(single);
            setMoreOpen(false);
          }}
        >
          Bloquer l&apos;expéditeur
        </MenuItem>
      </PortalMenu>

      <MailSourceModal message={sourceMsg} onClose={() => setSourceMsg(null)} />

      <MailConfirmModal
        isOpen={!!blockTarget}
        title="Bloquer l'expéditeur"
        destructive
        confirmLabel="Bloquer et signaler"
        message={
          blockTarget
            ? `Bloquer « ${
                blockTarget.from.email || "cet expéditeur"
              } » ? Ce message sera déplacé dans le Spam et l'adresse sera ajoutée à votre liste d'expéditeurs bloqués.`
            : ""
        }
        onCancel={() => setBlockTarget(null)}
        onConfirm={async () => {
          const m = blockTarget;
          setBlockTarget(null);
          if (m) await blockSender(m);
        }}
      />
    </div>
  );
}
