"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { auth } from "@/config/firebase";
import type { MailMessage } from "@/types/mail";
import { useMailAccounts } from "@/hooks/mail/useMailAccounts";
import { useMailFolders } from "@/hooks/mail/useMailFolders";
import { useMailMessages } from "@/hooks/mail/useMailMessages";
import { useMailCompose, type ComposePrefill } from "@/hooks/mail/useMailCompose";
import { useMailQuota, type MailQuota } from "@/hooks/mail/useMailQuota";

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

  messages: MailMessage[];
  messagesLoading: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  reloadMessages: () => Promise<void>;

  selectedMessage: MailMessage | null;
  openMessage: (message: MailMessage) => void;
  closeMessage: () => void;
  toggleStar: (message: MailMessage) => Promise<void>;
  moveToFolder: (message: MailMessage, folderId: string) => Promise<void>;
  archiveMessage: (message: MailMessage) => Promise<void>;
  trashMessage: (message: MailMessage) => Promise<void>;
  spamMessage: (message: MailMessage) => Promise<void>;

  isComposeOpen: boolean;
  composeDraft: ReturnType<typeof useMailCompose>["draft"];
  openCompose: (prefill?: ComposePrefill) => void;
  closeCompose: () => void;
  updateDraft: ReturnType<typeof useMailCompose>["updateDraft"];

  syncing: boolean;
  syncActiveAccount: () => Promise<void>;

  quota: MailQuota | null;
  quotaLoading: boolean;
  quotaChecked: boolean;
  refreshQuota: () => void;

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

  const [selectedMessage, setSelectedMessage] = useState<MailMessage | null>(
    null
  );
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  useEffect(() => {
    const inbox = foldersApi.findByType("inbox");
    setSelectedFolderId((current) => {
      if (current && foldersApi.folders.some((f) => f.id === current)) {
        return current;
      }
      return inbox ? inbox.id : foldersApi.folders[0]?.id ?? null;
    });
  }, [foldersApi.folders, foldersApi.findByType]);

  useEffect(() => {
    setSelectedMessage(null);
  }, [selectedFolderId, activeAccountId]);

  const selectFolder = useCallback((folderId: string) => {
    setSelectedFolderId(folderId);
  }, []);

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
    },
    [messagesApi, foldersApi]
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

  const syncActiveAccount = useCallback(async () => {
    if (!activeAccountId || !auth.currentUser) {
      showToast("Aucun compte email à synchroniser", "error");
      return;
    }
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
      quotaApi.refreshQuota();
      showToast(`${data.synced ?? 0} nouveaux messages synchronisés`);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Erreur de synchronisation",
        "error"
      );
    } finally {
      setSyncing(false);
    }
  }, [activeAccountId, messagesApi, foldersApi, quotaApi, showToast]);

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

      messages: messagesApi.messages,
      messagesLoading: messagesApi.loading,
      searchTerm: messagesApi.searchTerm,
      setSearchTerm: messagesApi.setSearchTerm,
      reloadMessages: messagesApi.reload,

      selectedMessage,
      openMessage,
      closeMessage,
      toggleStar,
      moveToFolder,
      archiveMessage,
      trashMessage,
      spamMessage,

      isComposeOpen: composeApi.isComposeOpen,
      composeDraft: composeApi.draft,
      openCompose,
      closeCompose: composeApi.closeCompose,
      updateDraft: composeApi.updateDraft,

      syncing,
      syncActiveAccount,

      quota: quotaApi.quota,
      quotaLoading: quotaApi.quotaLoading,
      quotaChecked: quotaApi.quotaChecked,
      refreshQuota: quotaApi.refreshQuota,

      toast,
      showToast,
    }),
    [
      accountsApi,
      activeAccountId,
      foldersApi,
      selectedFolderId,
      selectFolder,
      messagesApi,
      selectedMessage,
      openMessage,
      closeMessage,
      toggleStar,
      moveToFolder,
      archiveMessage,
      trashMessage,
      spamMessage,
      composeApi,
      openCompose,
      syncing,
      syncActiveAccount,
      quotaApi,
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
