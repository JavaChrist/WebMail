"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider } from "@/context/ThemeContext";
import ServiceWorkerRegister from "./ServiceWorkerRegister";
import AppTopBar from "@/components/AppTopBar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullScreen = pathname === "/email";
  const isAuthPage = pathname === "/login" || pathname === "/register";

  return (
    <ThemeProvider>
      <ServiceWorkerRegister />
      {isAuthPage ? (
        // Pages d'authentification : aucune barre (rendu nu).
        children
      ) : isFullScreen ? (
        // Page mail : plein écran, MailLayout gère sa propre barre.
        <main className="min-h-[100dvh]">{children}</main>
      ) : (
        // Autres pages : barre du haut applicative + contenu pleine largeur.
        <div className="flex flex-col min-h-[100dvh]">
          <AppTopBar />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      )}
    </ThemeProvider>
  );
}
