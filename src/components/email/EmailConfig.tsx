"use client";

import { Dialog as HeadlessDialog } from "@headlessui/react";
import { useState, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { X, Eye, EyeOff } from "lucide-react";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { auth, db } from "@/config/firebase";
import CryptoJS from "crypto-js";

interface EmailConfigProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EmailSettings {
  email: string;
  emailPassword: string;
  // Paramètres SMTP (envoi)
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  // Paramètres IMAP (réception)
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
}

const defaultIonosSettings = {
  smtpHost: "smtp.ionos.fr",
  smtpPort: 465,
  smtpSecure: true,
  imapHost: "imap.ionos.fr",
  imapPort: 993,
  imapSecure: true,
};

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY;

const encryptPassword = (password: string): string => {
  if (!ENCRYPTION_KEY) {
    throw new Error("La clé de chiffrement n'est pas définie");
  }
  try {
    // Utiliser une approche plus simple sans format spécifique
    return CryptoJS.AES.encrypt(password, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error("Erreur lors du chiffrement:", error);
    throw new Error("Le chiffrement a échoué");
  }
};

const decryptPassword = (encryptedPassword: string): string => {
  if (!ENCRYPTION_KEY) {
    throw new Error("La clé de chiffrement n'est pas définie");
  }
  try {
    // Déchiffrement simple
    const bytes = CryptoJS.AES.decrypt(encryptedPassword, ENCRYPTION_KEY);
    const result = bytes.toString(CryptoJS.enc.Utf8);
    if (!result) {
      throw new Error("Le déchiffrement a produit une chaîne vide");
    }
    return result;
  } catch (error) {
    console.error("Erreur lors du décryptage:", error);
    throw new Error("Le déchiffrement a échoué");
  }
};

export default function EmailConfig({ isOpen, onClose }: EmailConfigProps) {
  const { isDarkMode } = useTheme();
  const [settings, setSettings] = useState<EmailSettings>({
    email: "",
    emailPassword: "",
    ...defaultIonosSettings,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      if (!auth.currentUser) return;

      try {
        const emailAccountsRef = collection(db, "emailAccounts");
        const q = query(
          emailAccountsRef,
          where("userId", "==", auth.currentUser.uid)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const data = querySnapshot.docs[0].data();
          setSettings({
            email: data.email || "",
            emailPassword: data.password ? decryptPassword(data.password) : "",
            smtpHost: data.smtpServer || defaultIonosSettings.smtpHost,
            smtpPort: data.smtpPort || defaultIonosSettings.smtpPort,
            smtpSecure: data.useSSL ?? defaultIonosSettings.smtpSecure,
            imapHost: data.imapServer || defaultIonosSettings.imapHost,
            imapPort: data.imapPort || defaultIonosSettings.imapPort,
            imapSecure: data.useSSL ?? defaultIonosSettings.imapSecure,
          });
        }
      } catch (error) {
        console.error("Erreur lors du chargement des paramètres:", error);
        setError("Erreur lors du chargement des paramètres");
      }
    };

    if (isOpen) {
      loadSettings();
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  const testConnection = async () => {
    setIsTesting(true);
    setError(null);
    setSuccess(null);

    try {
      // Tester la connexion SMTP
      const response = await fetch("/api/email/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          host: settings.smtpHost,
          port: settings.smtpPort,
          secure: settings.smtpSecure,
          user: settings.email,
          pass: settings.emailPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Erreur de connexion au serveur de messagerie"
        );
      }

      setSuccess("Configuration du serveur de messagerie validée");
    } catch (error) {
      console.error("Erreur lors du test de connexion:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Erreur de connexion au serveur de messagerie"
      );
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      setError("Vous devez être connecté pour sauvegarder la configuration");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const emailAccountsRef = collection(db, "emailAccounts");
      const q = query(
        emailAccountsRef,
        where("userId", "==", auth.currentUser.uid)
      );
      const querySnapshot = await getDocs(q);

      const configData = {
        email: settings.email,
        password: encryptPassword(settings.emailPassword),
        smtpServer: settings.smtpHost,
        smtpPort: Number(settings.smtpPort),
        useSSL: Boolean(settings.smtpSecure),
        imapServer: settings.imapHost,
        imapPort: Number(settings.imapPort),
        userId: auth.currentUser.uid,
        name: settings.email,
        updatedAt: new Date().toISOString(),
      };

      if (!querySnapshot.empty) {
        // Mettre à jour le compte existant
        const docRef = doc(db, "emailAccounts", querySnapshot.docs[0].id);
        await updateDoc(docRef, configData);
      } else {
        // Créer un nouveau compte
        await addDoc(emailAccountsRef, configData);
      }

      setSuccess("Configuration enregistrée avec succès");
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Erreur lors de la sauvegarde de la configuration"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const resetToIonosDefaults = () => {
    setSettings({
      email: "",
      emailPassword: "",
      ...defaultIonosSettings,
    });
    setError(null);
    setSuccess(null);
  };

  return (
    <HeadlessDialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <HeadlessDialog.Panel
          className={`w-full max-w-2xl p-6 rounded-lg shadow-xl ${
            isDarkMode ? "bg-gray-800 text-white" : "bg-white text-gray-900"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <HeadlessDialog.Title className="text-xl font-bold">
              Configuration du compte email
            </HeadlessDialog.Title>
            <button
              onClick={onClose}
              className={`p-1 rounded-lg transition-colors ${
                isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
              }`}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-500/10 border border-green-500 rounded-lg text-green-500">
                {success}
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Paramètres du compte</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block mb-1">Adresse email</label>
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) =>
                      setSettings({ ...settings, email: e.target.value })
                    }
                    className={`w-full px-4 py-2 rounded-lg ${
                      isDarkMode
                        ? "bg-gray-700 text-white placeholder-gray-400"
                        : "bg-gray-50 text-gray-900 placeholder-gray-500"
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    required
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block mb-1">
                    Mot de passe du compte email
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={settings.emailPassword}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emailPassword: e.target.value,
                        })
                      }
                      className={`w-full px-4 py-2 rounded-lg ${
                        isDarkMode
                          ? "bg-gray-700 text-white placeholder-gray-400"
                          : "bg-gray-50 text-gray-900 placeholder-gray-500"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors ${
                        isDarkMode ? "hover:bg-gray-600" : "hover:bg-gray-200"
                      }`}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Paramètres SMTP (envoi)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1">Serveur SMTP</label>
                  <input
                    type="text"
                    value={settings.smtpHost}
                    onChange={(e) =>
                      setSettings({ ...settings, smtpHost: e.target.value })
                    }
                    className={`w-full px-4 py-2 rounded-lg ${
                      isDarkMode
                        ? "bg-gray-700 text-white"
                        : "bg-gray-50 text-gray-900"
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1">Port SMTP</label>
                  <input
                    type="number"
                    value={settings.smtpPort}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        smtpPort: parseInt(e.target.value),
                      })
                    }
                    className={`w-full px-4 py-2 rounded-lg ${
                      isDarkMode
                        ? "bg-gray-700 text-white"
                        : "bg-gray-50 text-gray-900"
                    }`}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">
                Paramètres IMAP (réception)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1">Serveur IMAP</label>
                  <input
                    type="text"
                    value={settings.imapHost}
                    onChange={(e) =>
                      setSettings({ ...settings, imapHost: e.target.value })
                    }
                    className={`w-full px-4 py-2 rounded-lg ${
                      isDarkMode
                        ? "bg-gray-700 text-white"
                        : "bg-gray-50 text-gray-900"
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1">Port IMAP</label>
                  <input
                    type="number"
                    value={settings.imapPort}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        imapPort: parseInt(e.target.value),
                      })
                    }
                    className={`w-full px-4 py-2 rounded-lg ${
                      isDarkMode
                        ? "bg-gray-700 text-white"
                        : "bg-gray-50 text-gray-900"
                    }`}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Sécurité</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1">SMTP</label>
                  <input
                    type="checkbox"
                    checked={settings.smtpSecure}
                    onChange={(e) =>
                      setSettings({ ...settings, smtpSecure: e.target.checked })
                    }
                    className={`w-full px-4 py-2 rounded-lg ${
                      isDarkMode
                        ? "bg-gray-700 text-white"
                        : "bg-gray-50 text-gray-900"
                    }`}
                  />
                </div>
                <div>
                  <label className="block mb-1">IMAP</label>
                  <input
                    type="checkbox"
                    checked={settings.imapSecure}
                    onChange={(e) =>
                      setSettings({ ...settings, imapSecure: e.target.checked })
                    }
                    className={`w-full px-4 py-2 rounded-lg ${
                      isDarkMode
                        ? "bg-gray-700 text-white"
                        : "bg-gray-50 text-gray-900"
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Test de connexion</h3>
              <button
                type="button"
                onClick={testConnection}
                className={`w-full px-4 py-2 rounded-lg ${
                  isDarkMode
                    ? "bg-gray-700 text-white"
                    : "bg-gray-50 text-gray-900"
                }`}
              >
                {isTesting ? "Test en cours..." : "Tester la connexion"}
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Actions</h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="submit"
                  className={`w-full px-4 py-2 rounded-lg ${
                    isDarkMode
                      ? "bg-blue-500 text-white"
                      : "bg-gray-50 text-gray-900"
                  }`}
                >
                  {isSaving ? "Sauvegarder..." : "Sauvegarder"}
                </button>
                <button
                  type="reset"
                  onClick={resetToIonosDefaults}
                  className={`w-full px-4 py-2 rounded-lg ${
                    isDarkMode
                      ? "bg-gray-700 text-white"
                      : "bg-gray-50 text-gray-900"
                  }`}
                >
                  Réinitialiser à la configuration par défaut
                </button>
              </div>
            </div>
          </form>
        </HeadlessDialog.Panel>
      </div>
    </HeadlessDialog>
  );
}
