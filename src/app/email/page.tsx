"use client";

import { useState, useEffect } from "react";
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

export default function EmailPage() {
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

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      loadEmailAccount();
      loadEmails();
      loadCustomFolders();
      syncEmails();
      const syncInterval = setInterval(syncEmails, 5 * 60 * 1000);
      return () => clearInterval(syncInterval);
    });

    return () => unsubscribe();
  }, [router, selectedFolder]);

  useEffect(() => {
    const emailId = searchParams.get("emailId");
    if (emailId) {
      const email = emails.find((e) => e.id === emailId);
      if (email) {
        handleEmailClick(email);
      }
    }
  }, [searchParams, emails]);

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

  const loadEmails = async () => {
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
      setToastMessage("Email envoyé avec succès");
      setShowToast(true);

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
      setToastMessage("Dossier créé avec succès");
      setShowToast(true);
    } catch (error) {
      console.error("Erreur lors de la création du dossier:", error);
      setToastMessage("Erreur lors de la création du dossier");
      setShowToast(true);
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

  const syncEmails = async () => {
    if (!auth.currentUser) {
      setToastMessage("Vous devez être connecté pour synchroniser");
      setShowToast(true);
      return;
    }
    if (!selectedAccount) {
      setToastMessage("Veuillez configurer un compte email pour synchroniser");
      setShowToast(true);
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
      setToastMessage("Synchronisation réussie");
      setShowToast(true);
    } catch (error) {
      console.error("Erreur détaillée lors de la synchronisation:", error);
      setToastMessage(
        error instanceof Error
          ? error.message
          : "Erreur lors de la synchronisation des emails"
      );
      setShowToast(true);
    } finally {
      setIsSyncing(false);
    }
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
      setToastMessage(`Emails déplacés vers ${targetFolder}`);
      setShowToast(true);
    } catch (error) {
      console.error("Erreur lors du déplacement des emails:", error);
      setToastMessage("Erreur lors du déplacement des emails");
      setShowToast(true);
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
      setToastMessage(`Email déplacé vers ${targetFolder}`);
      setShowToast(true);
    } catch (error) {
      console.error("Erreur lors du déplacement de l'email:", error);
      setToastMessage("Erreur lors du déplacement de l'email");
      setShowToast(true);
    }
  };

  return (
    <div
      className={`h-screen flex ${
        isDarkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}
    >
      {/* Panneau latéral des dossiers */}
      <div
        className={`w-64 p-4 border-r ${
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
      <div className="flex-1 flex flex-col">
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
            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : emails.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <div className="text-lg">Aucun email dans ce dossier</div>
                </div>
              ) : (
                <div className="divide-y">
                  {emails.map((email) => (
                    <div
                      key={email.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, email.id)}
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
                      <div className="flex flex-col items-center gap-5">
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
                          <span className="truncate">
                            {email.from.replace(/['"]/g, "")}
                          </span>
                          <span className="text-sm text-gray-500">
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
                        <div className="truncate">{email.subject}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => {
          setIsComposeOpen(false);
          setReplyData(null);
        }}
        onSend={handleSendEmail}
        initialData={replyData}
        accountId={selectedAccount?.id}
      />

      <EmailConfig
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />

      <Toast.Provider>
        <Toast.Root
          open={showToast}
          onOpenChange={setShowToast}
          className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${
            isDarkMode ? "bg-gray-800 text-white" : "bg-white text-gray-900"
          }`}
        >
          <Toast.Title className="font-medium">{toastMessage}</Toast.Title>
          <Toast.Close className="absolute top-2 right-2">
            <X size={16} />
          </Toast.Close>
        </Toast.Root>
        <Toast.Viewport />
      </Toast.Provider>

      {/* Modal de création de dossier */}
      {isCreateFolderOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className={`p-6 rounded-lg ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            } w-96`}
          >
            <h2 className="text-xl font-bold mb-4">Créer un nouveau dossier</h2>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nom du dossier"
              className={`w-full p-2 rounded-lg mb-4 ${
                isDarkMode
                  ? "bg-gray-700 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateFolder();
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsCreateFolderOpen(false);
                  setNewFolderName("");
                }}
                className="px-4 py-2 rounded-lg hover:bg-gray-200"
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
    </div>
  );
}
