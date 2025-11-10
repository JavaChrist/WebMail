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
import { isAuthError, handleAuthError, refreshAuthToken } from "@/utils/authHelper";

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

const emailProviders = {
  ionos: {
    name: "Ionos",
    smtpHost: "smtp.ionos.com",
    smtpPort: 587,
    smtpSecure: false,
    imapHost: "imap.ionos.com",
    imapPort: 993,
    imapSecure: true,
  },
  ionos_fr: {
    name: "Ionos France",
    smtpHost: "smtp.1and1.fr",
    smtpPort: 587,
    smtpSecure: false,
    imapHost: "imap.1and1.fr",
    imapPort: 993,
    imapSecure: true,
  },
  gmail: {
    name: "Gmail",
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpSecure: false,
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecure: true,
  },
  outlook: {
    name: "Outlook/Hotmail",
    smtpHost: "smtp.live.com",
    smtpPort: 587,
    smtpSecure: false,
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapSecure: true,
  },
  yahoo: {
    name: "Yahoo",
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 587,
    smtpSecure: false,
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
    imapSecure: true,
  },
};

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY;

const encryptPassword = (password: string): string => {
  if (!ENCRYPTION_KEY) {
    console.error("❌ La clé de chiffrement n'est pas définie");
    throw new Error("La clé de chiffrement n'est pas définie");
  }
  try {
    console.log(
      "🔑 Tentative de chiffrement avec la clé:",
      ENCRYPTION_KEY.substring(0, 5) + "..."
    );
    const encrypted = CryptoJS.AES.encrypt(password, ENCRYPTION_KEY).toString();
    console.log("✅ Chiffrement réussi");
    return encrypted;
  } catch (error) {
    console.error("❌ Erreur lors du chiffrement:", error);
    throw new Error("Le chiffrement a échoué");
  }
};

const decryptPassword = (encryptedPassword: string): string => {
  if (!ENCRYPTION_KEY) {
    console.error("❌ La clé de chiffrement n'est pas définie");
    throw new Error("La clé de chiffrement n'est pas définie");
  }
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedPassword, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("❌ Erreur lors du déchiffrement:", error);
    throw new Error("Le déchiffrement a échoué");
  }
};

