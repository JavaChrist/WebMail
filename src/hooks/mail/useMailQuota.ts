"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "@/config/firebase";

export interface MailQuota {
  usedMb: number;
  quotaMb: number;
}

export function useMailQuota(accountId: string | null) {
  const [quota, setQuota] = useState<MailQuota | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const cache = useRef<Map<string, MailQuota | null>>(new Map());

  const refresh = useCallback(
    async (force = false) => {
      if (!accountId || !auth.currentUser) return;
      if (!force && cache.current.has(accountId)) {
        setQuota(cache.current.get(accountId) ?? null);
        setChecked(true);
        return;
      }
      setLoading(true);
      try {
        const token = await auth.currentUser.getIdToken();
        const res = await fetch("/api/mail/quota", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ accountId }),
        });
        let value: MailQuota | null = null;
        if (res.ok) {
          const data = await res.json();
          if (data.supported && data.quotaMb) {
            value = { usedMb: data.usedMb ?? 0, quotaMb: data.quotaMb };
          }
        }
        cache.current.set(accountId, value);
        setQuota(value);
      } catch {
        setQuota(null);
      } finally {
        setLoading(false);
        setChecked(true);
      }
    },
    [accountId]
  );

  useEffect(() => {
    if (!accountId) {
      setQuota(null);
      setChecked(false);
      return;
    }
    if (cache.current.has(accountId)) {
      setQuota(cache.current.get(accountId) ?? null);
      setChecked(true);
      return;
    }
    setChecked(false);
    refresh();
  }, [accountId, refresh]);

  return {
    quota,
    quotaLoading: loading,
    quotaChecked: checked,
    refreshQuota: () => refresh(true),
  };
}
