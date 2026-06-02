"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@headlessui/react";
import {
  X,
  Send,
  Paperclip,
  Bold,
  Italic,
  Underline,
  List,
  Link2,
  Trash2,
  FileText,
  Sparkles,
  Loader2,
  Check,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { auth } from "@/config/firebase";
import { useMail } from "@/context/MailContext";

const MAX_ATTACHMENTS_BYTES = 20 * 1024 * 1024;

function textToHtml(value: string): string {
  if (!value) return "";
  // Corps déjà HTML (réponses converties) ? on le garde tel quel s'il contient des balises.
  if (/<[a-z][\s\S]*>/i.test(value)) return value;
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function stripSignature(html: string): string {
  return html.replace(
    /(?:<br data-mail-sig-sep="1">)*<div data-mail-sig="1">[\s\S]*<\/div>\s*$/i,
    ""
  );
}

function applySignature(html: string, signature: string): string {
  const base = stripSignature(html ?? "");
  if (!signature) return base;
  return `${base}<br data-mail-sig-sep="1"><br data-mail-sig-sep="1"><div data-mail-sig="1">${signature}</div>`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = String(reader.result);
      resolve(r.includes(",") ? r.split(",")[1] : r);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
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

export default function MailComposeModal() {
  const { isDarkMode } = useTheme();
  const {
    isComposeOpen,
    composeDraft,
    updateDraft,
    closeCompose,
    accounts,
    showToast,
    reloadMessages,
    saveDraft,
    discardDraft,
  } = useMail();

  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initedRef = useRef(false);
  const prevAccountRef = useRef<string | null>(null);
  const [editorReady, setEditorReady] = useState(false);

  // Callback ref stable : signale quand l'éditeur contentEditable est monté
  // (déclenche l'effet d'initialisation une fois le DOM disponible).
  const attachEditor = useCallback((node: HTMLDivElement | null) => {
    editorRef.current = node;
    setEditorReady(!!node);
  }, []);

  // Initialisation de l'éditeur + insertion/mise à jour de la signature
  // quand l'expéditeur change. Robuste au timing : on attend que l'éditeur soit
  // monté ET que les comptes (donc la signature) soient chargés avant d'initialiser
  // (l'effet est re-déclenché via `editorReady` et `accounts`).
  useEffect(() => {
    if (!isComposeOpen || !composeDraft) {
      initedRef.current = false;
      prevAccountRef.current = null;
      return;
    }
    const el = editorRef.current;
    if (!el) return; // éditeur pas encore monté → re-déclenché par editorReady
    const acc = composeDraft.accountId;
    const signature = accounts.find((a) => a.id === acc)?.signature ?? "";

    if (!initedRef.current) {
      if (accounts.length === 0) return; // attendre la signature du compte
      initedRef.current = true;
      prevAccountRef.current = acc;
      const html = applySignature(textToHtml(composeDraft.body), signature);
      el.innerHTML = html;
      if (html !== composeDraft.body) updateDraft({ body: html });
      return;
    }
    if (prevAccountRef.current !== acc) {
      prevAccountRef.current = acc;
      const html = applySignature(el.innerHTML, signature);
      el.innerHTML = html;
      updateDraft({ body: html });
    }
  }, [isComposeOpen, composeDraft, accounts, editorReady, updateDraft]);

  if (!isComposeOpen || !composeDraft) return null;

  const inputClass = `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDarkMode
      ? "bg-gray-800 text-white border-gray-700"
      : "bg-white text-gray-900 border-gray-300"
  }`;

  const exec = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    if (editorRef.current) updateDraft({ body: editorRef.current.innerHTML });
  };

  const handleClose = () => {
    setFiles([]);
    setShowCc(false);
    setShowBcc(false);
    closeCompose();
  };

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  const removeFile = (index: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== index));

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  const handleSend = async () => {
    if (!composeDraft.to.trim()) {
      showToast("Veuillez renseigner au moins un destinataire", "error");
      return;
    }
    if (!auth.currentUser) {
      showToast("Vous devez être connecté", "error");
      return;
    }
    if (totalSize > MAX_ATTACHMENTS_BYTES) {
      showToast("Pièces jointes trop volumineuses (max 20 Mo)", "error");
      return;
    }
    setSending(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const attachments = await Promise.all(
        files.map(async (f) => ({
          filename: f.name,
          contentType: f.type || "application/octet-stream",
          contentBase64: await fileToBase64(f),
        }))
      );

      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accountId: composeDraft.accountId,
          to: composeDraft.to,
          cc: composeDraft.cc,
          bcc: composeDraft.bcc,
          subject: composeDraft.subject,
          content: composeDraft.body,
          attachments,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de l'envoi");
      }
      if (composeDraft.draftMessageId) {
        await discardDraft(composeDraft.draftMessageId);
      }
      showToast("Message envoyé avec succès");
      handleClose();
      reloadMessages();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Erreur lors de l'envoi",
        "error"
      );
    } finally {
      setSending(false);
    }
  };

  const runAiAction = async (action: "translate" | "correct" | "rephrase") => {
    setAiMenuOpen(false);
    const el = editorRef.current;
    if (!el || !auth.currentUser) return;
    const userHtml = stripSignature(el.innerHTML);
    const text = htmlToPlainText(userHtml);
    if (!text) {
      showToast("Aucun texte à traiter", "error");
      return;
    }
    setAiLoading(true);
    setAiResult(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/mail/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text, action, targetLang: "français" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur de l'assistant IA");
      }
      const data = await res.json();
      setAiResult(data.result as string);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Erreur de l'assistant IA",
        "error"
      );
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiResult = () => {
    const el = editorRef.current;
    if (!el || aiResult == null) return;
    const full = el.innerHTML;
    const userHtml = stripSignature(full);
    const sigHtml = full.slice(userHtml.length);
    const newFull = textToHtml(aiResult) + sigHtml;
    el.innerHTML = newFull;
    updateDraft({ body: newFull });
    setAiResult(null);
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const meta = files.map((f) => ({
        filename: f.name,
        contentType: f.type || "application/octet-stream",
        size: f.size,
      }));
      await saveDraft(meta);
      setFiles([]);
      setShowCc(false);
      setShowBcc(false);
    } finally {
      setSavingDraft(false);
    }
  };

  const toolbarBtn = `p-1.5 rounded ${
    isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-200"
  }`;

  return (
    <Dialog open={isComposeOpen} onClose={handleClose} className="relative z-[100]">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4 max-sm:p-0">
        <Dialog.Panel
          className={`w-full max-w-3xl h-[85vh] flex flex-col rounded-xl shadow-2xl max-sm:max-w-none max-sm:h-[100dvh] max-sm:rounded-none max-sm:pt-safe ${
            isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"
          }`}
        >
          <div
            className={`flex items-center justify-between px-4 py-3 border-b ${
              isDarkMode ? "border-gray-800" : "border-gray-200"
            }`}
          >
            <Dialog.Title className="font-semibold">Nouveau message</Dialog.Title>
            <button
              type="button"
              onClick={handleClose}
              className={`p-1.5 rounded-lg ${
                isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"
              }`}
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center gap-3">
              <label className="w-12 text-sm opacity-60">De</label>
              <select
                value={composeDraft.accountId}
                onChange={(e) => updateDraft({ accountId: e.target.value })}
                className={inputClass}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.displayName} &lt;{account.email}&gt;
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label className="w-12 text-sm opacity-60">À</label>
              <input
                type="text"
                value={composeDraft.to}
                onChange={(e) => updateDraft({ to: e.target.value })}
                placeholder="destinataire@exemple.com"
                spellCheck={false}
                className={inputClass}
              />
              <div className="flex gap-1 text-xs">
                {!showCc && (
                  <button
                    type="button"
                    onClick={() => setShowCc(true)}
                    className="opacity-60 hover:opacity-100"
                  >
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button
                    type="button"
                    onClick={() => setShowBcc(true)}
                    className="opacity-60 hover:opacity-100"
                  >
                    Cci
                  </button>
                )}
              </div>
            </div>

            {showCc && (
              <div className="flex items-center gap-3">
                <label className="w-12 text-sm opacity-60">Cc</label>
                <input
                  type="text"
                  value={composeDraft.cc ?? ""}
                  onChange={(e) => updateDraft({ cc: e.target.value })}
                  spellCheck={false}
                  className={inputClass}
                />
              </div>
            )}

            {showBcc && (
              <div className="flex items-center gap-3">
                <label className="w-12 text-sm opacity-60">Cci</label>
                <input
                  type="text"
                  value={composeDraft.bcc ?? ""}
                  onChange={(e) => updateDraft({ bcc: e.target.value })}
                  spellCheck={false}
                  className={inputClass}
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <label className="w-12 text-sm opacity-60">Objet</label>
              <input
                type="text"
                value={composeDraft.subject}
                onChange={(e) => updateDraft({ subject: e.target.value })}
                placeholder="Objet du message"
                spellCheck
                lang="fr"
                className={inputClass}
              />
            </div>

            {/* Barre d'outils de l'éditeur enrichi */}
            <div
              className={`flex items-center gap-1 px-1 py-1 rounded-lg border ${
                isDarkMode ? "border-gray-700" : "border-gray-300"
              }`}
            >
              <button
                type="button"
                title="Gras"
                onClick={() => exec("bold")}
                className={toolbarBtn}
              >
                <Bold size={16} />
              </button>
              <button
                type="button"
                title="Italique"
                onClick={() => exec("italic")}
                className={toolbarBtn}
              >
                <Italic size={16} />
              </button>
              <button
                type="button"
                title="Souligné"
                onClick={() => exec("underline")}
                className={toolbarBtn}
              >
                <Underline size={16} />
              </button>
              <button
                type="button"
                title="Liste à puces"
                onClick={() => exec("insertUnorderedList")}
                className={toolbarBtn}
              >
                <List size={16} />
              </button>
              <button
                type="button"
                title="Insérer un lien"
                onClick={() => {
                  const url = window.prompt("URL du lien :", "https://");
                  if (url) exec("createLink", url);
                }}
                className={toolbarBtn}
              >
                <Link2 size={16} />
              </button>

              <span
                className={`mx-1 w-px h-5 ${
                  isDarkMode ? "bg-gray-700" : "bg-gray-300"
                }`}
              />

              {/* Assistant IA */}
              <div className="relative">
                <button
                  type="button"
                  title="Assistant IA"
                  disabled={aiLoading}
                  onClick={() => setAiMenuOpen((v) => !v)}
                  className={`${toolbarBtn} text-violet-500 disabled:opacity-50`}
                >
                  {aiLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                </button>
                {aiMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setAiMenuOpen(false)}
                    />
                    <div
                      className={`absolute z-20 left-0 top-9 w-52 rounded-lg shadow-lg border py-1 text-sm ${
                        isDarkMode
                          ? "bg-gray-800 border-gray-700 text-gray-100"
                          : "bg-white border-gray-200 text-gray-900"
                      }`}
                    >
                      <div className="px-3 py-1.5 text-xs font-semibold opacity-60">
                        Assistant IA
                      </div>
                      <button
                        type="button"
                        onClick={() => runAiAction("correct")}
                        className={`w-full text-left px-3 py-1.5 ${
                          isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                        }`}
                      >
                        Corriger l&apos;orthographe
                      </button>
                      <button
                        type="button"
                        onClick={() => runAiAction("rephrase")}
                        className={`w-full text-left px-3 py-1.5 ${
                          isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                        }`}
                      >
                        Reformuler
                      </button>
                      <button
                        type="button"
                        onClick={() => runAiAction("translate")}
                        className={`w-full text-left px-3 py-1.5 ${
                          isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                        }`}
                      >
                        Traduire en français
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Éditeur enrichi (contentEditable) — signature pré-insérée */}
            <div
              ref={attachEditor}
              contentEditable
              spellCheck
              lang="fr"
              suppressContentEditableWarning
              onInput={(e) =>
                updateDraft({
                  body: (e.currentTarget as HTMLDivElement).innerHTML,
                })
              }
              data-placeholder="Votre message..."
              className={`w-full min-h-[240px] p-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-y-auto ${
                isDarkMode
                  ? "bg-gray-800 text-white border-gray-700"
                  : "bg-white text-gray-900 border-gray-300"
              }`}
            />

            {/* Aperçu du résultat de l'assistant IA */}
            {aiResult !== null && (
              <div
                className={`rounded-lg border p-3 ${
                  isDarkMode
                    ? "border-violet-500/40 bg-violet-500/10"
                    : "border-violet-300 bg-violet-50"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-violet-500">
                  <Sparkles size={14} />
                  Proposition de l&apos;assistant IA
                </div>
                <div className="text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {aiResult}
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setAiResult(null)}
                    className={`px-3 py-1.5 rounded-lg text-xs ${
                      isDarkMode
                        ? "bg-gray-800 hover:bg-gray-700"
                        : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    Ignorer
                  </button>
                  <button
                    type="button"
                    onClick={applyAiResult}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    <Check size={14} />
                    Remplacer le texte
                  </button>
                </div>
              </div>
            )}

            {/* Pièces jointes */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
                  isDarkMode
                    ? "border-gray-700 hover:bg-gray-800"
                    : "border-gray-300 hover:bg-gray-100"
                }`}
              >
                <Paperclip size={16} />
                Joindre un fichier
              </button>

              {files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                        isDarkMode ? "bg-gray-800" : "bg-gray-100"
                      }`}
                    >
                      <Paperclip size={14} className="opacity-60 flex-shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-xs opacity-50 flex-shrink-0">
                        {formatBytes(f.size)}
                      </span>
                      <button
                        type="button"
                        title="Retirer"
                        onClick={() => removeFile(i)}
                        className="p-1 rounded hover:bg-black/10 flex-shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <div className="text-xs opacity-50 px-1">
                    Total : {formatBytes(totalSize)} / 20 Mo
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            className={`flex flex-wrap items-center justify-end gap-2 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t ${
              isDarkMode ? "border-gray-800" : "border-gray-200"
            }`}
          >
            <button
              type="button"
              onClick={handleClose}
              className={`px-4 py-2 rounded-lg text-sm ${
                isDarkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={savingDraft || sending}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm disabled:opacity-50 ${
                isDarkMode
                  ? "bg-gray-800 hover:bg-gray-700"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              <FileText size={16} />
              {savingDraft ? "Enregistrement..." : "Enregistrer comme brouillon"}
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              <Send size={16} />
              {sending ? "Envoi..." : "Envoyer"}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
