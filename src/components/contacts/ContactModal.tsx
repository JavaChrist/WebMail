"use client";
import { Fragment, useEffect, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X } from "lucide-react";

// Types et constantes
export const contactCategories = {
  personal: { label: "Personnel", color: "#3b82f6" },
  professional: { label: "Professionnel", color: "#10b981" },
  family: { label: "Famille", color: "#f59e0b" },
  other: { label: "Autre", color: "#6b7280" },
} as const;

export type ContactCategory = keyof typeof contactCategories;

export interface Contact {
  id?: string;
  userId?: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  entreprise?: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  notes?: string;
  categorie: ContactCategory;
}

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (contact: Contact) => void;
  onDelete?: (contact: Contact) => void;
  selectedContact?: Contact;
}

export default function ContactModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  selectedContact,
}: ContactModalProps) {
  const [contact, setContact] = useState<Contact>({
    nom: "",
    prenom: "",
    email: "",
    telephone: "",
    entreprise: "",
    adresse: "",
    codePostal: "",
    ville: "",
    notes: "",
    categorie: "personal",
  });

  useEffect(() => {
    if (selectedContact) {
      setContact(selectedContact);
    } else {
      setContact({
        nom: "",
        prenom: "",
        email: "",
        telephone: "",
        entreprise: "",
        adresse: "",
        codePostal: "",
        ville: "",
        notes: "",
        categorie: "personal",
      });
    }
  }, [selectedContact]);

  // Effet séparé pour réinitialiser le formulaire quand la modal se ferme
  useEffect(() => {
    if (!isOpen) {
      setContact({
        nom: "",
        prenom: "",
        email: "",
        telephone: "",
        entreprise: "",
        adresse: "",
        codePostal: "",
        ville: "",
        notes: "",
        categorie: "personal",
      });
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Formulaire soumis avec les données:", contact);
    if (!contact.nom) {
      console.log("Le nom est manquant");
      return;
    }
    onSave(contact);
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-4 md:p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg md:text-xl font-medium leading-6 text-gray-900 dark:text-white flex justify-between items-center"
                >
                  {selectedContact ? "Modifier le contact" : "Nouveau contact"}
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <X size={24} />
                  </button>
                </Dialog.Title>

                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Nom *
                      </label>
                      <input
                        type="text"
                        required
                        value={contact.nom}
                        onChange={(e) =>
                          setContact({ ...contact, nom: e.target.value })
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Prénom
                      </label>
                      <input
                        type="text"
                        value={contact.prenom}
                        onChange={(e) =>
                          setContact({ ...contact, prenom: e.target.value })
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Email
                      </label>
                      <input
                        type="email"
                        value={contact.email}
                        onChange={(e) =>
                          setContact({ ...contact, email: e.target.value })
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Téléphone
                      </label>
                      <input
                        type="tel"
                        value={contact.telephone}
                        onChange={(e) =>
                          setContact({ ...contact, telephone: e.target.value })
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Entreprise
                    </label>
                    <input
                      type="text"
                      value={contact.entreprise}
                      onChange={(e) =>
                        setContact({ ...contact, entreprise: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Adresse
                    </label>
                    <input
                      type="text"
                      value={contact.adresse}
                      onChange={(e) =>
                        setContact({ ...contact, adresse: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Code postal
                      </label>
                      <input
                        type="text"
                        value={contact.codePostal}
                        onChange={(e) =>
                          setContact({ ...contact, codePostal: e.target.value })
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Ville
                      </label>
                      <input
                        type="text"
                        value={contact.ville}
                        onChange={(e) =>
                          setContact({ ...contact, ville: e.target.value })
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Catégorie
                    </label>
                    <select
                      value={contact.categorie}
                      onChange={(e) =>
                        setContact({
                          ...contact,
                          categorie: e.target.value as ContactCategory,
                        })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      {Object.entries(contactCategories).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Notes
                    </label>
                    <textarea
                      value={contact.notes}
                      onChange={(e) =>
                        setContact({ ...contact, notes: e.target.value })
                      }
                      rows={3}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 justify-end mt-6">
                    {selectedContact && onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(selectedContact)}
                        className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Supprimer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      {selectedContact ? "Mettre à jour" : "Créer"}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
