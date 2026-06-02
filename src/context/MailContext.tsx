"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { auth } from "@/config/firebase";
import type { MailFolder, MailFolderNode, MailMessage } from "@/types/mail";
import { useMailAccounts } from "@/hooks/mail/useMailAccounts";
import { useMailFolders } from "@/hooks/mail/useMailFolders";
import { useMailMessages } from "@/hooks/mail/useMailMessages";
import { useMailCompose, type ComposePrefill } from "@/hooks/mail/useMailCompose";
import { useMailQuota, type MailQuota } from "@/hooks/mail/useMailQuota";
import { useMailViewMode, type MailViewMode } from "@/hooks/mail/useMailViewMode";
import { useAllFolders } from "@/hooks/mail/useAllFolders";
import { useMailSearch } from "@/hooks/mail/useMailSearch";
import {
  countMessagesInFolder,
  emptyFolder,
  saveDraft as saveDraftService,
  deleteMessagePermanently,
} from "@/lib/mail/messageService";
import { addBlockedSender } from "@/lib/mail/accountService";

const AUTO_SYNC_MS = 5 * 60 * 1000;

interface ToastState {
  message: string;
  type: "success" | "error";
}

interface MailContextValue {
  accounts: ReturnType<typeof useMailAccounts>["accounts"];
  activeAccount: ReturnType<typeof useMailAccounts>["activeAccount"];
  activeAccountId: string | null;
  accountsLoading: boolean;
  selectAccount: (id: string) => Promise<void>;
  reloadAccounts: () => Promise<void>;

  folders: ReturnType<typeof useMailFolders>["folders"];
  folderTree: ReturnType<typeof useMailFolders>["tree"];
  unreadCounts: Record<string, number>;
  totalUnread: number;
  foldersLoading: boolean;
  reloadFolders: () => Promise<void>;
  createFolder: (name: string, parentId?: string | null) => Promise<void>;
  renameFolder: (folderId: string, name: string) => Promise<void>;
  removeFolder: (folderId: string) => Promise<void>;
  moveFolder: (folderId: string, parentId: string | null) => Promise<void>;

  selectedFolderId: string | null;
  selectFolder: (folderId: string) => void;
  selectAccountFolder: (accountId: string, folderId: string) => void;

  treeByAccount: Record<string, MailFolderNode[]>;
  unreadByAccount: Record<string, Record<string, number>>;
  totalUnreadByAccount: Record<string, number>;
  folderMap: Record<string, MailFolder>;

  messages: MailMessage[];
  messagesLoading: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  reloadMessages: () => Promise<void>;

  searchActive: boolean;
  searchResults: MailMessage[];
  searchLoading: boolean;

  selectedMessage: MailMessage | null;
  openMessage: (message: MailMessage) => void;
  closeMessage: () => void;
  markRead: (message: MailMessage, read: boolean) => Promise<void>;
  toggleStar: (message: MailMessage) => Promise<void>;
  moveToFolder: (message: MailMessage, folderId: string) => Promise<void>;
  archiveMessage: (message: MailMessage) => Promise<void>;
  trashMessage: (message: MailMessage) => Promise<void>;
  spamMessage: (message: MailMessage) => Promise<void>;
  blockSender: (message: MailMessage) => Promise<void>;
  emptyTrash: () => Promise<void>;
  countFolderMessages: (folderId: string) => Promise<number>;

  isComposeOpen: boolean;
  composeDraft: ReturnType<typeof useMailCompose>["draft"];
  openCompose: (prefill?: ComposePrefill) => void;
  openDraft: (message: MailMessage) => void;
  closeCompose: () => void;
  updateDraft: ReturnType<typeof useMailCompose>["updateDraft"];
  saveDraft: (attachments?: MailMessage["attachments"]) => Promise<void>;
  discardDraft: (id: string) => Promise<void>;

  syncing: boolean;
  syncActiveAccount: () => Promise<void>;

  quota: MailQuota | null;
  quotaLoading: boolean;
  quotaChecked: boolean;
  refreshQuota: () => void;

  viewMode: MailViewMode;
  setViewMode: (mode: MailViewMode) => void;

  toast: ToastState | null;
  showToast: (message: string, type?: "success" | "error") => void;
}

const MailContext = createContext<MailContextValue | undefined>(undefined);

