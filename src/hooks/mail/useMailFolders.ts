"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "@/config/firebase";
import type { MailFolder, MailFolderNode, FolderType } from "@/types/mail";
import {
  getFoldersByAccount,
  buildFolderTree,
  createDefaultFolders,
  createFolder as createFolderService,
  updateFolder as updateFolderService,
  deleteFolder as deleteFolderService,
  moveFolder as moveFolderService,
} from "@/lib/mail/folderService";
import { getUnreadCountsByFolder } from "@/lib/mail/messageService";
import { SYSTEM_FOLDER_TYPES } from "@/lib/mail/constants";

export function useMailFolders(accountId: string | null) {
  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!accountId) {
      setFolders([]);
      setUnreadCounts({});
      return;
    }
    setLoading(true);
    try {
      const [initial, counts] = await Promise.all([
        getFoldersByAccount(accountId),
        getUnreadCountsByFolder(accountId),
      ]);

      // Réconciliation : certains comptes ont pu être créés avant l'ajout
      // de dossiers système (ex : Spam). On crée les dossiers manquants à la
      // volée pour qu'ils apparaissent sans recréer le compte.
      let list = initial;
      const existingTypes = new Set(initial.map((f) => f.folderType));
      const missing = SYSTEM_FOLDER_TYPES.some((t) => !existingTypes.has(t));
      if (missing) {
        const userId = auth.currentUser?.uid ?? initial[0]?.userId;
        if (userId) {
          list = await createDefaultFolders(userId, accountId);
        }
      }

      setFolders(list);
      setUnreadCounts(counts);
    } catch (error) {
      console.error("Erreur lors du chargement des dossiers:", error);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const tree: MailFolderNode[] = useMemo(
    () => buildFolderTree(folders),
    [folders]
  );

  const createFolder = useCallback(
    async (name: string, parentFolderId: string | null = null) => {
      const user = auth.currentUser;
      if (!user || !accountId) return;
      await createFolderService({
        userId: user.uid,
        accountId,
        name,
        parentFolderId,
        folderType: "custom",
      });
      await reload();
    },
    [accountId, reload]
  );

  const renameFolder = useCallback(
    async (folderId: string, name: string) => {
      await updateFolderService(folderId, { name });
      await reload();
    },
    [reload]
  );

  const removeFolder = useCallback(
    async (folderId: string) => {
      await deleteFolderService(folderId);
      await reload();
    },
    [reload]
  );

  const moveFolder = useCallback(
    async (folderId: string, parentFolderId: string | null) => {
      await moveFolderService(folderId, parentFolderId);
      await reload();
    },
    [reload]
  );

  const findByType = useCallback(
    (type: FolderType) => folders.find((f) => f.folderType === type) ?? null,
    [folders]
  );

  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((acc, n) => acc + n, 0),
    [unreadCounts]
  );

  return {
    folders,
    tree,
    unreadCounts,
    totalUnread,
    loading,
    reload,
    createFolder,
    renameFolder,
    removeFolder,
    moveFolder,
    findByType,
  };
}
