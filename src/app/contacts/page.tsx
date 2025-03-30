"use client";
import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/config/firebase";
import { Search, Download, LayoutGrid, List, Upload } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "next/navigation";

// Import des composants et types
import ContactList from "@/components/contacts/ContactList";
import ContactModal, {
  Contact,
  ContactCategory,
} from "@/components/contacts/ContactModal";

type SortField = "nom" | "prenom" | "email" | "entreprise" | "ville";
type SortOrder = "asc" | "desc";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

export default function ContactsPage() {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | undefined>();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("nom");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/login");
      } else {
        loadContacts();
      }
    });

    return () => unsubscribe();
  }, [router]);

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

  const loadContacts = async () => {
    if (!auth.currentUser) {
      setIsLoading(false);
      return;
    }

    try {
      const contactsRef = collection(db, "contacts");
      const q = query(contactsRef, where("userId", "==", auth.currentUser.uid));
      const querySnapshot = await getDocs(q);

      const loadedContacts = querySnapshot.docs.map((doc) => {
        const data = doc.data() as Contact;
        return {
          id: doc.id,
          userId: data.userId,
          nom: data.nom || "",
          prenom: data.prenom || "",
          email: data.email || "",
          telephone: data.telephone || "",
          entreprise: data.entreprise || "",
          adresse: data.adresse || "",
          codePostal: data.codePostal || "",
          ville: data.ville || "",
          notes: data.notes || "",
          categorie: (data.categorie === "personal"
            ? "personal"
            : data.categorie || "other") as ContactCategory,
        };
      });

      setContacts(loadedContacts);
      setIsLoading(false);
    } catch (error) {
      console.error("Erreur lors du chargement des contacts:", error);
      setIsLoading(false);
    }
  };

  // Fonction de tri des contacts
  const sortContacts = (a: Contact, b: Contact) => {
    const aValue = a[sortField]?.toLowerCase() || "";
    const bValue = b[sortField]?.toLowerCase() || "";
    return sortOrder === "asc"
      ? aValue.localeCompare(bValue)
      : bValue.localeCompare(aValue);
  };

  // Filtrer les contacts selon le terme de recherche
  const filteredContacts = contacts
    .filter((contact) => {
      const searchTermLower = searchTerm.toLowerCase();
      return (
        contact.nom.toLowerCase().includes(searchTermLower) ||
        contact.prenom.toLowerCase().includes(searchTermLower) ||
        contact.email.toLowerCase().includes(searchTermLower) ||
        contact.entreprise?.toLowerCase().includes(searchTermLower) ||
        contact.ville?.toLowerCase().includes(searchTermLower)
      );
    })
    .sort(sortContacts);

  const handleSaveContact = async (contact: Contact) => {
    console.log("handleSaveContact appelé avec:", contact);

    if (!auth.currentUser) {
      console.log("Utilisateur non connecté");
      showToast("Vous devez être connecté pour créer un contact", "error");
      return;
    }

    try {
      console.log("Tentative de sauvegarde du contact:", contact);

      // Validation du champ nom uniquement
      if (!contact.nom) {
        console.log("Le nom est manquant");
        showToast("Le nom est obligatoire", "error");
        return;
      }

      if (contact.id) {
        // Mise à jour d'un contact existant
        console.log("Mise à jour du contact existant:", contact.id);
        await updateDoc(doc(db, "contacts", contact.id), {
          ...contact,
          userId: auth.currentUser.uid,
          updatedAt: new Date(),
        });
        setContacts((prev) =>
          prev.map((c) => (c.id === contact.id ? contact : c))
        );
        showToast("Contact mis à jour avec succès", "success");
      } else {
        // Création d'un nouveau contact
        console.log("Création d'un nouveau contact");
        const contactData = {
          ...contact,
          userId: auth.currentUser.uid,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        try {
          const docRef = await addDoc(collection(db, "contacts"), contactData);
          console.log("Contact créé avec l'ID:", docRef.id);
          const newContact = { ...contactData, id: docRef.id };
          setContacts((prev) => [...prev, newContact]);
          showToast("Contact créé avec succès", "success");
        } catch (error) {
          console.error("Erreur lors de la création du contact:", error);
          throw error;
        }
      }
      setIsModalOpen(false);
      setSelectedContact(undefined);
    } catch (error) {
      console.error(
        "Erreur détaillée lors de la sauvegarde du contact:",
        error
      );
      showToast(
        error instanceof Error
          ? error.message
          : "Erreur lors de la sauvegarde du contact",
        "error"
      );
    }
  };

  const handleDeleteContact = async (contact: Contact) => {
    if (!contact.id || !auth.currentUser) return;

    try {
      await deleteDoc(doc(db, "contacts", contact.id));
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
      setIsModalOpen(false);
      showToast("Contact supprimé avec succès", "success");
    } catch (error) {
      console.error("Erreur lors de la suppression du contact:", error);
      showToast("Erreur lors de la suppression du contact", "error");
    }
  };

  // Fonction pour exporter les contacts au format vCard
  const exportContacts = () => {
    const vCards = filteredContacts
      .map((contact) => {
        const address = [contact.adresse, contact.codePostal, contact.ville]
          .filter(Boolean)
          .join(", ");

        return `BEGIN:VCARD
VERSION:3.0
N:${contact.nom};${contact.prenom};;;
FN:${contact.prenom} ${contact.nom}
EMAIL:${contact.email}
TEL:${contact.telephone}
${contact.entreprise ? `ORG:${contact.entreprise}\n` : ""}${
          address ? `ADR:;;${address};;;;\n` : ""
        }${contact.notes ? `NOTE:${contact.notes}\n` : ""}END:VCARD
`;
      })
      .join("\n");

    const blob = new Blob([vCards], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "contacts.vcf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Contacts exportés avec succès !");
  };

  const importContacts = async (file: File) => {
    try {
      const text = await file.text();
      const vCards = text.split("BEGIN:VCARD").filter(Boolean);

      for (const vCard of vCards) {
        const lines = vCard.split("\n");
        const contact: Partial<Contact> = {};

        lines.forEach((line) => {
          if (line.startsWith("N:")) {
            const [nom, prenom] = line.slice(2).split(";");
            contact.nom = nom;
            contact.prenom = prenom;
          } else if (line.startsWith("EMAIL:")) {
            contact.email = line.slice(6);
          } else if (line.startsWith("TEL:")) {
            contact.telephone = line.slice(4);
          } else if (line.startsWith("ORG:")) {
            contact.entreprise = line.slice(4);
          } else if (line.startsWith("ADR:")) {
            const address = line.slice(4).split(";").filter(Boolean);
            contact.adresse = address[2];
            contact.codePostal = address[5];
            contact.ville = address[6];
          }
        });

        if (contact.nom && auth.currentUser) {
          await handleSaveContact(contact as Contact);
        }
      }
      showToast("Contacts importés avec succès");
    } catch (error) {
      console.error("Erreur lors de l'import:", error);
      showToast("Erreur lors de l'import des contacts", "error");
    }
  };

  // Gestionnaire de raccourcis clavier
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      console.log(
        "Touche pressée:",
        e.key,
        "Ctrl:",
        e.ctrlKey,
        "Meta:",
        e.metaKey
      );

      // Ne pas déclencher les raccourcis si on est dans un champ de saisie
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Vérifier si c'est un raccourci Ctrl
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        console.log("Raccourci Ctrl détecté:", key);

        switch (key) {
          case "n":
            console.log("Tentative d'ouverture du modal nouveau contact");
            e.preventDefault();
            e.stopPropagation();
            setSelectedContact(undefined);
            setIsModalOpen(true);
            break;
          case "f":
            e.preventDefault();
            e.stopPropagation();
            document
              .querySelector<HTMLInputElement>('input[type="text"]')
              ?.focus();
            break;
          case "e":
            e.preventDefault();
            e.stopPropagation();
            exportContacts();
            break;
          case "v":
            e.preventDefault();
            e.stopPropagation();
            setViewMode(viewMode === "grid" ? "list" : "grid");
            break;
          case "c":
            e.preventDefault();
            e.stopPropagation();
            if (selectedContact) {
              const contactInfo = [
                `${selectedContact.prenom} ${selectedContact.nom}`,
                selectedContact.email,
                selectedContact.telephone,
                selectedContact.entreprise,
                [
                  selectedContact.adresse,
                  selectedContact.codePostal,
                  selectedContact.ville,
                ]
                  .filter(Boolean)
                  .join(", "),
              ]
                .filter(Boolean)
                .join("\n");
              navigator.clipboard.writeText(contactInfo);
              showToast("Informations du contact copiées", "success");
            }
            break;
          case "m":
            e.preventDefault();
            e.stopPropagation();
            if (selectedContact) {
              const address = [
                selectedContact.adresse,
                selectedContact.codePostal,
                selectedContact.ville,
              ]
                .filter(Boolean)
                .join(", ");
              if (address) {
                const query = encodeURIComponent(address);
                window.open(
                  `https://www.google.com/maps/search/?api=1&query=${query}`,
                  "_blank"
                );
              }
            }
            break;
          case "p":
            e.preventDefault();
            e.stopPropagation();
            if (selectedContact?.telephone) {
              window.location.href = `tel:${selectedContact.telephone.replace(
                /\s/g,
                ""
              )}`;
            }
            break;
          case "i":
            e.preventDefault();
            e.stopPropagation();
            if (selectedContact?.email) {
              window.location.href = `mailto:${selectedContact.email}`;
            }
            break;
        }
      } else if (e.key === "Escape" && isModalOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsModalOpen(false);
        setSelectedContact(undefined);
      }
    };

    // Utiliser keydown avec capture pour intercepter les événements avant qu'ils n'atteignent le navigateur
    window.addEventListener("keydown", handleKeyPress, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyPress, { capture: true });
  }, [isModalOpen, viewMode, selectedContact]);

  // Ajouter un composant pour afficher les raccourcis disponibles
  const ShortcutsHelp = () => (
    <div
      className={`fixed bottom-4 left-[300px] p-4 rounded-lg shadow-lg ${
        isDarkMode ? "bg-gray-800 text-white" : "bg-white text-gray-900"
      }`}
    >
      <h3 className="text-sm font-medium mb-2">Raccourcis clavier</h3>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>Ctrl + N : Nouveau contact</div>
        <div>Ctrl + F : Rechercher</div>
        <div>Ctrl + E : Exporter</div>
        <div>Ctrl + V : Changer de vue</div>
        <div>Ctrl + C : Copier les infos</div>
        <div>Ctrl + M : Ouvrir Maps</div>
        <div>Ctrl + P : Appeler</div>
        <div>Ctrl + I : Envoyer email</div>
        <div>Échap : Fermer modal</div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div
      className={`p-8 ${
        isDarkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      } min-h-screen`}
    >
      {/* En-tête */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Contacts</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-200"
              }`}
              title={viewMode === "grid" ? "Vue liste" : "Vue grille"}
            >
              {viewMode === "grid" ? (
                <List size={20} />
              ) : (
                <LayoutGrid size={20} />
              )}
            </button>
            <button
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-200"
              }`}
              title={sortOrder === "asc" ? "Tri décroissant" : "Tri croissant"}
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </button>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className={`p-2 rounded-lg ${
                isDarkMode ? "bg-gray-800 text-white" : "bg-white text-gray-900"
              }`}
            >
              <option value="nom">Nom</option>
              <option value="prenom">Prénom</option>
              <option value="email">Email</option>
              <option value="entreprise">Entreprise</option>
              <option value="ville">Ville</option>
            </select>
            {/* Bouton d'export */}
            <button
              onClick={exportContacts}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-200"
              }`}
              title="Exporter les contacts"
            >
              <Download size={20} />
            </button>
            {/* Bouton d'import */}
            <label
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-200"
              }`}
              title="Importer des contacts"
            >
              <Upload size={20} />
              <input
                type="file"
                accept=".vcf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    importContacts(file);
                    e.target.value = ""; // Réinitialiser l'input
                  }
                }}
              />
            </label>
            <button
              onClick={() => {
                setSelectedContact(undefined);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <span>Nouveau contact</span>
            </button>
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="relative">
          <input
            type="text"
            placeholder="Rechercher un contact..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full px-4 py-2 pl-10 rounded-lg ${
              isDarkMode
                ? "bg-gray-800 text-white placeholder-gray-400"
                : "bg-white text-gray-900 placeholder-gray-500"
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
          <Search
            size={20}
            className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
              isDarkMode ? "text-gray-400" : "text-gray-500"
            }`}
          />
        </div>
      </div>

      {/* Liste des contacts */}
      <ContactList
        contacts={filteredContacts}
        onContactSelect={(contact) => {
          setSelectedContact(contact);
          setIsModalOpen(true);
        }}
        viewMode={viewMode}
        isDarkMode={isDarkMode}
      />

      {/* Modal de contact */}
      <ContactModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedContact(undefined);
        }}
        onSave={handleSaveContact}
        onDelete={handleDeleteContact}
        selectedContact={selectedContact}
      />

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

      <ShortcutsHelp />
    </div>
  );
}
