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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            onClick={() => onContactSelect(contact)}
            className={`p-6 rounded-xl cursor-pointer transition-all duration-200 ${
              isDarkMode
                ? "bg-gray-800 hover:bg-gray-700 hover:shadow-lg hover:shadow-gray-900/20"
                : "bg-white hover:bg-gray-50 hover:shadow-lg hover:shadow-gray-200"
            } shadow-md`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">
                {contact.prenom} {contact.nom}
              </h3>
              <span
                className="px-3 py-1 rounded-full text-sm"
                style={getCategoryStyle(contact.categorie)}
              >
                {contactCategories[contact.categorie]?.label || "Autre"}
              </span>
            </div>
            <div className="space-y-3">
              {contact.email && (
                <div className="flex items-center gap-3 text-base">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/mail/compose?to=${encodeURIComponent(
                        contact.email
                      )}`;
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? "hover:bg-blue-900/30 hover:text-blue-400"
                        : "hover:bg-blue-50 hover:text-blue-600"
                    }`}
                    title="Envoyer un email"
                  >
                    <Mail size={18} className="text-gray-500" />
                  </button>
                  <span className="flex-1 truncate">{contact.email}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(contact.email);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? "hover:bg-blue-900/30 hover:text-blue-400"
                        : "hover:bg-blue-50 hover:text-blue-600"
                    }`}
                    title="Copier l'email"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              )}
              {contact.telephone && (
                <div className="flex items-center gap-3 text-base">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openPhoneDialer(contact.telephone);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? "hover:bg-blue-900/30 hover:text-blue-400"
                        : "hover:bg-blue-50 hover:text-blue-600"
                    }`}
                    title="Appeler"
                  >
                    <Phone size={18} className="text-gray-500" />
                  </button>
                  <span className="flex-1">{contact.telephone}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(contact.telephone);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? "hover:bg-blue-900/30 hover:text-blue-400"
                        : "hover:bg-blue-50 hover:text-blue-600"
                    }`}
                    title="Copier le numéro"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              )}
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
          className={`p-6 rounded-xl cursor-pointer transition-all duration-200 ${
            isDarkMode
              ? "bg-gray-800 hover:bg-gray-700 hover:shadow-lg hover:shadow-gray-900/20"
              : "bg-white hover:bg-gray-50 hover:shadow-lg hover:shadow-gray-200"
          } shadow-md`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-medium">
                {contact.prenom} {contact.nom}
              </h3>
              <span
                className="px-3 py-1 rounded-full text-sm"
                style={getCategoryStyle(contact.categorie)}
              >
                {contactCategories[contact.categorie]?.label || "Autre"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {contact.email && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(contact.email);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? "hover:bg-blue-900/30 hover:text-blue-400"
                        : "hover:bg-blue-50 hover:text-blue-600"
                    }`}
                    title="Copier l'email"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/mail/compose?to=${encodeURIComponent(
                        contact.email
                      )}`;
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? "hover:bg-blue-900/30 hover:text-blue-400"
                        : "hover:bg-blue-50 hover:text-blue-600"
                    }`}
                    title="Envoyer un email"
                  >
                    <Mail size={18} className="text-gray-500" />
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
                    className={`p-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? "hover:bg-blue-900/30 hover:text-blue-400"
                        : "hover:bg-blue-50 hover:text-blue-600"
                    }`}
                    title="Copier le numéro"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openPhoneDialer(contact.telephone);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? "hover:bg-blue-900/30 hover:text-blue-400"
                        : "hover:bg-blue-50 hover:text-blue-600"
                    }`}
                    title="Appeler"
                  >
                    <Phone size={18} className="text-gray-500" />
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
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Ouvrir dans Google Maps"
                >
                  <MapPin size={16} />
                </button>
              )}
            </div>
          </div>
          <div className="mt-4 space-y-2 text-base text-gray-600 dark:text-gray-400">
            {contact.email && <div>{contact.email}</div>}
            {contact.telephone && <div>{contact.telephone}</div>}
            {contact.entreprise && (
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-gray-500" />
                {contact.entreprise}
              </div>
            )}
            {(contact.adresse || contact.ville) && (
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-gray-500" />
                {[contact.adresse, contact.codePostal, contact.ville]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            )}
            {contact.notes && (
              <div className="mt-2 text-sm italic">{contact.notes}</div>
            )}
          </div>
        </div>
      ))}
      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-2 rounded-lg shadow-lg ${
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