export default function EmailConfig({ isOpen, onClose }: EmailConfigProps) {
  const { isDarkMode } = useTheme();
  const [settings, setSettings] = useState<EmailSettings>({
    email: "",
    emailPassword: "",
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    imapHost: "",
    imapPort: 993,
    imapSecure: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      if (!auth.currentUser) {
        console.log("Utilisateur non authentifié - impossible de charger les paramètres");
        setError("Vous devez être connecté pour accéder aux paramètres email");
        return;
      }

      try {
        console.log("Chargement des paramètres email pour l'utilisateur:", auth.currentUser.uid);
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
            smtpHost: data.smtpServer || "",
            smtpPort: data.smtpPort || 587,
            smtpSecure: data.useSSL || false,
            imapHost: data.imapServer || "",
            imapPort: data.imapPort || 993,
            imapSecure: data.useTLS || false,
          });
        } else {
          console.log("Aucun compte email configuré - paramètres par défaut");
          // Réinitialiser les paramètres si aucun compte n'existe
          setSettings({
            email: "",
            emailPassword: "",
            smtpHost: "",
            smtpPort: 587,
            smtpSecure: false,
            imapHost: "",
            imapPort: 993,
            imapSecure: false,
          });
        }
      } catch (error) {
        console.error("❌ Erreur lors du chargement du compte email:", error);

        if (isAuthError(error)) {
          // Tentative de rafraîchissement du token
          const newToken = await refreshAuthToken();
          if (newToken) {
            // Retry la requête
            try {
              const emailAccountsRef = collection(db, "emailAccounts");
              const q = query(
                emailAccountsRef,
                where("userId", "==", auth.currentUser!.uid)
              );
              const querySnapshot = await getDocs(q);

              if (!querySnapshot.empty) {
                const data = querySnapshot.docs[0].data();
                setSettings({
                  email: data.email || "",
                  emailPassword: data.password ? decryptPassword(data.password) : "",
                  smtpHost: data.smtpServer || "",
                  smtpPort: data.smtpPort || 587,
                  smtpSecure: data.useSSL || false,
                  imapHost: data.imapServer || "",
                  imapPort: data.imapPort || 993,
                  imapSecure: data.useTLS || false,
                });
              }
            } catch (retryError) {
              console.error("Erreur lors de la seconde tentative:", retryError);
              setError("Problème d'authentification persistant - veuillez vous reconnecter");
              await handleAuthError();
            }
          } else {
            setError("Session expirée - veuillez vous reconnecter");
            await handleAuthError();
          }
        } else {
          setError("Erreur lors du chargement des paramètres");
        }
      }
    };

    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const testConnection = async () => {
    if (!auth.currentUser) {
      setError("Vous devez être connecté pour tester la connexion");
      return;
    }

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

    // Fonction helper pour sauvegarder
    const saveConfig = async (retryMode = false) => {
      const emailAccountsRef = collection(db, "emailAccounts");
      const q = query(
        emailAccountsRef,
        where("userId", "==", auth.currentUser!.uid)
      );
      const querySnapshot = await getDocs(q);

      // Récupérer le compte existant
      const existingAccount = querySnapshot.empty
        ? null
        : querySnapshot.docs[0].data();

      // Gérer le mot de passe
      let passwordToSave;
      if (settings.emailPassword) {
        // Si un nouveau mot de passe est fourni, le chiffrer
        console.log("🔐 Chiffrement du nouveau mot de passe");
        passwordToSave = encryptPassword(settings.emailPassword);
      } else if (existingAccount?.password) {
        // Sinon, garder l'ancien mot de passe chiffré
        console.log("🔐 Conservation de l'ancien mot de passe");
        passwordToSave = existingAccount.password;
      } else {
        throw new Error("Le mot de passe est requis");
      }

      const configData = {
        email: settings.email,
        password: passwordToSave,
        smtpServer: settings.smtpHost,
        smtpPort: Number(settings.smtpPort),
        useSSL: Boolean(settings.smtpSecure),
        imapServer: settings.imapHost,
        imapPort: Number(settings.imapPort),
        useTLS: Boolean(settings.imapSecure),
        userId: auth.currentUser!.uid,
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
    };

    try {
      await saveConfig();
    } catch (error) {
      console.error("❌ Erreur lors de la sauvegarde:", error);

      if (isAuthError(error)) {
        // Tentative de rafraîchissement du token et retry
        const newToken = await refreshAuthToken();
        if (newToken) {
          // Retry la sauvegarde
          try {
            await saveConfig(true);
          } catch (retryError) {
            console.error("Erreur lors de la seconde tentative de sauvegarde:", retryError);
            setError("Problème d'authentification persistant - veuillez vous reconnecter");
            await handleAuthError();
          }
        } else {
          setError("Session expirée - veuillez vous reconnecter");
          await handleAuthError();
        }
      } else {
        setError(
          error instanceof Error
            ? error.message
            : "Erreur lors de la sauvegarde de la configuration"
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const applyProviderSettings = (providerKey: keyof typeof emailProviders) => {
    const provider = emailProviders[providerKey];
    setSettings({
      email: settings.email,
      emailPassword: settings.emailPassword,
      smtpHost: provider.smtpHost,
      smtpPort: provider.smtpPort,
      smtpSecure: provider.smtpSecure,
      imapHost: provider.imapHost,
      imapPort: provider.imapPort,
      imapSecure: provider.imapSecure,
    });
    setError(null);
    setSuccess(null);
  };

  const handleClose = () => {
    // Réinitialiser tous les champs
    setSettings({
      email: "",
      emailPassword: "",
      smtpHost: "",
      smtpPort: 587,
      smtpSecure: false,
      imapHost: "",
      imapPort: 993,
      imapSecure: false,
    });
    setError("");
    setSuccess("");
    onClose();
  };

  return (
    <HeadlessDialog
      open={isOpen}
      onClose={handleClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <HeadlessDialog.Panel
          className={`w-full max-w-2xl p-4 md:p-6 rounded-lg shadow-xl ${isDarkMode ? "bg-gray-800 text-white" : "bg-white text-gray-900"
            }`}
        >
          <div className="flex items-center justify-between mb-4">
            <HeadlessDialog.Title className="text-lg md:text-xl font-bold">
              Configuration du compte email
            </HeadlessDialog.Title>
            <button
              onClick={handleClose}
              className={`px-4 py-2 rounded-lg ${isDarkMode
                ? "bg-gray-700 hover:bg-gray-600"
                : "bg-gray-100 hover:bg-gray-200"
                }`}
            >
              Fermer
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) =>
                    setSettings({ ...settings, email: e.target.value })
                  }
                  className={`w-full px-3 py-2 rounded-lg border ${isDarkMode
                    ? "bg-gray-700 text-white border-gray-600"
                    : "bg-white text-gray-900 border-gray-300"
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  required
                />
              </div>

              <div>
                <label
                  className={`block text-sm font-medium mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                >
                  Mot de passe
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
                    className={`w-full px-3 py-2 rounded-lg border ${isDarkMode
                      ? "bg-gray-700 text-white border-gray-600"
                      : "bg-white text-gray-900 border-gray-300"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Paramètres SMTP (envoi)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-700"
                      }`}
                  >
                    Serveur SMTP
                  </label>
                  <input
                    type="text"
                    value={settings.smtpHost}
                    onChange={(e) =>
                      setSettings({ ...settings, smtpHost: e.target.value })
                    }
                    className={`w-full px-3 py-2 rounded-lg border ${isDarkMode
                      ? "bg-gray-700 text-white border-gray-600"
                      : "bg-white text-gray-900 border-gray-300"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    required
                  />
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-700"
                      }`}
                  >
                    Port SMTP
                  </label>
                  <input
                    type="number"
                    value={settings.smtpPort}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        smtpPort: Number(e.target.value),
                      })
                    }
                    className={`w-full px-3 py-2 rounded-lg border ${isDarkMode
                      ? "bg-gray-700 text-white border-gray-600"
                      : "bg-white text-gray-900 border-gray-300"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.smtpSecure}
                  onChange={(e) =>
                    setSettings({ ...settings, smtpSecure: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label
                  className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                >
                  Utiliser SSL/TLS
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">
                Paramètres IMAP (réception)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-700"
                      }`}
                  >
                    Serveur IMAP
                  </label>
                  <input
                    type="text"
                    value={settings.imapHost}
                    onChange={(e) =>
                      setSettings({ ...settings, imapHost: e.target.value })
                    }
                    className={`w-full px-3 py-2 rounded-lg border ${isDarkMode
                      ? "bg-gray-700 text-white border-gray-600"
                      : "bg-white text-gray-900 border-gray-300"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    required
                  />
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-700"
                      }`}
                  >
                    Port IMAP
                  </label>
                  <input
                    type="number"
                    value={settings.imapPort}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        imapPort: Number(e.target.value),
                      })
                    }
                    className={`w-full px-3 py-2 rounded-lg border ${isDarkMode
                      ? "bg-gray-700 text-white border-gray-600"
                      : "bg-white text-gray-900 border-gray-300"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.imapSecure}
                  onChange={(e) =>
                    setSettings({ ...settings, imapSecure: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label
                  className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                >
                  Utiliser SSL/TLS
                </label>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-100 text-green-700 rounded-lg text-sm">
                {success}
              </div>
            )}

            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                Configurations prédéfinies :
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(emailProviders).map(([key, provider]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyProviderSettings(key as keyof typeof emailProviders)}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${isDarkMode
                      ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                      }`}
                  >
                    {provider.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-end">
              <button
                type="button"
                onClick={testConnection}
                disabled={isTesting}
                className={`px-4 py-2 rounded-lg ${isDarkMode
                  ? "bg-gray-700 hover:bg-gray-600"
                  : "bg-gray-100 hover:bg-gray-200"
                  } disabled:opacity-50`}
              >
                {isTesting ? "Test en cours..." : "Tester la connexion"}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </form>
        </HeadlessDialog.Panel>
      </div>
    </HeadlessDialog>
  );
}
