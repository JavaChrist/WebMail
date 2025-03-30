"use client";
import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { auth } from "@/config/firebase";
import { db } from "@/config/firebase";
import { Plus, Mail, Trash2, Edit2 } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "next/navigation";
import EmailAccountModal, {
  EmailAccount,
} from "@/components/email/EmailAccountModal";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

export default function EmailAccountsPage() {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<
    EmailAccount | undefined
  >();
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/login");
      } else {
        loadAccounts();
      }
    });

    return () => unsubscribe();
  }, [router]);

  const showToast = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  };

  const loadAccounts = async () => {
    if (!auth.currentUser) {
      setIsLoading(false);
      return;
    }

    try {
      const accountsRef = collection(db, "emailAccounts");
      const q = query(accountsRef, where("userId", "==", auth.currentUser.uid));
      const querySnapshot = await getDocs(q);

      const loadedAccounts = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as EmailAccount[];

      setAccounts(loadedAccounts);
      setIsLoading(false);
    } catch (error) {
      console.error("Erreur lors du chargement des comptes:", error);
      setIsLoading(false);
    }
  };

  const handleSaveAccount = async (account: EmailAccount) => {
    if (!auth.currentUser) {
      showToast("Vous devez être connecté pour gérer les comptes", "error");
      return;
    }

    try {
      const accountData = {
        ...account,
        userId: auth.currentUser.uid,
        updatedAt: new Date(),
      };

      if (account.id) {
        // Mise à jour d'un compte existant
        await updateDoc(doc(db, "emailAccounts", account.id), accountData);
        setAccounts((prev) =>
          prev.map((a) => (a.id === account.id ? account : a))
        );
        showToast("Compte mis à jour avec succès", "success");
      } else {
        // Création d'un nouveau compte
        accountData.createdAt = new Date();
        const docRef = await addDoc(
          collection(db, "emailAccounts"),
          accountData
        );
        const newAccount = { ...accountData, id: docRef.id };
        setAccounts((prev) => [...prev, newAccount]);
        showToast("Compte créé avec succès", "success");
      }
      setIsModalOpen(false);
      setSelectedAccount(undefined);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du compte:", error);
      showToast(
        error instanceof Error
          ? error.message
          : "Erreur lors de la sauvegarde du compte",
        "error"
      );
    }
  };

  const handleDeleteAccount = async (account: EmailAccount) => {
    if (!account.id || !auth.currentUser) return;

    try {
      await deleteDoc(doc(db, "emailAccounts", account.id));
      setAccounts((prev) => prev.filter((a) => a.id !== account.id));
      setIsModalOpen(false);
      showToast("Compte supprimé avec succès", "success");
    } catch (error) {
      console.error("Erreur lors de la suppression du compte:", error);
      showToast("Erreur lors de la suppression du compte", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div
      className={`p-8 ${
        isDarkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      } min-h-screen`}
    >
      {/* En-tête */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Comptes email</h1>
          <button
            onClick={() => {
              setSelectedAccount(undefined);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            <span>Nouveau compte</span>
          </button>
        </div>
      </div>

      {/* Liste des comptes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((account) => (
          <div
            key={account.id}
            className={`p-6 rounded-xl ${
              isDarkMode
                ? "bg-gray-800 hover:bg-gray-700"
                : "bg-white hover:bg-gray-50"
            } shadow-md transition-all duration-200`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Mail size={24} className="text-blue-500" />
                <h3 className="text-lg font-medium">{account.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedAccount(account);
                    setIsModalOpen(true);
                  }}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Modifier"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDeleteAccount(account)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={16} className="text-red-500" />
                </button>
              </div>
            </div>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <div>{account.email}</div>
              <div>
                SMTP: {account.smtpServer}:{account.smtpPort}
              </div>
              <div>
                IMAP: {account.imapServer}:{account.imapPort}
              </div>
              <div className="flex gap-2">
                {account.useSSL && (
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-xs">
                    SSL
                  </span>
                )}
                {account.useTLS && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs">
                    TLS
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de compte */}
      <EmailAccountModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedAccount(undefined);
        }}
        onSave={handleSaveAccount}
        onDelete={handleDeleteAccount}
        selectedAccount={selectedAccount}
      />

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-2 rounded-lg shadow-lg ${
              toast.type === "success"
                ? "bg-green-500 text-white"
                : "bg-red-500 text-white"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
