"use client";

import { Search, RefreshCw, Paperclip } from "lucide-react";
import { format, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { useTheme } from "@/context/ThemeContext";
import { useMail } from "@/context/MailContext";

function formatDate(date: Date): string {
  if (isToday(date)) return format(date, "HH:mm", { locale: fr });
  return format(date, "d MMM yyyy", { locale: fr });
}

export default function MailSearchResults() {
  const { isDarkMode } = useTheme();
  const {
    searchResults,
    searchLoading,
    searchTerm,
    selectedMessage,
    openMessage,
    accounts,
    folderMap,
  } = useMail();

  return (
    <div
      className={`flex flex-col h-full border-r ${
        isDarkMode
          ? "bg-gray-900 border-gray-800 text-gray-100"
          : "bg-white border-gray-200 text-gray-900"
      }`}
    >
      <div
        className={`flex items-center gap-2 px-4 py-2.5 border-b flex-shrink-0 ${
          isDarkMode ? "border-gray-800" : "border-gray-200"
        }`}
      >
        <Search size={18} className="opacity-60 flex-shrink-0" />
        <div className="min-w-0">
          <h2 className="font-semibold text-lg truncate leading-tight">
            Résultats de recherche
          </h2>
          <p className="text-xs opacity-60 truncate">
            {searchLoading
              ? "Recherche en cours…"
              : `${searchResults.length} résultat(s) pour « ${searchTerm.trim()} »`}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {searchLoading ? (
          <div className="flex items-center justify-center h-32 opacity-60">
            <RefreshCw size={20} className="animate-spin" />
          </div>
        ) : searchResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 opacity-50 px-6 text-center">
            <Search size={32} />
            <p className="text-sm">Aucun message ne correspond à votre recherche.</p>
          </div>
        ) : (
          <ul
            className={
              isDarkMode ? "divide-y divide-gray-800" : "divide-y divide-gray-100"
            }
          >
            {searchResults.map((message) => {
              const isSelected = selectedMessage?.id === message.id;
              const account = accounts.find((a) => a.id === message.accountId);
              const folderName = folderMap[message.primaryFolderId]?.name;
              return (
                <li
                  key={message.id}
                  onClick={() => openMessage(message)}
                  className={`flex flex-col gap-1 px-4 py-3 cursor-pointer transition-colors ${
                    isSelected
                      ? isDarkMode
                        ? "bg-blue-500/10"
                        : "bg-blue-50"
                      : isDarkMode
                      ? "hover:bg-gray-800/60"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate text-sm ${
                        message.read ? "" : "font-semibold"
                      }`}
                    >
                      {message.from.name || message.from.email || "(inconnu)"}
                    </span>
                    <span className="flex-shrink-0 text-xs opacity-60">
                      {formatDate(message.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {message.hasAttachments && (
                      <Paperclip size={12} className="opacity-50 flex-shrink-0" />
                    )}
                    <span
                      className={`truncate text-sm ${
                        message.read ? "opacity-80" : "font-medium"
                      }`}
                    >
                      {message.subject || "(sans objet)"}
                    </span>
                  </div>
                  <div className="truncate text-xs opacity-50">
                    {message.snippet}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {account && (
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          isDarkMode
                            ? "bg-gray-800 text-gray-300"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {account.displayName}
                      </span>
                    )}
                    {folderName && (
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] ${
                          isDarkMode
                            ? "bg-gray-800 text-gray-400"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {folderName}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
