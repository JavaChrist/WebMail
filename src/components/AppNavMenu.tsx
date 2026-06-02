"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu,
  Home,
  Calendar,
  Mail,
  Users,
  Settings,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { auth } from "@/config/firebase";

const NAV_ITEMS = [
  { href: "/app", icon: Home, label: "Accueil" },
  { href: "/calendar", icon: Calendar, label: "Calendrier" },
  { href: "/email", icon: Mail, label: "Emails" },
  { href: "/contacts", icon: Users, label: "Contacts" },
];

const MENU_WIDTH = 240;

/**
 * Bouton hamburger + menu de navigation de l'application (rendu en portail).
 * Réutilisé par la barre du haut applicative (AppTopBar) et par la page mail
 * (MailTopBar) afin d'avoir une navigation unifiée.
 */
export default function AppNavMenu({ className }: { className?: string }) {
  const { isDarkMode, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const btnRef = useRef<HTMLButtonElement>(null);

  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const margin = 8;
      let left = rect.left;
      if (left + MENU_WIDTH > window.innerWidth - margin) {
        left = window.innerWidth - margin - MENU_WIDTH;
      }
      if (left < margin) left = margin;
      setPos({ top: rect.bottom + 6, left });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
    }
  };

  const iconBtn =
    className ??
    `p-2 rounded-lg transition-colors ${
      isDarkMode ? "hover:bg-gray-800 text-gray-300" : "hover:bg-gray-100 text-gray-600"
    }`;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        title="Menu de navigation"
        aria-label="Menu de navigation de l'application"
        aria-expanded={open}
        className={iconBtn}
      >
        <Menu size={20} />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[190]"
              onClick={() => setOpen(false)}
            />
            <div
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: MENU_WIDTH,
                zIndex: 200,
              }}
              className={`rounded-lg shadow-xl border py-1.5 text-sm ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700 text-gray-100"
                  : "bg-white border-gray-200 text-gray-900"
              }`}
            >
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2 ${
                      active
                        ? isDarkMode
                          ? "bg-blue-500/15 text-blue-300"
                          : "bg-blue-50 text-blue-700"
                        : isDarkMode
                        ? "hover:bg-gray-700"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    <Icon size={18} />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                );
              })}

              <Link
                href="/email/accounts"
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-2 ${
                  pathname?.startsWith("/email/accounts")
                    ? isDarkMode
                      ? "bg-blue-500/15 text-blue-300"
                      : "bg-blue-50 text-blue-700"
                    : isDarkMode
                    ? "hover:bg-gray-700"
                    : "hover:bg-gray-100"
                }`}
              >
                <Settings size={18} />
                <span className="flex-1">Comptes &amp; signatures</span>
              </Link>

              <div
                className={`my-1.5 border-t ${
                  isDarkMode ? "border-gray-700" : "border-gray-200"
                }`}
              />

              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2 ${
                  isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                }`}
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                <span className="flex-1 text-left">
                  {isDarkMode ? "Mode clair" : "Mode sombre"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  handleLogout();
                }}
                className={`w-full flex items-center gap-3 px-4 py-2 text-red-500 ${
                  isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                }`}
              >
                <LogOut size={18} />
                <span className="flex-1 text-left">Déconnexion</span>
              </button>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