export function MailProvider({ children }: { children: React.ReactNode }) {
  const accountsApi = useMailAccounts();
  const { activeAccountId } = accountsApi;

  const foldersApi = useMailFolders(activeAccountId);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const messagesApi = useMailMessages(activeAccountId, selectedFolderId);
  const composeApi = useMailCompose();
  const quotaApi = useMailQuota(activeAccountId);
  const { viewMode, setViewMode } = useMailViewMode();

  const accountIds = useMemo(
    () => accountsApi.accounts.map((a) => a.id),
    [accountsApi.accounts]
  );
  const allFoldersApi = useAllFolders(accountIds);

  const [selectedMessage, setSelectedMessage] = useState<MailMessage | null>(
    null
  );
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const searchApi = useMailSearch(
    messagesApi.searchTerm,
    auth.currentUser?.uid ?? null
  );

  const pendingFolderRef = useRef<string | null>(null);
  const syncingRef = useRef(false);
  syncingRef.current = syncing;

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  useEffect(() => {
    setSelectedFolderId((current) => {
      const pending = pendingFolderRef.current;
      if (pending && foldersApi.folders.some((f) => f.id === pending)) {
        pendingFolderRef.current = null;
        return pending;
      }
      if (current && foldersApi.folders.some((f) => f.id === current)) {
        return current;
      }
      const inbox = foldersApi.findByType("inbox");
      return inbox ? inbox.id : foldersApi.folders[0]?.id ?? null;
    });
  }, [foldersApi.folders, foldersApi.findByType]);

  useEffect(() => {
    setSelectedMessage(null);
  }, [selectedFolderId, activeAccountId]);

  const selectFolder = useCallback((folderId: string) => {
    setSelectedFolderId(folderId);
  }, []);

  const selectAccountFolder = useCallback(
    (accountId: string, folderId: string) => {
      if (accountId === activeAccountId) {
        setSelectedFolderId(folderId);
        return;
      }
      // Le compte cible doit charger ses dossiers : on applique le dossier
      // une fois disponible (cf. effet de sélection de dossier).
      pendingFolderRef.current = folderId;
      accountsApi.selectAccount(accountId);
    },
    [activeAccountId, accountsApi]
  );

  const openMessage = useCallback(
    (message: MailMessage) => {
      setSelectedMessage(message);
      if (!message.read) {
        messagesApi.markRead(message.id, true);
      }
    },
    [messagesApi]
  );

  const closeMessage = useCallback(() => setSelectedMessage(null), []);

  const markRead = useCallback(
    async (message: MailMessage, read: boolean) => {
      await messagesApi.markRead(message.id, read);
      setSelectedMessage((prev) =>
        prev && prev.id === message.id ? { ...prev, read } : prev
      );
      foldersApi.reload();
      allFoldersApi.reload();
    },
    [messagesApi, foldersApi, allFoldersApi]
  );

  const toggleStar = useCallback(
    async (message: MailMessage) => {
      await messagesApi.toggleStar(message.id, !message.starred);
      setSelectedMessage((prev) =>
        prev && prev.id === message.id
          ? { ...prev, starred: !message.starred }
          : prev
      );
    },
    [messagesApi]
  );

  const moveToFolder = useCallback(
    async (message: MailMessage, folderId: string) => {
      await messagesApi.moveMessage(message.id, folderId);
      setSelectedMessage((prev) => (prev?.id === message.id ? null : prev));
      foldersApi.reload();
      allFoldersApi.reload();
    },
    [messagesApi, foldersApi, allFoldersApi]
  );

  const moveToType = useCallback(
    async (
      message: MailMessage,
      type: "archive" | "trash" | "spam",
      label: string
    ) => {
      const target = foldersApi.findByType(type);
      if (!target) {
        showToast(`Dossier ${label} introuvable`, "error");
        return;
      }
      await moveToFolder(message, target.id);
      showToast(`Message déplacé vers ${label}`);
    },
    [foldersApi, moveToFolder, showToast]
  );

  const archiveMessage = useCallback(
    (message: MailMessage) => moveToType(message, "archive", "Archive"),
    [moveToType]
  );
  const trashMessage = useCallback(
    (message: MailMessage) => moveToType(message, "trash", "Corbeille"),
    [moveToType]
  );
  const spamMessage = useCallback(
    (message: MailMessage) => moveToType(message, "spam", "Spam"),
    [moveToType]
  );

  const blockSender = useCallback(
    async (message: MailMessage) => {
      const email = message.from?.email?.trim();
      await moveToType(message, "spam", "Spam");
      if (email) {
        try {
          await addBlockedSender(message.accountId, email);
          await accountsApi.reload();
          showToast(`Expéditeur bloqué : ${email}`);
        } catch {
          showToast("Le message a été déplacé en spam (blocage non enregistré)", "error");
        }
      }
    },
    [moveToType, accountsApi, showToast]
  );

  const countFolderMessages = useCallback(
    async (folderId: string) => {
      if (!activeAccountId) return 0;
      try {
        return await countMessagesInFolder(activeAccountId, folderId);
      } catch {
        return 0;
      }
    },
    [activeAccountId]
  );

  const emptyTrash = useCallback(async () => {
    const trash = foldersApi.findByType("trash");
    if (!activeAccountId || !trash) {
      showToast("Dossier Corbeille introuvable", "error");
      return;
    }
    try {
      const count = await emptyFolder(activeAccountId, trash.id);
      setSelectedMessage((prev) =>
        prev && prev.primaryFolderId === trash.id ? null : prev
      );
      await Promise.all([messagesApi.reload(), foldersApi.reload()]);
      allFoldersApi.reload();
      showToast(
        count === 0 ? "Corbeille déjà vide" : `${count} message(s) supprimé(s)`
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Erreur lors du vidage de la corbeille",
        "error"
      );
    }
  }, [activeAccountId, foldersApi, messagesApi, allFoldersApi, showToast]);

  const openCompose = useCallback(
    (prefill?: ComposePrefill) => {
      if (!activeAccountId) {
        showToast("Aucun compte email configuré", "error");
        return;
      }
      composeApi.openCompose(activeAccountId, prefill);
    },
    [activeAccountId, composeApi, showToast]
  );

  const openDraft = useCallback(
    (message: MailMessage) => {
      const join = (arr?: { email: string }[]) =>
        (arr ?? []).map((a) => a.email).filter(Boolean).join(", ");
      composeApi.openCompose(message.accountId, {
        accountId: message.accountId,
        to: join(message.to),
        cc: join(message.cc),
        bcc: join(message.bcc),
        subject: message.subject,
        body: message.contentHtml ?? "",
        draftMessageId: message.id,
      });
    },
    [composeApi]
  );

  const saveDraft = useCallback(
    async (attachments?: MailMessage["attachments"]) => {
      const draft = composeApi.draft;
      if (!draft || !auth.currentUser) return;
      const account = accountsApi.accounts.find((a) => a.id === draft.accountId);
      const draftsFolder = allFoldersApi.foldersByAccount[draft.accountId]?.find(
        (f) => f.folderType === "drafts"
      );
      if (!account || !draftsFolder) {
        showToast("Dossier Brouillons introuvable", "error");
        return;
      }
      try {
        await saveDraftService({
          id: draft.draftMessageId,
          userId: auth.currentUser.uid,
          accountId: draft.accountId,
          draftsFolderId: draftsFolder.id,
          from: { email: account.email, name: account.displayName },
          to: draft.to,
          cc: draft.cc,
          bcc: draft.bcc,
          subject: draft.subject,
          contentHtml: draft.body,
          attachments: attachments ?? [],
        });
        composeApi.closeCompose();
        await Promise.all([messagesApi.reload(), foldersApi.reload()]);
        allFoldersApi.reload();
        showToast("Brouillon enregistré");
      } catch (error) {
        showToast(
          error instanceof Error
            ? error.message
            : "Erreur lors de l'enregistrement du brouillon",
          "error"
        );
      }
    },
    [composeApi, accountsApi, allFoldersApi, messagesApi, foldersApi, showToast]
  );

  const discardDraft = useCallback(
    async (id: string) => {
      try {
        await deleteMessagePermanently(id);
        await Promise.all([messagesApi.reload(), foldersApi.reload()]);
        allFoldersApi.reload();
      } catch (error) {
        console.error("Erreur lors de la suppression du brouillon:", error);
      }
    },
    [messagesApi, foldersApi, allFoldersApi]
  );

  const syncActiveAccount = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      if (!activeAccountId || !auth.currentUser) {
        if (!silent) showToast("Aucun compte email à synchroniser", "error");
        return;
      }
      if (syncingRef.current) return;
      setSyncing(true);
      try {
        const token = await auth.currentUser.getIdToken();
        const res = await fetch("/api/mail/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ accountId: activeAccountId }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Erreur de synchronisation");
        }
        const data = await res.json();
        await Promise.all([messagesApi.reload(), foldersApi.reload()]);
        allFoldersApi.reload();
        quotaApi.refreshQuota();
        searchApi.refresh();
        if (!silent) {
          showToast(`${data.synced ?? 0} nouveaux messages synchronisés`);
        }
      } catch (error) {
        if (!silent) {
          showToast(
            error instanceof Error ? error.message : "Erreur de synchronisation",
            "error"
          );
        } else {
          console.error("Auto-sync échouée:", error);
        }
      } finally {
        setSyncing(false);
      }
    },
    [activeAccountId, messagesApi, foldersApi, allFoldersApi, quotaApi, searchApi, showToast]
  );

  // Synchronisation automatique périodique du compte actif (sans toast),
  // avec verrou anti-concurrence et nettoyage de l'intervalle.
  useEffect(() => {
    if (!activeAccountId) return;
    const id = setInterval(() => {
      if (!syncingRef.current) {
        syncActiveAccount({ silent: true });
      }
    }, AUTO_SYNC_MS);
    return () => clearInterval(id);
  }, [activeAccountId, syncActiveAccount]);

  const value = useMemo<MailContextValue>(
    () => ({
      accounts: accountsApi.accounts,
      activeAccount: accountsApi.activeAccount,
      activeAccountId,
      accountsLoading: accountsApi.loading,
      selectAccount: accountsApi.selectAccount,
      reloadAccounts: accountsApi.reload,

      folders: foldersApi.folders,
      folderTree: foldersApi.tree,
      unreadCounts: foldersApi.unreadCounts,
      totalUnread: foldersApi.totalUnread,
      foldersLoading: foldersApi.loading,
      reloadFolders: foldersApi.reload,
      createFolder: foldersApi.createFolder,
      renameFolder: foldersApi.renameFolder,
      removeFolder: foldersApi.removeFolder,
      moveFolder: foldersApi.moveFolder,

      selectedFolderId,
      selectFolder,
      selectAccountFolder,

      treeByAccount: allFoldersApi.treeByAccount,
      unreadByAccount: allFoldersApi.unreadByAccount,
      totalUnreadByAccount: allFoldersApi.totalUnreadByAccount,
      folderMap: allFoldersApi.folderMap,

      messages: messagesApi.messages,
      messagesLoading: messagesApi.loading,
      searchTerm: messagesApi.searchTerm,
      setSearchTerm: messagesApi.setSearchTerm,
      reloadMessages: messagesApi.reload,

      searchActive: searchApi.active,
      searchResults: searchApi.results,
      searchLoading: searchApi.loading,

      selectedMessage,
      openMessage,
      closeMessage,
      markRead,
      toggleStar,
      moveToFolder,
      archiveMessage,
      trashMessage,
      spamMessage,
      blockSender,
      emptyTrash,
      countFolderMessages,

      isComposeOpen: composeApi.isComposeOpen,
      composeDraft: composeApi.draft,
      openCompose,
      openDraft,
      closeCompose: composeApi.closeCompose,
      updateDraft: composeApi.updateDraft,
      saveDraft,
      discardDraft,

      syncing,
      syncActiveAccount,

      quota: quotaApi.quota,
      quotaLoading: quotaApi.quotaLoading,
      quotaChecked: quotaApi.quotaChecked,
      refreshQuota: quotaApi.refreshQuota,

      viewMode,
      setViewMode,

      toast,
      showToast,
    }),
    [
      accountsApi,
      activeAccountId,
      foldersApi,
      allFoldersApi,
      selectedFolderId,
      selectFolder,
      selectAccountFolder,
      messagesApi,
      searchApi,
      selectedMessage,
      openMessage,
      closeMessage,
      markRead,
      toggleStar,
      moveToFolder,
      archiveMessage,
      trashMessage,
      spamMessage,
      blockSender,
      emptyTrash,
      countFolderMessages,
      composeApi,
      openCompose,
      openDraft,
      saveDraft,
      discardDraft,
      syncing,
      syncActiveAccount,
      quotaApi,
      viewMode,
      setViewMode,
      toast,
      showToast,
    ]
  );

  return <MailContext.Provider value={value}>{children}</MailContext.Provider>;
}

export function useMail() {
  const ctx = useContext(MailContext);
  if (!ctx) throw new Error("useMail doit être utilisé dans un MailProvider");
  return ctx;
}
