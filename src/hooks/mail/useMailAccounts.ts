"use client";

import { useCallback, useEffect, useState } from "react";
import { auth } from "@/config/firebase";
import type { MailAccount } from "@/types/mail";
import {
  getAccountsByUser,
  setActiveAccount as setActiveAccountService,
} from "@/lib/mail/accountService";

export function useMailAccounts() {
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setAccounts([]);
      setActiveAccountId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await getAccountsByUser(user.uid);
      setAccounts(list);
      setActiveAccountId((current) => {
        if (current && list.some((a) => a.id === current)) return current;
        const active = list.find((a) => a.isActive) ?? list[0];
        return active ? active.id : null;
      });
    } catch (error) {
      console.error("Erreur lors du chargement des comptes:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(() => {
      reload();
    });
    return () => unsubscribe();
  }, [reload]);

  const selectAccount = useCallback(
    async (accountId: string) => {
      setActiveAccountId(accountId);
      const user = auth.currentUser;
      if (user) {
        try {
          await setActiveAccountService(user.uid, accountId);
          setAccounts((prev) =>
            prev.map((a) => ({ ...a, isActive: a.id === accountId }))
          );
        } catch (error) {
          console.error("Erreur lors de l'activation du compte:", error);
        }
      }
    },
    []
  );

  const activeAccount =
    accounts.find((a) => a.id === activeAccountId) ?? null;

  return {
    accounts,
    activeAccount,
    activeAccountId,
    loading,
    reload,
    selectAccount,
  };
}
