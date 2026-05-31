"use client";

import { useCallback, useState } from "react";
import type { ComposeDraft } from "@/types/mail";

export interface ComposePrefill {
  accountId?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
}

const emptyDraft = (accountId: string): ComposeDraft => ({
  accountId,
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  body: "",
});

export function useMailCompose() {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<ComposeDraft | null>(null);

  const openCompose = useCallback(
    (defaultAccountId: string, prefill?: ComposePrefill) => {
      const base = emptyDraft(prefill?.accountId ?? defaultAccountId);
      setDraft({
        ...base,
        to: prefill?.to ?? "",
        cc: prefill?.cc ?? "",
        bcc: prefill?.bcc ?? "",
        subject: prefill?.subject ?? "",
        body: prefill?.body ?? "",
      });
      setIsOpen(true);
    },
    []
  );

  const closeCompose = useCallback(() => {
    setIsOpen(false);
    setDraft(null);
  }, []);

  const updateDraft = useCallback((patch: Partial<ComposeDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return {
    isComposeOpen: isOpen,
    draft,
    openCompose,
    closeCompose,
    updateDraft,
  };
}
