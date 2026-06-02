"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  PanelLeftClose,
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
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useMail } from "@/context/MailContext";
import { auth } from "@/config/firebase";
import AppNavMenu from "@/components/AppNavMenu";

interface MailTopBarProps {
  onToggleSidebar: () => void;
}

export default function MailTopBar({ onToggleSidebar }: MailTopBarProps) {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const {
    searchTerm,
    setSearchTerm,
    syncing,
    syncActiveAccount,
    totalUnread,
  } = useMail();

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
      className={`flex items-center gap-1 sm:gap-2 h-14 px-2 sm:px-3 pt-safe border-b flex-shrink-0 ${
        isDarkMode
          ? "bg-gray-900 border-gray-800 text-gray-100"
          : "bg-white border-gray-200 text-gray-900"
      }`}
    >
      {/* Gauche : menu de navigation de l'application (hamburger, composant partagé) */}
      <AppNavMenu className={iconBtn} />

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
          src="/icone/logo96.png"
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

      {/* Navigation modules (masqués sur mobile : disponibles dans le menu hamburger) */}
      <nav className="hidden md:flex items-center gap-0.5 ml-1">
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

      {/* Droite : actions globales (réduites sur mobile ; le reste est dans le menu) */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          title="Notifications"
          className={`hidden sm:inline-flex ${iconBtn}`}
        >
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
        <button type="button" title="Aide" className={`hidden md:inline-flex ${iconBtn}`}>
          <HelpCircle size={20} />
        </button>
        <Link
          href="/email/accounts"
          title="Paramètres"
          className={`hidden sm:inline-flex ${iconBtn}`}
        >
          <Settings size={20} />
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          title="Déconnexion"
          className={`hidden md:inline-flex ${iconBtn} hover:text-red-500`}
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
