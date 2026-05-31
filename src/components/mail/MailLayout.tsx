"use client";

import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useMail } from "@/context/MailContext";
import MailTopBar from "./MailTopBar";
import MailSidebar from "./MailSidebar";
import MailMessageList from "./MailMessageList";
import MailMessageView from "./MailMessageView";
import MailComposeModal from "./MailComposeModal";

export default function MailLayout() {
  const { isDarkMode } = useTheme();
  const { selectedMessage, toast } = useMail();
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
      className={`flex flex-col h-screen w-full overflow-hidden ${
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

        {/* Zone liste + détail */}
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
