"use client";

import { useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import type { MailMessage, MailAddress } from "@/types/mail";

function addr(a: MailAddress): string {
  return a.name ? `${a.name} <${a.email}>` : a.email;
}
function addrs(list?: MailAddress[]): string {
  return (list ?? []).map(addr).join(", ");
}

function buildSource(m: MailMessage): string {
  const headers = [
    `De      : ${addr(m.from)}`,
    `À       : ${addrs(m.to) || "—"}`,
    m.cc && m.cc.length ? `Cc      : ${addrs(m.cc)}` : null,
    `Objet   : ${m.subject || "(sans objet)"}`,
    `Date    : ${m.timestamp.toLocaleString("fr-FR")}`,
    m.messageId ? `Message-ID : ${m.messageId}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const body = m.contentHtml || m.contentText || "(message vide)";
  return `${headers}\n\n--- HTML / Contenu brut ---\n\n${body}`;
}

interface MailSourceModalProps {
  message: MailMessage | null;
  onClose: () => void;
}

export default function MailSourceModal({
  message,
  onClose,
}: MailSourceModalProps) {
  const { isDarkMode } = useTheme();
  const [copied, setCopied] = useState(false);

  if (!message) return null;
  const source = buildSource(message);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible */
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-4">
      <div
        className={`w-full max-w-3xl max-h-[85vh] flex flex-col rounded-xl ${
          isDarkMode ? "bg-gray-800 text-white" : "bg-white text-gray-900"
        }`}
      >
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isDarkMode ? "border-gray-700" : "border-gray-200"
          }`}
        >
          <h2 className="text-lg font-semibold">Source du message</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
                isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
              }`}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copié" : "Copier"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-black/10"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <pre
            className={`text-xs whitespace-pre-wrap break-all font-mono p-3 rounded-lg ${
              isDarkMode ? "bg-gray-900" : "bg-gray-50"
            }`}
          >
            {source}
          </pre>
        </div>
      </div>
    </div>
  );
}
