"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Mail, Edit2, Power, ArrowLeft } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { auth } from "@/config/firebase";
import type { MailAccount } from "@/types/mail";
import {
  getAccountsByUser,
  createAccount,
  updateAccount,
  deleteAccount,
  setActiveAccount,
} from "@/lib/mail/accountService";
import MailAccountModal, {
  type MailAccountFormValues,
} from "@/components/mail/MailAccountModal";
import MailConfirmModal from "@/components/mail/MailConfirmModal";

interface ToastMsg {
  id: number;
  message: string;
  type: "success" | "error";
}

export default function EmailAccountsPage() {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MailAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MailAccount | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  const load = async () => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }
    try {
      setAccounts(await getAccountsByUser(auth.currentUser.uid));
    } catch (error) {
      console.error("Erreur chargement comptes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) router.push("/login");
      else load();
    });
    return () => unsubscribe();
  }, [router]);

  const handleSave = async (values: MailAccountFormValues) => {
    const user = auth.currentUser;
    if (!user) {
      showToast("Vous devez être connecté", "error");
      return;
    }
    try {
      if (editing) {
        await updateAccount(
          editing.id,
          {
            email: values.email,
            displayName: values.displayName,
            signature: values.signature,
            signatureData: values.signatureData,
            password: values.password,
            imapServer: values.imapServer,
            imapPort: values.imapPort,
            imapSecure: values.imapSecure,
            smtpServer: values.smtpServer,
            smtpPort: values.smtpPort,
            smtpSecure: values.smtpSecure,
            color: values.color,
          },
          { encrypt: true }
        );
        showToast("Compte mis à jour");
      } else {
        await createAccount(
          {
            userId: user.uid,
            email: values.email,
            displayName: values.displayName,
            signature: values.signature,
            signatureData: values.signatureData,
            password: values.password,
            imapServer: values.imapServer,
            imapPort: values.imapPort,
            imapSecure: values.imapSecure,
            smtpServer: values.smtpServer,
            smtpPort: values.smtpPort,
            smtpSecure: values.smtpSecure,
            color: values.color,
          },
          { encrypt: true }
        );
        showToast("Compte créé, dossiers système initialisés");
      }
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      console.error(error);
      showToast(
        error instanceof Error ? error.message : "Erreur lors de la sauvegarde",
        "error"
      );
    }
  };

  // Ouvre la confirmation forte (le bouton « Supprimer le compte » ne supprime jamais directement).
  const requestDelete = async (account: MailAccount) => {
    setModalOpen(false);
    setDeleteTarget(account);
  };

  const confirmDelete = async () => {
    const account = deleteTarget;
    if (!account || !auth.currentUser) return;
    setDeleting(true);
    try {
      const res = await deleteAccount(account.id);
      // Si le compte supprimé était actif, en activer un autre s'il en reste.
      if (account.isActive) {
        const remaining = accounts.filter((a) => a.id !== account.id);
        if (remaining[0]) {
          await setActiveAccount(auth.currentUser.uid, remaining[0].id);
        }
      }
      showToast(
        `Compte supprimé (${res.folders} dossier(s), ${res.messages} message(s))`
      );
      setDeleteTarget(null);
      setEditing(null);
      await load();
    } catch (error) {
      console.error(error);
      showToast("Erreur lors de la suppression", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (account: MailAccount) => {
    if (!auth.currentUser) return;
    try {
      await setActiveAccount(auth.currentUser.uid, account.id);
      showToast(`${account.displayName} est désormais actif`);
      await load();
    } catch (error) {
      console.error(error);
      showToast("Erreur lors du changement de compte actif", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div
      className={`p-8 min-h-screen ${
        isDarkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}
    >
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/email"
            className={`p-2 rounded-lg ${
              isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-200"
            }`}
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold">Comptes email</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={20} />
          <span>Nouveau compte</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((account) => (
          <div
            key={account.id}
            className={`p-6 rounded-xl shadow-md ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: account.color }}
                />
                <Mail size={20} className="text-blue-500 flex-shrink-0" />
                <h3 className="text-lg font-medium truncate">
                  {account.displayName}
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleToggleActive(account)}
                  title={account.isActive ? "Compte actif" : "Activer"}
                  className={`p-2 rounded-lg ${
                    account.isActive
                      ? "text-green-500"
                      : "hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  <Power size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(account);
                    setModalOpen(true);
                  }}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <Edit2 size={16} />
                </button>
              </div>
            </div>
            <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
              <div className="truncate">{account.email}</div>
              <div>SMTP: {account.smtpServer}:{account.smtpPort}</div>
              <div>IMAP: {account.imapServer}:{account.imapPort}</div>
              {account.isActive && (
                <span className="inline-block mt-2 px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  Actif
                </span>
              )}
            </div>
          </div>
        ))}

        {accounts.length === 0 && (
          <p className="opacity-60">Aucun compte. Créez-en un pour commencer.</p>
        )}
      </div>

      <MailAccountModal
        isOpen={modalOpen}
        account={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        onDelete={requestDelete}
      />

      <MailConfirmModal
        isOpen={!!deleteTarget}
        title="Supprimer le compte"
        destructive
        confirmLabel="Supprimer définitivement"
        loading={deleting}
        requireText={deleteTarget?.email}
        requireTextLabel={
          deleteTarget
            ? `Pour confirmer, retapez l'adresse : ${deleteTarget.email}`
            : undefined
        }
        message={
          deleteTarget
            ? `Supprimer le compte ${deleteTarget.email} ? Cette action supprimera définitivement le compte ET tous ses dossiers et messages locaux. Action irréversible.`
            : ""
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded-lg shadow-lg text-white ${
              t.type === "success" ? "bg-green-500" : "bg-red-500"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
