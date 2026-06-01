"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu,
  PanelLeftClose,
  Home,
  Mail,
  Calendar,
  Users,
  Search,
  ChevronDown,
  Bell,
  RefreshCw,
  HelpCircle,
  Settings,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useMail } from "@/context/MailContext";
import { auth } from "@/config/firebase";

interface MailTopBarProps {
  onToggleSidebar: () => void;
}

const NAV_ITEMS = [
  { href: "/app", icon: Home, label: "Accueil" },
  { href: "/calendar", icon: Calendar, label: "Calendrier" },
  { href: "/email", icon: Mail, label: "Emails" },
  { href: "/contacts", icon: Users, label: "Contacts" },
];

const APP_MENU_WIDTH = 240;

export default function MailTopBar({ onToggleSidebar }: MailTopBarProps) {
  const { isDarkMode, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const {
    searchTerm,
    setSearchTerm,
    syncing,
    syncActiveAccount,
    totalUnread,
  } = useMail();

  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const openAppMenu = () => {
    const rect = menuBtnRef.current?.getBoundingClientRect();
    if (rect) {
      const margin = 8;
      let left = rect.left;
      if (left + APP_MENU_WIDTH > window.innerWidth - margin) {
        left = window.innerWidth - margin - APP_MENU_WIDTH;
      }
      if (left < margin) left = margin;
      setMenuPos({ top: rect.bottom + 6, left });
    }
    setAppMenuOpen(true);
  };

  useEffect(() => {
    if (!appMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAppMenuOpen(false);
    };
    const close = () => setAppMenuOpen(false);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [appMenuOpen]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
    }
  };

  const iconBtn = `p-2 rounded-lg transition-colors ${
    isDarkMode ? "hover:bg-gray-800 text-gray-300" : "hover:bg-gray-100 text-gray-600"
  }`;

  return (
    <header
      className={`flex items-center gap-2 h-14 px-3 border-b flex-shrink-0 ${
        isDarkMode
          ? "bg-gray-900 border-gray-800 text-gray-100"
          : "bg-white border-gray-200 text-gray-900"
      }`}
    >
      {/* Gauche : menu de navigation de l'application (hamburger) */}
      <button
        ref={menuBtnRef}
        type="button"
        onClick={() => (appMenuOpen ? setAppMenuOpen(false) : openAppMenu())}
        title="Menu de navigation"
        aria-label="Menu de navigation de l'application"
        aria-expanded={appMenuOpen}
        className={iconBtn}
      >
        <Menu size={20} />
      </button>

      {/* Contrôle distinct : replier / déplier la liste des dossiers */}
      <button
        type="button"
        onClick={onToggleSidebar}
        title="Replier / déplier les dossiers"
        aria-label="Replier ou déplier le panneau des dossiers"
        className={iconBtn}
      >
        <PanelLeftClose size={20} />
      </button>

      <Link href="/app" className="flex items-center gap-2 mr-1">
        <Image
          src="/logo-96x96.png"
          alt="WebMail"
          width={28}
          height={28}
          className="rounded"
          priority
        />
        <span className="hidden sm:inline font-bold text-lg tracking-tight">
          WebMail
        </span>
      </Link>

      {/* Navigation modules */}
      <nav className="flex items-center gap-0.5 ml-1">
        <Link href="/email" title="Emails" className={`relative ${iconBtn} text-blue-600`}>
          <Mail size={20} />
          {totalUnread > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
          )}
        </Link>
        <Link href="/calendar" title="Calendrier" className={iconBtn}>
          <Calendar size={20} />
        </Link>
        <Link href="/contacts" title="Contacts" className={iconBtn}>
          <Users size={20} />
        </Link>
      </nav>

      {/* Recherche centrale */}
      <div className="flex-1 flex justify-center px-2">
        <div className="relative w-full max-w-2xl">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher parmi les courriels"
            className={`w-full pl-10 pr-9 py-2 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDarkMode
                ? "bg-gray-800 placeholder-gray-500"
                : "bg-gray-100 placeholder-gray-400"
            }`}
          />
          <ChevronDown
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none"
          />
        </div>
      </div>

      {/* Droite : actions globales */}
      <div className="flex items-center gap-0.5">
        <button type="button" title="Notifications" className={iconBtn}>
          <Bell size={20} />
        </button>
        <button
          type="button"
          onClick={syncActiveAccount}
          disabled={syncing}
          title="Synchroniser"
          className={`${iconBtn} ${syncing ? "opacity-50" : ""}`}
        >
          <RefreshCw size={20} className={syncing ? "animate-spin" : ""} />
        </button>
        <button type="button" title="Aide" className={`hidden sm:inline-flex ${iconBtn}`}>
          <HelpCircle size={20} />
        </button>
        <Link href="/email/accounts" title="Paramètres" className={iconBtn}>
          <Settings size={20} />
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          title="Déconnexion"
          className={`${iconBtn} hover:text-red-500`}
        >
          <LogOut size={20} />
        </button>
      </div>

      {/* Menu de navigation de l'application (portail, au-dessus de tout) */}
      {appMenuOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[190]"
              onClick={() => setAppMenuOpen(false)}
            />
            <div
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                width: APP_MENU_WIDTH,
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
                    onClick={() => setAppMenuOpen(false)}
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

              <div
                className={`my-1.5 border-t ${
                  isDarkMode ? "border-gray-700" : "border-gray-200"
                }`}
              />

              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                  setAppMenuOpen(false);
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
                  setAppMenuOpen(false);
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
    </header>
  );
}
