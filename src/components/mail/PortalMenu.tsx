"use client";

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/context/ThemeContext";

interface PortalMenuProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
}

/**
 * Menu déroulant rendu dans un PORTAL (document.body, position fixed) pour ne
 * jamais être coupé par un conteneur en overflow. Se ferme au clic extérieur,
 * sur Échap, au scroll et au resize. Flip vers le haut si pas de place dessous.
 */
export default function PortalMenu({
  open,
  anchorRef,
  onClose,
  width = 232,
  children,
}: PortalMenuProps) {
  const { isDarkMode } = useTheme();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const estHeight = 340;
    let top = rect.bottom + 4;
    if (top + estHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - estHeight - 4);
    }
    let left = rect.right - width;
    if (left < margin) left = margin;
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - margin - width;
    }
    setPos({ top, left });
  }, [open, anchorRef, width]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const close = () => onClose();
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open, onClose]);

  if (!open || pos === null || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[190]" onClick={onClose} />
      <div
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          width,
          zIndex: 200,
          maxHeight: "70vh",
          overflowY: "auto",
        }}
        className={`rounded-lg shadow-xl border py-1 text-sm ${
          isDarkMode
            ? "bg-gray-800 border-gray-700 text-gray-100"
            : "bg-white border-gray-200 text-gray-900"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

export function MenuItem({
  onClick,
  disabled = false,
  danger = false,
  icon,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  icon?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
}) {
  const { isDarkMode } = useTheme();
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left disabled:opacity-40 disabled:cursor-not-allowed ${
        danger ? "text-red-500" : ""
      } ${
        disabled
          ? ""
          : isDarkMode
          ? "hover:bg-gray-700"
          : "hover:bg-gray-100"
      }`}
    >
      {icon}
      <span className="flex-1">{children}</span>
    </button>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-1.5 text-xs font-semibold opacity-60">{children}</div>
  );
}

export function MenuSeparator() {
  const { isDarkMode } = useTheme();
  return (
    <div
      className={`my-1 border-t ${
        isDarkMode ? "border-gray-700" : "border-gray-200"
      }`}
    />
  );
}
