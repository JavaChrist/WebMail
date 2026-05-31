"use client";

import { useState } from "react";
import { Dialog } from "@headlessui/react";
import { X, Send } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { auth } from "@/config/firebase";
import { useMail } from "@/context/MailContext";

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
  } = useMail();

  const [sending, setSending] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  if (!isComposeOpen || !composeDraft) return null;

  const selectedAccount = accounts.find((a) => a.id === composeDraft.accountId);

  const inputClass = `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDarkMode
      ? "bg-gray-800 text-white border-gray-700"
      : "bg-white text-gray-900 border-gray-300"
  }`;

  const handleSend = async () => {
    if (!composeDraft.to.trim()) {
      showToast("Veuillez renseigner au moins un destinataire", "error");
      return;
    }
    if (!auth.currentUser) {
      showToast("Vous devez être connecté", "error");
      return;
    }
    setSending(true);
    try {
      const token = await auth.currentUser.getIdToken();
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
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de l'envoi");
      }
      showToast("Message envoyé avec succès");
      closeCompose();
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

  return (
    <Dialog open={isComposeOpen} onClose={closeCompose} className="relative z-[100]">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel
          className={`w-full max-w-3xl h-[85vh] flex flex-col rounded-xl shadow-2xl ${
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
              onClick={closeCompose}
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
                className={inputClass}
              />
            </div>

            <textarea
              value={composeDraft.body}
              onChange={(e) => updateDraft({ body: e.target.value })}
              placeholder="Votre message..."
              className={`w-full min-h-[260px] flex-1 p-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDarkMode
                  ? "bg-gray-800 text-white border-gray-700"
                  : "bg-white text-gray-900 border-gray-300"
              }`}
            />

            {selectedAccount?.signature && (
              <div
                className={`p-3 rounded-lg text-xs opacity-70 border ${
                  isDarkMode ? "border-gray-800" : "border-gray-200"
                }`}
              >
                <div className="font-medium mb-1">Signature ajoutée :</div>
                <div
                  dangerouslySetInnerHTML={{ __html: selectedAccount.signature }}
                />
              </div>
            )}
          </div>

          <div
            className={`flex items-center justify-end gap-2 px-4 py-3 border-t ${
              isDarkMode ? "border-gray-800" : "border-gray-200"
            }`}
          >
            <button
              type="button"
              onClick={closeCompose}
              className={`px-4 py-2 rounded-lg text-sm ${
                isDarkMode ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              Annuler
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
