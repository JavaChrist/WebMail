import { useState, useEffect } from "react";
import { X, Save, Trash2 } from "lucide-react";

export interface EmailAccount {
  id?: string;
  userId: string;
  email: string;
  password: string;
  smtpServer: string;
  smtpPort: number;
  imapServer: string;
  imapPort: number;
  useSSL: boolean;
  useTLS: boolean;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface EmailAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (account: EmailAccount) => Promise<void>;
  onDelete?: (account: EmailAccount) => Promise<void>;
  selectedAccount?: EmailAccount;
}

export default function EmailAccountModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  selectedAccount,
}: EmailAccountModalProps) {
  const [account, setAccount] = useState<EmailAccount>({
    userId: "",
    email: "",
    password: "",
    smtpServer: "",
    smtpPort: 587,
    imapServer: "",
    imapPort: 993,
    useSSL: true,
    useTLS: true,
    name: "",
  });

  useEffect(() => {
    if (selectedAccount) {
      setAccount(selectedAccount);
    } else {
      setAccount({
        userId: "",
        email: "",
        password: "",
        smtpServer: "",
        smtpPort: 587,
        imapServer: "",
        imapPort: 993,
        useSSL: true,
        useTLS: true,
        name: "",
      });
    }
  }, [selectedAccount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(account);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            {selectedAccount ? "Modifier le compte" : "Nouveau compte email"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Nom du compte
            </label>
            <input
              type="text"
              value={account.name}
              onChange={(e) => setAccount({ ...account, name: e.target.value })}
              className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Adresse email
            </label>
            <input
              type="email"
              value={account.email}
              onChange={(e) =>
                setAccount({ ...account, email: e.target.value })
              }
              className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              value={account.password}
              onChange={(e) =>
                setAccount({ ...account, password: e.target.value })
              }
              className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Serveur SMTP
              </label>
              <input
                type="text"
                value={account.smtpServer}
                onChange={(e) =>
                  setAccount({ ...account, smtpServer: e.target.value })
                }
                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Port SMTP
              </label>
              <input
                type="number"
                value={account.smtpPort}
                onChange={(e) =>
                  setAccount({ ...account, smtpPort: parseInt(e.target.value) })
                }
                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Serveur IMAP
              </label>
              <input
                type="text"
                value={account.imapServer}
                onChange={(e) =>
                  setAccount({ ...account, imapServer: e.target.value })
                }
                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Port IMAP
              </label>
              <input
                type="number"
                value={account.imapPort}
                onChange={(e) =>
                  setAccount({ ...account, imapPort: parseInt(e.target.value) })
                }
                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                required
              />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={account.useSSL}
                onChange={(e) =>
                  setAccount({ ...account, useSSL: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-sm">Utiliser SSL</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={account.useTLS}
                onChange={(e) =>
                  setAccount({ ...account, useTLS: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-sm">Utiliser TLS</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            {selectedAccount && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(selectedAccount)}
                className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                Supprimer
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Save size={16} />
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
