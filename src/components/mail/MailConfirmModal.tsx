"use client";

import { useEffect, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface MailConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  confirmDisabled?: boolean;
  /** Si défini, l'utilisateur doit retaper exactement cette valeur pour activer la confirmation. */
  requireText?: string;
  requireTextLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function MailConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  destructive = false,
  loading = false,
  confirmDisabled = false,
  requireText,
  requireTextLabel,
  onConfirm,
  onCancel,
}: MailConfirmModalProps) {
  const { isDarkMode } = useTheme();
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (isOpen) setTyped("");
  }, [isOpen, requireText]);

  if (!isOpen) return null;

  const textMismatch =
    !!requireText && typed.trim().toLowerCase() !== requireText.trim().toLowerCase();
  const isConfirmDisabled = loading || confirmDisabled || textMismatch;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-4">
      <div
        className={`w-full max-w-md rounded-xl p-6 ${
          isDarkMode ? "bg-gray-800 text-white" : "bg-white text-gray-900"
        }`}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {destructive && (
              <AlertTriangle size={20} className="text-red-500" />
            )}
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-black/10"
          >
            <X size={20} />
          </button>
        </div>

        <div
          className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
            destructive
              ? isDarkMode
                ? "bg-red-900/20"
                : "bg-red-50"
              : isDarkMode
              ? "bg-gray-700/40"
              : "bg-gray-50"
          }`}
        >
          {destructive && (
            <AlertTriangle
              size={18}
              className="text-red-500 flex-shrink-0 mt-0.5"
            />
          )}
          <p>{message}</p>
        </div>

        {requireText && (
          <div className="mt-4">
            {requireTextLabel && (
              <label className="block text-sm mb-1">{requireTextLabel}</label>
            )}
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${
                isDarkMode
                  ? "bg-gray-700 text-white border-gray-600"
                  : "bg-white text-gray-900 border-gray-300"
              }`}
              placeholder={requireText}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-5">
          <button
            type="button"
            onClick={onCancel}
            className={`px-4 py-2 rounded-lg text-sm ${
              isDarkMode
                ? "bg-gray-700 hover:bg-gray-600"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirmDisabled}
            className={`px-4 py-2 rounded-lg text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed ${
              destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Veuillez patienter…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
