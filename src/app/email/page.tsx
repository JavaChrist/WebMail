"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useTheme } from "@/context/ThemeContext";
import {
  Inbox,
  Send,
  Archive,
  Trash2,
  Star,
  Search,
  Plus,
  RefreshCw,
  Settings,
  X,
  Folder,
  MoreVertical,
  ChevronDown,
  Move,
} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  orderBy,
} from "firebase/firestore";
import { db, auth } from "@/config/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import ComposeModal from "@/components/email/ComposeModal";
import EmailView from "@/components/email/EmailView";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import EmailConfig from "@/components/email/EmailConfig";
import * as Toast from "@radix-ui/react-toast";

interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  content: string;
  timestamp: Date;
  read: boolean;
  starred: boolean;
  folder: "inbox" | "sent" | "archive" | "trash" | string;
  userId: string;
  attachments?: {
    name: string;
    url: string;
    size: number;
  }[];
}

type Folder = "inbox" | "sent" | "archive" | "trash" | string;

interface CustomFolder {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
}

interface EmailAccount {
  id: string;
  email: string;
  name: string;
}

function EmailContent() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<Folder>("inbox");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [replyData, setReplyData] = useState<{
    to: string;
    subject: string;
    content: string;
  } | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(
    null
  );
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [customFolders, setCustomFolders] = useState<CustomFolder[]>([]);
  const [isFoldersOpen, setIsFoldersOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    emailId: string;
    x: number;
    y: number;
  } | null>(null);

  const loadEmails = useCallback(async () => {
    if (!auth.currentUser) return;

    setIsLoading(true);
    try {
      const emailsRef = collection(db, "emails");
      const q = query(
        emailsRef,
        where("userId", "==", auth.currentUser.uid),
        where("folder", "==", selectedFolder),
        orderBy("timestamp", "desc")
      );

      const querySnapshot = await getDocs(q);
      const loadedEmails = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
      })) as Email[];

      setEmails(loadedEmails);
    } catch (error) {
      console.error("Erreur lors du chargement des emails:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFolder]);

  const syncEmails = useCallback(async () => {
    if (!auth.currentUser || !selectedAccount) {
      return;
    }

    setIsSyncing(true);
    try {
      const response = await fetch("/api/email/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: auth.currentUser.uid,
          accountId: selectedAccount.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la synchronisation");
      }

      await loadEmails();
      showToastMessage("Synchronisation réussie", true);
    } catch (error) {
      console.error("Erreur détaillée lors de la synchronisation:", error);
      showToastMessage(
        error instanceof Error
          ? error.message
          : "Erreur lors de la synchronisation des emails",
        false
      );
    } finally {
      setIsSyncing(false);
    }
  }, [selectedAccount, loadEmails]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      await loadEmailAccount();
      await loadEmails();
      await loadCustomFolders();
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!selectedAccount) return;

    const syncInterval = setInterval(() => {
      syncEmails();
    }, 5 * 60 * 1000);

    // Synchronisation initiale
    syncEmails();

    return () => clearInterval(syncInterval);
  }, [selectedAccount]);

  useEffect(() => {
    if (auth.currentUser) {
      loadEmails();
    }
  }, [selectedFolder]);

  useEffect(() => {
    const emailId = searchParams.get("emailId");
    if (emailId) {
      const email = emails.find((e) => e.id === emailId);
      if (email) {
        handleEmailClick(email);
      }
    }
  }, [searchParams, emails]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const loadEmailAccount = async () => {
    if (!auth.currentUser) return;

    try {
      const emailAccountsRef = collection(db, "emailAccounts");
      const q = query(
        emailAccountsRef,
        where("userId", "==", auth.currentUser.uid)
      );

      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const account = doc.data() as EmailAccount;
        setSelectedAccount({
          id: doc.id,
          email: account.email,
          name: account.name,
        });
      }
    } catch (error) {
      console.error("Erreur lors du chargement du compte email:", error);
    }
  };

  const handleSendEmail = async (emailData: {
    to: string;
    subject: string;
    content: string;
    attachments?: File[];
    accountId?: string;
  }) => {
    if (!auth.currentUser) return;

    let emailRef;
    try {
      // Créer d'abord l'email dans Firestore
      emailRef = await addDoc(collection(db, "emails"), {
        from: auth.currentUser.email || "",
        to: emailData.to,
        subject: emailData.subject,
        content: emailData.content,
        timestamp: Timestamp.now(),
        read: true,
        starred: false,
        folder: "sent" as Folder,
        userId: auth.currentUser.uid,
        status: "sending",
      });

      // Préparer les pièces jointes si présentes
      const files = emailData.attachments
        ? await Promise.all(
            emailData.attachments.map(async (file) => {
              const reader = new FileReader();
              return new Promise<{
                name: string;
                content: string;
                type: string;
              }>((resolve) => {
                reader.onloadend = () => {
                  resolve({
                    name: file.name,
                    content: reader.result as string,
                    type: file.type,
                  });
                };
                reader.readAsDataURL(file);
              });
            })
          )
        : undefined;

      // Envoyer l'email via l'API
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: emailData.to,
          subject: emailData.subject,
          content: emailData.content,
          userId: auth.currentUser.uid,
          emailId: emailRef.id,
          accountId: selectedAccount?.id,
          isHtml: true,
          files,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'envoi de l'email");
      }

      // Afficher le toast de succès
      showToastMessage("Email envoyé avec succès", true);

      // Mettre à jour la liste si on est dans le dossier envoyés
      if (selectedFolder === "sent") {
        await loadEmails();
      }
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'email:", error);
      // Mettre à jour le statut de l'email en cas d'erreur
      if (emailRef) {
        await updateDoc(doc(db, "emails", emailRef.id), {
          status: "error",
          error: error instanceof Error ? error.message : "Erreur inconnue",
        });
      }
      throw error;
    }
  };

  const handleStarEmail = async (email: Email) => {
    try {
      const emailRef = doc(db, "emails", email.id);
      await updateDoc(emailRef, {
        starred: !email.starred,
      });
      setEmails(
        emails.map((e) =>
          e.id === email.id ? { ...e, starred: !e.starred } : e
        )
      );
    } catch (error) {
      console.error("Erreur lors du marquage comme favori:", error);
    }
  };

  const handleArchiveEmail = async (email: Email) => {
    try {
      const emailRef = doc(db, "emails", email.id);
      await updateDoc(emailRef, {
        folder: "archive",
      });
      setEmails(emails.filter((e) => e.id !== email.id));
      setSelectedEmail(null);
    } catch (error) {
      console.error("Erreur lors de l'archivage:", error);
    }
  };

  const handleDeleteEmail = async (email: Email) => {
    try {
      const emailRef = doc(db, "emails", email.id);
      if (email.folder === "trash") {
        await deleteDoc(emailRef);
      } else {
        await updateDoc(emailRef, {
          folder: "trash",
        });
      }
      setEmails(emails.filter((e) => e.id !== email.id));
      setSelectedEmail(null);
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
    }
  };

  const handleEmailClick = async (email: Email) => {
    if (!email.read) {
      try {
        const emailRef = doc(db, "emails", email.id);
        await updateDoc(emailRef, {
          read: true,
        });
        setEmails(
          emails.map((e) => (e.id === email.id ? { ...e, read: true } : e))
        );
      } catch (error) {
        console.error("Erreur lors du marquage comme lu:", error);
      }
    }
    setSelectedEmail(email);
  };

  const handleReply = (email: Email) => {
    setReplyData({
      to: email.from,
      subject: `Re: ${email.subject}`,
      content: `\n\n\n------ Message original ------\nDe: ${
        email.from
      }\nDate: ${format(new Date(email.timestamp), "d MMMM yyyy 'à' HH:mm", {
        locale: fr,
      })}\nObjet: ${email.subject}\n\n${email.content}`,
    });
    setIsComposeOpen(true);
  };

  const handleForward = (email: Email) => {
    setReplyData({
      to: "",
      subject: `Tr: ${email.subject}`,
      content: `\n\n\n------ Message transféré ------\nDe: ${
        email.from
      }\nDate: ${format(new Date(email.timestamp), "d MMMM yyyy 'à' HH:mm", {
        locale: fr,
      })}\nObjet: ${email.subject}\n\n${email.content}`,
    });
    setIsComposeOpen(true);
  };

  const handleCreateFolder = async () => {
    if (!auth.currentUser || !newFolderName.trim()) return;

    try {
      const folderRef = await addDoc(collection(db, "customFolders"), {
        name: newFolderName.trim(),
        userId: auth.currentUser.uid,
        createdAt: Timestamp.now(),
      });

      const newFolder: CustomFolder = {
        id: folderRef.id,
        name: newFolderName.trim(),
        userId: auth.currentUser.uid,
        createdAt: new Date(),
      };

      setCustomFolders([...customFolders, newFolder]);
      setNewFolderName("");
      setIsCreateFolderOpen(false);
      showToastMessage("Dossier créé avec succès", true);
    } catch (error) {
      console.error("Erreur lors de la création du dossier:", error);
      showToastMessage("Erreur lors de la création du dossier", false);
    }
  };

  const loadCustomFolders = async () => {
    if (!auth.currentUser) return;

    try {
      const foldersRef = collection(db, "customFolders");
      const q = query(
        foldersRef,
        where("userId", "==", auth.currentUser.uid),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const folders = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
      })) as CustomFolder[];

      setCustomFolders(folders);
    } catch (error) {
      console.error("Erreur lors du chargement des dossiers:", error);
    }
  };

  const showToastMessage = (message: string, isSuccess: boolean = true) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  const handleSelectEmail = (
    emailId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    event.stopPropagation();
    setSelectedEmails((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(emailId)) {
        newSelected.delete(emailId);
      } else {
        newSelected.add(emailId);
      }
      return newSelected;
    });
  };

  const handleSelectAll = () => {
    if (selectedEmails.size === emails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(emails.map((email) => email.id)));
    }
  };

  const handleMoveEmails = async (targetFolder: Folder) => {
    try {
      const promises = Array.from(selectedEmails).map((emailId) => {
        const emailRef = doc(db, "emails", emailId);
        return updateDoc(emailRef, {
          folder: targetFolder,
        });
      });

      await Promise.all(promises);

      // Mettre à jour l'état local
      setEmails(emails.filter((email) => !selectedEmails.has(email.id)));
      setSelectedEmails(new Set());
      showToastMessage(`Emails déplacés vers ${targetFolder}`, true);
    } catch (error) {
      console.error("Erreur lors du déplacement des emails:", error);
      showToastMessage("Erreur lors du déplacement des emails", false);
    }
  };

  const handleDragStart = (e: React.DragEvent, emailId: string) => {
    e.dataTransfer.setData("emailId", emailId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("bg-blue-100");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("bg-blue-100");
  };

  const handleDrop = async (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove("bg-blue-100");

    const emailId = e.dataTransfer.getData("emailId");
    if (!emailId) return;

    try {
      const emailRef = doc(db, "emails", emailId);
      await updateDoc(emailRef, {
        folder: targetFolder,
      });

      // Mettre à jour l'état local
      setEmails(emails.filter((email) => email.id !== emailId));
      setSelectedEmail(null);
      showToastMessage(`Email déplacé vers ${targetFolder}`, true);
    } catch (error) {
      console.error("Erreur lors du déplacement de l'email:", error);
      showToastMessage("Erreur lors du déplacement de l'email", false);
    }
  };

  const handleContextMenu = (e: React.TouchEvent, emailId: string) => {
    e.preventDefault();
    const touch = e.touches[0];
    setContextMenu({
      emailId,
      x: touch.clientX,
      y: touch.clientY,
    });
  };

  const handleMoveEmail = async (targetFolder: Folder) => {
    if (!contextMenu) return;

    try {
      const emailRef = doc(db, "emails", contextMenu.emailId);
      await updateDoc(emailRef, {
        folder: targetFolder,
      });

      setEmails(emails.filter((email) => email.id !== contextMenu.emailId));
      setSelectedEmail(null);
      setContextMenu(null);
      showToastMessage(`Email déplacé vers ${targetFolder}`, true);
    } catch (error) {
      console.error("Erreur lors du déplacement de l'email:", error);
      showToastMessage("Erreur lors du déplacement de l'email", false);
    }
  };

  return (
    <div
      className={`min-h-screen h-full flex ${
        isDarkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}
    >
      {/* Panneau latéral des dossiers */}
      <div
        className={`w-64 p-4 border-r min-h-screen h-full overflow-y-auto sticky top-0 ${
          isDarkMode ? "border-gray-700" : "border-gray-200"
        }`}
      >
        <div className="space-y-4">
          <button
            onClick={() => setIsComposeOpen(true)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            <span>Nouveau message</span>
          </button>

          <button
            onClick={() => setIsConfigOpen(true)}
            className={`w-full px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
              isDarkMode
                ? "bg-gray-800 hover:bg-gray-700"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            <Settings size={20} />
            <span>Configuration</span>
          </button>
        </div>

        <nav className="mt-4">
          <button
            onClick={() => setSelectedFolder("inbox")}
            className={`w-full flex items-center gap-2 p-2 rounded-lg mb-1 transition-colors ${
              selectedFolder === "inbox"
                ? "bg-blue-600 text-white"
                : isDarkMode
                ? "hover:bg-gray-800"
                : "hover:bg-gray-200"
            }`}
          >
            <Inbox size={20} />
            <span>Boîte de réception</span>
          </button>

          {/* Bouton Dossiers avec menu accordéon */}
          <div className="relative">
            <button
              onClick={() => setIsFoldersOpen(!isFoldersOpen)}
              className={`w-full flex items-center justify-between p-2 rounded-lg mb-1 transition-colors ${
                selectedFolder.startsWith("folder_")
                  ? "bg-blue-600 text-white"
                  : isDarkMode
                  ? "hover:bg-gray-800"
                  : "hover:bg-gray-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <Folder size={20} />
                <span>Dossiers</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCreateFolderOpen(true);
                  }}
                  className="p-1 hover:bg-gray-700 rounded-full cursor-pointer"
                >
                  <MoreVertical size={16} />
                </div>
                <ChevronDown
                  size={16}
                  className={`transition-transform ${
                    isFoldersOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </button>

            {/* Menu accordéon des dossiers personnalisés */}
            {isFoldersOpen && (
              <div className="ml-4 space-y-1">
                {customFolders.map((folder) => (
                  <div
                    key={folder.id}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, `folder_${folder.id}`)}
                    className="relative"
                  >
                    <button
                      onClick={() => setSelectedFolder(`folder_${folder.id}`)}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors ${
                        selectedFolder === `folder_${folder.id}`
                          ? "bg-blue-600 text-white"
                          : isDarkMode
                          ? "hover:bg-gray-800"
                          : "hover:bg-gray-200"
                      }`}
                    >
                      <Folder size={16} />
                      <span>{folder.name}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setSelectedFolder("sent")}
            className={`w-full flex items-center gap-2 p-2 rounded-lg mb-1 transition-colors ${
              selectedFolder === "sent"
                ? "bg-blue-600 text-white"
                : isDarkMode
                ? "hover:bg-gray-800"
                : "hover:bg-gray-200"
            }`}
          >
            <Send size={20} />
            <span>Envoyés</span>
          </button>

          <button
            onClick={() => setSelectedFolder("archive")}
            className={`w-full flex items-center gap-2 p-2 rounded-lg mb-1 transition-colors ${
              selectedFolder === "archive"
                ? "bg-blue-600 text-white"
                : isDarkMode
                ? "hover:bg-gray-800"
                : "hover:bg-gray-200"
            }`}
          >
            <Archive size={20} />
            <span>Archive</span>
          </button>

          <button
            onClick={() => setSelectedFolder("trash")}
            className={`w-full flex items-center gap-2 p-2 rounded-lg mb-1 transition-colors ${
              selectedFolder === "trash"
                ? "bg-blue-600 text-white"
                : isDarkMode
                ? "hover:bg-gray-800"
                : "hover:bg-gray-200"
            }`}
          >
            <Trash2 size={20} />
            <span>Corbeille</span>
          </button>
        </nav>
      </div>

      {/* Zone principale */}
      <div className="flex-1 flex flex-col min-h-screen h-full overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <div className="flex items-center gap-2">
            {selectedEmails.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleMoveEmails("archive")}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-200"
                  }`}
                >
                  Archiver
                </button>
                <button
                  onClick={() => handleMoveEmails("trash")}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-200"
                  }`}
                >
                  Corbeille
                </button>
              </div>
            )}
            <button
              onClick={syncEmails}
              disabled={isSyncing}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode ? "hover:bg-gray-800" : "hover:bg-gray-200"
              } ${isSyncing ? "opacity-50 cursor-not-allowed" : ""}`}
              title="Synchroniser les emails"
            >
              <RefreshCw
                size={20}
                className={`${isSyncing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {selectedEmail ? (
          <EmailView
            email={selectedEmail}
            onClose={() => setSelectedEmail(null)}
            onStar={() => handleStarEmail(selectedEmail)}
            onArchive={() => handleArchiveEmail(selectedEmail)}
            onDelete={() => handleDeleteEmail(selectedEmail)}
            onReply={() => handleReply(selectedEmail)}
            onForward={() => handleForward(selectedEmail)}
          />
        ) : (
          <>
            {/* Barre de recherche */}
            <div className="p-4 border-b flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedEmails.size === emails.length}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500">
                  {selectedEmails.size > 0
                    ? `${selectedEmails.size} sélectionné(s)`
                    : "Tout sélectionner"}
                </span>
              </div>
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Rechercher..."
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

            {/* Liste des emails */}
            <div className="flex-1 overflow-y-auto">
              {emails.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">Aucun email</p>
                </div>
              ) : (
                <div className="divide-y">
                  {emails.map((email) => (
                    <div
                      key={email.id}
                      draggable={!isMobile}
                      onDragStart={(e) =>
                        !isMobile && handleDragStart(e, email.id)
                      }
                      onTouchStart={(e) =>
                        isMobile && handleContextMenu(e, email.id)
                      }
                      onClick={() => handleEmailClick(email)}
                      className={`w-full p-4 text-left flex items-start gap-4 transition-colors cursor-pointer ${
                        !email.read ? "font-semibold" : ""
                      } ${
                        isDarkMode
                          ? "hover:bg-gray-800 divide-gray-700"
                          : "hover:bg-gray-100 divide-gray-200"
                      } ${
                        selectedEmails.has(email.id)
                          ? isDarkMode
                            ? "bg-gray-800"
                            : "bg-gray-100"
                          : ""
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStarEmail(email);
                          }}
                          className={`flex-shrink-0 cursor-pointer ${
                            email.starred ? "text-yellow-400" : "text-gray-400"
                          }`}
                        >
                          <Star size={20} />
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedEmails.has(email.id)}
                          onChange={(e) => handleSelectEmail(email.id, e)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="truncate text-base sm:text-base">
                            {email.from.replace(/['"]/g, "")}
                          </span>
                          <span className="text-sm sm:text-base text-gray-500 ml-4">
                            {new Date(email.timestamp).toLocaleDateString(
                              "fr-FR",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                        </div>
                        <div className="truncate text-base sm:text-base">
                          {email.subject}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modales */}
      {isComposeOpen && (
        <ComposeModal
          isOpen={isComposeOpen}
          onClose={() => setIsComposeOpen(false)}
          initialData={replyData}
          onSend={handleSendEmail}
        />
      )}

      {isConfigOpen && (
        <EmailConfig
          isOpen={isConfigOpen}
          onClose={() => setIsConfigOpen(false)}
        />
      )}

      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`px-4 py-2 rounded-lg shadow-lg ${
              toastMessage.includes("succès") ||
              toastMessage.includes("Synchronisation réussie")
                ? "bg-blue-500"
                : "bg-red-500"
            } text-white transition-opacity duration-300`}
          >
            {toastMessage}
          </div>
        </div>
      )}

      {/* Modal de création de dossier */}
      {isCreateFolderOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div
            className={`p-4 md:p-6 rounded-lg w-full max-w-md ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg md:text-xl font-bold">
                Créer un nouveau dossier
              </h2>
              <button
                onClick={() => {
                  setIsCreateFolderOpen(false);
                  setNewFolderName("");
                }}
                className={`${
                  isDarkMode
                    ? "text-gray-400 hover:text-white"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <X size={24} />
              </button>
            </div>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nom du dossier"
              className={`w-full p-3 rounded-lg mb-4 ${
                isDarkMode
                  ? "bg-gray-700 text-white placeholder-gray-400"
                  : "bg-gray-100 text-gray-900 placeholder-gray-500"
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateFolder();
                }
              }}
            />
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button
                onClick={() => {
                  setIsCreateFolderOpen(false);
                  setNewFolderName("");
                }}
                className={`px-4 py-2 rounded-lg ${
                  isDarkMode
                    ? "bg-gray-700 hover:bg-gray-600"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                Annuler
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className={`px-4 py-2 rounded-lg ${
                  newFolderName.trim()
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu contextuel mobile */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="text-sm font-medium mb-2 px-2">Déplacer vers</div>
          <div className="space-y-1">
            <button
              onClick={() => handleMoveEmail("inbox")}
              className="w-full text-left px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Inbox size={16} />
              Boîte de réception
            </button>
            <button
              onClick={() => handleMoveEmail("archive")}
              className="w-full text-left px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Archive size={16} />
              Archive
            </button>
            <button
              onClick={() => handleMoveEmail("trash")}
              className="w-full text-left px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Trash2 size={16} />
              Corbeille
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmailPage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <EmailContent />
    </Suspense>
  );
}
