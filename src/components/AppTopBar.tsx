"use client";

import Link from "next/link";
import Image from "next/image";
import { useTheme } from "@/context/ThemeContext";
import AppNavMenu from "./AppNavMenu";

/**
 * Barre du haut applicative (pages non-mail) : menu hamburger de navigation
 * + logo WebMail. Remplace l'ancienne Sidebar globale de gauche.
 */
export default function AppTopBar() {
  const { isDarkMode } = useTheme();

  return (
    <header
      className={`sticky top-0 z-40 flex items-center gap-2 min-h-[3.5rem] px-2 sm:px-4 pt-safe border-b flex-shrink-0 ${
        isDarkMode
          ? "bg-gray-900 border-gray-800 text-gray-100"
          : "bg-white border-gray-200 text-gray-900"
      }`}
    >
      <AppNavMenu />
      <Link href="/app" className="flex items-center gap-2 min-w-0">
        <Image
          src="/icone/logo96.png"
          alt="WebMail"
          width={28}
          height={28}
          className="rounded flex-shrink-0"
          priority
        />
        <span className="font-bold text-lg tracking-tight truncate">WebMail</span>
      </Link>
    </header>
  );
}
