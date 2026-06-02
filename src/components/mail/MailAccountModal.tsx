"use client";

import { useEffect, useState } from "react";
import { X, Save, Trash2, Eye, EyeOff, Eraser } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { auth } from "@/config/firebase";
import type { MailAccount, SignatureData } from "@/types/mail";
import { ACCOUNT_COLORS, DEFAULT_ACCOUNT_COLOR } from "@/lib/mail/constants";
import MailSignatureEditor from "./MailSignatureEditor";

export interface MailAccountFormValues {
  email: string;
  displayName: string;
  password: string;
  signature: string;
  signatureData: SignatureData | null;
  imapServer: string;
  imapPort: number;
  imapSecure: boolean;
  smtpServer: string;
  smtpPort: number;
  smtpSecure: boolean;
  color: string;
}

interface MailAccountModalProps {
  isOpen: boolean;
  account?: MailAccount | null;
  onClose: () => void;
  onSave: (values: MailAccountFormValues) => Promise<void>;
  onDelete?: (account: MailAccount) => Promise<void>;
}

const empty: MailAccountFormValues = {
  email: "",
  displayName: "",
  password: "",
  signature: "",
  signatureData: null,
  imapServer: "imap.ionos.fr",
  imapPort: 993,
  imapSecure: true,
  smtpServer: "smtp.ionos.fr",
  smtpPort: 587,
  smtpSecure: false,
  color: DEFAULT_ACCOUNT_COLOR,
};

export default function MailAccountModal({
  isOpen,
  account,
  onClose,
  onSave,
  onDelete,
}: MailAccountModalProps) {
  const { isDarkMode } = useTheme();
  const [values, setValues] = useState<MailAccountFormValues>(empty);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) {
      setValues({
        email: account.email,
        displayName: account.displayName,
        password: "",
        signature: account.signature ?? "",
        signatureData: account.signatureData ?? null,
        imapServer: account.imapServer,
        imapPort: account.imapPort,
        imapSecure: account.imapSecure,
        smtpServer: account.smtpServer,
        smtpPort: account.smtpPort,
        smtpSecure: account.smtpSecure,
        color: account.color ?? DEFAULT_ACCOUNT_COLOR,
      });
    } else {
      setValues(empty);
    }
  }, [account, isOpen]);

  if (!isOpen) return null;

  const set = <K extends keyof MailAccountFormValues>(
    key: K,
    value: MailAccountFormValues[K]
  ) => setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(values);
    } finally {
      setSaving(false);
    }
  };

  const field = `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDarkMode
      ? "bg-gray-700 text-white border-gray-600"
      : "bg-white text-gray-900 border-gray-300"
  }`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-4 max-sm:p-0">
      <div
        className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl p-6 max-sm:max-w-none max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none max-sm:pt-safe max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] ${
          isDarkMode ? "bg-gray-800 text-white" : "bg-white text-gray-900"
        }`}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold">
            {account ? "Modifier le compte" : "Nouveau compte"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-black/10"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Nom affiché
              </label>
              <input
                type="text"
                value={values.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                className={field}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Adresse email</label>
              <input
                type="email"
                value={values.email}
                onChange={(e) => set("email", e.target.value)}
                className={field}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Mot de passe {account && "(laisser vide pour conserver)"}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={values.password}
                onChange={(e) => set("password", e.target.value)}
                className={field}
                required={!account}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Serveur IMAP</label>
              <input
                type="text"
                value={values.imapServer}
                onChange={(e) => set("imapServer", e.target.value)}
                className={field}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Port IMAP</label>
              <input
                type="number"
                value={values.imapPort}
                onChange={(e) => set("imapPort", Number(e.target.value))}
                className={field}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Serveur SMTP</label>
              <input
                type="text"
                value={values.smtpServer}
                onChange={(e) => set("smtpServer", e.target.value)}
                className={field}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Port SMTP</label>
              <input
                type="number"
                value={values.smtpPort}
                onChange={(e) => set("smtpPort", Number(e.target.value))}
                className={field}
                required
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.imapSecure}
                onChange={(e) => set("imapSecure", e.target.checked)}
              />
              IMAP SSL/TLS
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.smtpSecure}
                onChange={(e) => set("smtpSecure", e.target.checked)}
              />
              SMTP SSL
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Couleur</label>
            <div className="flex gap-2">
              {ACCOUNT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("color", c)}
                  className={`w-7 h-7 rounded-full border-2 ${
                    values.color === c ? "border-blue-500" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium">Signature</label>
              <button
                type="button"
                onClick={() => {
                  set("signature", "");
                  set("signatureData", null);
                }}
                disabled={!values.signature && !values.signatureData}
                title="Vide uniquement le champ signature (ne supprime pas le compte)"
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg disabled:opacity-40 ${
                  isDarkMode
                    ? "text-gray-300 hover:bg-gray-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Eraser size={14} />
                Effacer la signature
              </button>
            </div>
            <MailSignatureEditor
              value={values.signature}
              data={values.signatureData}
              onChange={(html, sigData) => {
                set("signature", html);
                set("signatureData", sigData);
              }}
              userId={auth.currentUser?.uid ?? null}
              accountId={account?.id ?? null}
            />
          </div>

          <div
            className={`flex flex-wrap items-center justify-between gap-2 pt-3 mt-2 border-t ${
              isDarkMode ? "border-gray-700" : "border-gray-200"
            }`}
          >
            <div>
              {account && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(account)}
                  className="px-4 py-2 rounded-lg border border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  Supprimer le compte
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 rounded-lg ${
                  isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Save size={16} />
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
