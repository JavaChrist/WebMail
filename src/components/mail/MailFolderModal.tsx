"use client";

import { useEffect, useState } from "react";
import { X, FolderPlus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import type { MailFolder, MailFolderNode } from "@/types/mail";

export type FolderModalMode = "create" | "rename" | "delete";

interface MailFolderModalProps {
  isOpen: boolean;
  mode: FolderModalMode;
  folder?: MailFolderNode | null;
  /** Parent pré-sélectionné lors d'une création « Nouveau sous-dossier ». */
  presetParentId?: string | null;
  folders: MailFolder[];
  onClose: () => void;
  onCreate: (name: string, parentId: string | null) => Promise<void>;
  onRename: (folderId: string, name: string) => Promise<void>;
  onDelete: (folderId: string) => Promise<void>;
}

export default function MailFolderModal({
  isOpen,
  mode,
  folder,
  presetParentId,
  folders,
  onClose,
  onCreate,
  onRename,
  onDelete,
}: MailFolderModalProps) {
  const { isDarkMode } = useTheme();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSubmitting(false);
    if (mode === "rename" && folder) {
      setName(folder.name);
      setParentId(folder.parentFolderId ?? "");
    } else {
      setName("");
      setParentId(presetParentId ?? "");
    }
  }, [isOpen, mode, folder, presetParentId]);

  if (!isOpen) return null;

  const isSystem = !!folder?.systemFolder;
  const childCount = folder
    ? folders.filter((f) => f.parentFolderId === folder.id).length
    : 0;

  // Parents valides : Archives + tous les dossiers personnalisés (exclut le
  // dossier lui-même). Permet de créer des sous-dossiers dans « Archives ».
  const parentOptions = folders.filter(
    (f) =>
      (f.folderType === "custom" || f.folderType === "archive") &&
      f.id !== folder?.id
  );

  const field = `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDarkMode
      ? "bg-gray-700 text-white border-gray-600"
      : "bg-white text-gray-900 border-gray-300"
  }`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode !== "delete" && !name.trim()) {
      setError("Le nom du dossier est requis");
      return;
    }
    if (mode === "rename" && isSystem) {
      setError("Un dossier système ne peut pas être renommé");
      return;
    }
    if (mode === "delete" && isSystem) {
      setError("Un dossier système ne peut pas être supprimé");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        await onCreate(name.trim(), parentId || null);
      } else if (mode === "rename" && folder) {
        await onRename(folder.id, name.trim());
      } else if (mode === "delete" && folder) {
        await onDelete(folder.id);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  };

  const titles: Record<FolderModalMode, string> = {
    create: "Nouveau dossier",
    rename: "Renommer le dossier",
    delete: "Supprimer le dossier",
  };

  const Icon =
    mode === "create" ? FolderPlus : mode === "rename" ? Pencil : Trash2;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-4">
      <div
        className={`w-full max-w-md rounded-xl p-6 ${
          isDarkMode ? "bg-gray-800 text-white" : "bg-white text-gray-900"
        }`}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Icon size={20} className={mode === "delete" ? "text-red-500" : ""} />
            {titles[mode]}
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
          {mode === "delete" ? (
            <div className="space-y-3">
              <div
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  isDarkMode ? "bg-red-900/20" : "bg-red-50"
                }`}
              >
                <AlertTriangle
                  size={20}
                  className="text-red-500 flex-shrink-0 mt-0.5"
                />
                <div className="text-sm">
                  <p>
                    Voulez-vous vraiment supprimer le dossier «&nbsp;
                    <span className="font-semibold">{folder?.name}</span>&nbsp;» ?
                  </p>
                  {childCount > 0 && (
                    <p className="mt-1 opacity-80">
                      {childCount} sous-dossier(s) seront rattachés à la racine.
                    </p>
                  )}
                  <p className="mt-1 opacity-80">
                    Les messages de ce dossier ne seront plus accessibles depuis
                    l&apos;application.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nom du dossier
                </label>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={field}
                  placeholder="Ex : Factures"
                  disabled={isSystem}
                />
              </div>

              {mode === "create" && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Dossier parent (optionnel)
                  </label>
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className={field}
                  >
                    <option value="">Aucun (racine)</option>
                    {parentOptions.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isSystem && (
                <p className="text-sm text-amber-500">
                  Ce dossier système ne peut pas être modifié.
                </p>
              )}
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-lg text-sm ${
                isDarkMode
                  ? "bg-gray-700 hover:bg-gray-600"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || isSystem}
              className={`px-4 py-2 rounded-lg text-sm text-white disabled:opacity-50 ${
                mode === "delete"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {submitting
                ? "Veuillez patienter…"
                : mode === "create"
                ? "Créer"
                : mode === "rename"
                ? "Renommer"
                : "Supprimer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
