"use client";
import { Mail, Phone, Building2, MapPin, Copy } from "lucide-react";
import { Contact, contactCategories, ContactCategory } from "./ContactModal";
import { useState } from "react";

interface ContactListProps {
  contacts: Contact[];
  onContactSelect: (contact: Contact) => void;
  viewMode: "grid" | "list";
  isDarkMode?: boolean;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

export default function ContactList({
  contacts,
  onContactSelect,
  viewMode,
  isDarkMode = true,
}: ContactListProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${text} copié avec succès !`);
    } catch (err) {
      console.error("Erreur lors de la copie:", err);
      showToast("Erreur lors de la copie", "error");
    }
  };

  const openGoogleMaps = (
    address: string,
    city: string,
    postalCode: string
  ) => {
    const query = encodeURIComponent(`${address}, ${postalCode} ${city}`);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    window.open(url, "_blank");
  };

  const openPhoneDialer = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  if (contacts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
          Aucun contact trouvé
        </p>
      </div>
    );
  }

  const getCategoryStyle = (categorie: ContactCategory) => {
    const category = contactCategories[categorie];
    return {
      backgroundColor: category?.color || contactCategories.other.color,
      color: "white",
    };
  };

  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            onClick={() => onContactSelect(contact)}
            className={`p-4 sm:p-6 rounded-xl cursor-pointer transition-all duration-200 ${
              isDarkMode
                ? "bg-gray-900 hover:bg-gray-800 hover:shadow-lg hover:shadow-gray-900/30 border border-gray-700"
                : "bg-white hover:bg-gray-50 hover:shadow-lg hover:shadow-gray-200 border border-gray-200"
            } shadow-md`}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-base sm:text-lg font-medium truncate">
                  {contact.prenom} {contact.nom}
                </h3>
                <span
                  className="px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm ml-2"
                  style={getCategoryStyle(contact.categorie)}
                >
                  {contactCategories[contact.categorie]?.label || "Autre"}
                </span>
              </div>
              <div className="space-y-2 sm:space-y-3 mt-auto">
                {contact.email && (
                  <div className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `/mail/compose?to=${encodeURIComponent(
                          contact.email
                        )}`;
                      }}
                      className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                        isDarkMode
                          ? "hover:bg-blue-900/30 hover:text-blue-400"
                          : "hover:bg-blue-50 hover:text-blue-600"
                      }`}
                      title="Envoyer un email"
                    >
                      <Mail size={16} className="text-gray-500" />
                    </button>
                    <span className="flex-1 truncate">{contact.email}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(contact.email);
                      }}
                      className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                        isDarkMode
                          ? "hover:bg-blue-900/30 hover:text-blue-400"
                          : "hover:bg-blue-50 hover:text-blue-600"
                      }`}
                      title="Copier l'email"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                )}
                {contact.telephone && (
                  <div className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openPhoneDialer(contact.telephone);
                      }}
                      className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                        isDarkMode
                          ? "hover:bg-blue-900/30 hover:text-blue-400"
                          : "hover:bg-blue-50 hover:text-blue-600"
                      }`}
                      title="Appeler"
                    >
                      <Phone size={16} className="text-gray-500" />
                    </button>
                    <span className="flex-1 truncate">{contact.telephone}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(contact.telephone);
                      }}
                      className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                        isDarkMode
                          ? "hover:bg-blue-900/30 hover:text-blue-400"
                          : "hover:bg-blue-50 hover:text-blue-600"
                      }`}
                      title="Copier le numéro"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {contacts.map((contact) => (
        <div
          key={contact.id}
          onClick={() => onContactSelect(contact)}
          className={`p-4 sm:p-6 rounded-xl cursor-pointer transition-all duration-200 ${
            isDarkMode
              ? "bg-gray-900 hover:bg-gray-800 hover:shadow-lg hover:shadow-gray-900/30 border border-gray-700"
              : "bg-white hover:bg-gray-50 hover:shadow-lg hover:shadow-gray-200 border border-gray-200"
          } shadow-md`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4">
              <h3 className="text-base sm:text-lg font-medium">
                {contact.prenom} {contact.nom}
              </h3>
              <span
                className="px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm"
                style={getCategoryStyle(contact.categorie)}
              >
                {contactCategories[contact.categorie]?.label || "Autre"}
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              {contact.email && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(contact.email);
                    }}
                    className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? "hover:bg-blue-900/30 hover:text-blue-400"
                        : "hover:bg-blue-50 hover:text-blue-600"
                    }`}
                    title="Copier l'email"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/mail/compose?to=${encodeURIComponent(
                        contact.email
                      )}`;
                    }}
                    className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? "hover:bg-blue-900/30 hover:text-blue-400"
                        : "hover:bg-blue-50 hover:text-blue-600"
                    }`}
                    title="Envoyer un email"
                  >
                    <Mail size={16} className="text-gray-500" />
                  </button>
                </>
              )}
              {contact.telephone && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(contact.telephone);
                    }}
                    className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? "hover:bg-blue-900/30 hover:text-blue-400"
                        : "hover:bg-blue-50 hover:text-blue-600"
                    }`}
                    title="Copier le numéro"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openPhoneDialer(contact.telephone);
                    }}
                    className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? "hover:bg-blue-900/30 hover:text-blue-400"
                        : "hover:bg-blue-50 hover:text-blue-600"
                    }`}
                    title="Appeler"
                  >
                    <Phone size={16} className="text-gray-500" />
                  </button>
                </>
              )}
              {(contact.adresse || contact.ville) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      contact.adresse &&
                      contact.ville &&
                      contact.codePostal
                    ) {
                      openGoogleMaps(
                        contact.adresse,
                        contact.ville,
                        contact.codePostal
                      );
                    }
                  }}
                  className="p-1.5 sm:p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Ouvrir dans Google Maps"
                >
                  <MapPin size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
            {contact.email && <div className="truncate">{contact.email}</div>}
            {contact.telephone && (
              <div className="truncate">{contact.telephone}</div>
            )}
            {contact.entreprise && (
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-gray-500" />
                <span className="truncate">{contact.entreprise}</span>
              </div>
            )}
            {(contact.adresse || contact.ville) && (
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-gray-500" />
                <span className="truncate">
                  {[contact.adresse, contact.codePostal, contact.ville]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
            )}
            {contact.notes && (
              <div className="mt-2 text-xs sm:text-sm italic truncate">
                {contact.notes}
              </div>
            )}
          </div>
        </div>
      ))}
      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg shadow-lg text-sm sm:text-base ${
              toast.type === "success"
                ? "bg-green-500 text-white"
                : "bg-red-500 text-white"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
