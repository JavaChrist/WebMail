"use client";

import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useMail } from "@/context/MailContext";
import MailTopBar from "./MailTopBar";
import MailSidebar from "./MailSidebar";
import MailMessageList from "./MailMessageList";
import MailMessageView from "./MailMessageView";
import MailComposeModal from "./MailComposeModal";
import MailSearchResults from "./MailSearchResults";

export default function MailLayout() {
  const { isDarkMode } = useTheme();
  const { selectedMessage, toast, viewMode, searchActive } = useMail();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleSidebar = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setMobileOpen((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  };

  return (
    <div
      className={`flex flex-col h-[100dvh] w-full overflow-hidden ${
        isDarkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      <MailTopBar onToggleSidebar={toggleSidebar} />

      <div className="relative flex flex-1 min-h-0">
        {/* Overlay mobile */}
        {mobileOpen && (
          <div
            className="absolute inset-0 bg-black/40 z-20 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar (rail repliable sur desktop, tiroir sur mobile) */}
        <div
          className={`absolute md:relative top-0 bottom-0 left-0 z-30 h-full transition-transform ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0`}
        >
          <MailSidebar collapsed={collapsed} />
        </div>

        {/* Recherche active : résultats agrégés multi-comptes en pleine largeur,
            remplacés par la vue message au clic (bouton retour). */}
        {searchActive ? (
          <div className="flex-1 flex min-w-0">
            <div
              className={`flex-1 min-w-0 ${
                selectedMessage ? "hidden" : "flex flex-col"
              }`}
            >
              <MailSearchResults />
            </div>
            <div
              className={`flex-1 min-w-0 ${
                selectedMessage ? "flex flex-col" : "hidden"
              }`}
            >
              <MailMessageView />
            </div>
          </div>
        ) : /* Zone liste + détail selon le mode d'affichage.
            « Liste seule » est le mode par défaut ET le repli pour toute
            valeur inattendue, afin que la zone centrale ne soit jamais vide. */
        viewMode === "right" ? (
          <div className="flex-1 flex min-w-0">
            <div
              className={`w-full lg:w-[400px] flex-shrink-0 ${
                selectedMessage ? "hidden lg:flex lg:flex-col" : "flex flex-col"
              }`}
            >
              <MailMessageList />
            </div>
            <div
              className={`flex-1 min-w-0 ${
                selectedMessage ? "flex flex-col" : "hidden lg:flex lg:flex-col"
              }`}
            >
              <MailMessageView />
            </div>
          </div>
        ) : viewMode === "bottom" ? (
          <div className="flex-1 flex flex-col min-w-0">
            <div
              className={`min-h-0 ${
                selectedMessage
                  ? `hidden md:flex md:flex-col md:h-1/2 md:border-b ${
                      isDarkMode ? "md:border-gray-800" : "md:border-gray-200"
                    }`
                  : "flex flex-col flex-1"
              }`}
            >
              <MailMessageList />
            </div>
            <div
              className={`min-h-0 ${
                selectedMessage
                  ? "flex flex-col flex-1 md:h-1/2 md:flex-none"
                  : "hidden"
              }`}
            >
              <MailMessageView />
            </div>
          </div>
        ) : (
          // Mode « Liste seule » (défaut) : la liste occupe toute la largeur ;
          // la vue message la remplace en plein écran quand un message est ouvert.
          <div className="flex-1 flex min-w-0">
            <div
              className={`flex-1 min-w-0 ${
                selectedMessage ? "hidden" : "flex flex-col"
              }`}
            >
              <MailMessageList />
            </div>
            <div
              className={`flex-1 min-w-0 ${
                selectedMessage ? "flex flex-col" : "hidden"
              }`}
            >
              <MailMessageView />
            </div>
          </div>
        )}
      </div>

      <MailComposeModal />

      {toast && (
        <div className="fixed bottom-4 right-4 z-[110]">
          <div
            className={`px-4 py-2.5 rounded-lg shadow-lg text-white text-sm ${
              toast.type === "success" ? "bg-blue-600" : "bg-red-500"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
