"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MailFolder, MailFolderNode } from "@/types/mail";
import { buildFolderTree, getFoldersByAccount } from "@/lib/mail/folderService";
import { getUnreadCountsByFolder } from "@/lib/mail/messageService";

/**
 * Charge les dossiers + compteurs non lus de TOUS les comptes fournis, pour
 * afficher l'ensemble des arborescences dans la sidebar et étiqueter les
 * résultats de recherche (nom de dossier par id). Une requête par compte
 * (volumétrie de comptes faible).
 */
export function useAllFolders(accountIds: string[]) {
  const [foldersByAccount, setFoldersByAccount] = useState<
    Record<string, MailFolder[]>
  >({});
  const [unreadByAccount, setUnreadByAccount] = useState<
    Record<string, Record<string, number>>
  >({});
  const [loading, setLoading] = useState(false);

  const idsKey = accountIds.join(",");
  const idsRef = useRef(accountIds);
  idsRef.current = accountIds;

  const reload = useCallback(async () => {
    const ids = idsRef.current;
    if (ids.length === 0) {
      setFoldersByAccount({});
      setUnreadByAccount({});
      return;
    }
    setLoading(true);
    try {
      const entries = await Promise.all(
        ids.map(async (id) => {
          const [folders, counts] = await Promise.all([
            getFoldersByAccount(id),
            getUnreadCountsByFolder(id),
          ]);
          return [id, folders, counts] as const;
        })
      );
      const fByA: Record<string, MailFolder[]> = {};
      const uByA: Record<string, Record<string, number>> = {};
      entries.forEach(([id, folders, counts]) => {
        fByA[id] = folders;
        uByA[id] = counts;
      });
      setFoldersByAccount(fByA);
      setUnreadByAccount(uByA);
    } catch (error) {
      console.error("Erreur lors du chargement des dossiers (multi-comptes):", error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  const treeByAccount = useMemo(() => {
    const t: Record<string, MailFolderNode[]> = {};
    for (const id of Object.keys(foldersByAccount)) {
      t[id] = buildFolderTree(foldersByAccount[id]);
    }
    return t;
  }, [foldersByAccount]);

  const totalUnreadByAccount = useMemo(() => {
    const t: Record<string, number> = {};
    for (const id of Object.keys(unreadByAccount)) {
      t[id] = Object.values(unreadByAccount[id]).reduce((a, n) => a + n, 0);
    }
    return t;
  }, [unreadByAccount]);

  const folderMap = useMemo(() => {
    const m: Record<string, MailFolder> = {};
    Object.values(foldersByAccount).forEach((list) =>
      list.forEach((f) => {
        m[f.id] = f;
      })
    );
    return m;
  }, [foldersByAccount]);

  return {
    foldersByAccount,
    treeByAccount,
    unreadByAccount,
    totalUnreadByAccount,
    folderMap,
    loading,
    reload,
  };
}
