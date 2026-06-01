"use client";

import { useCallback, useEffect, useState } from "react";

export type MailViewMode = "list" | "right" | "bottom";

const STORAGE_KEY = "mail.viewMode";
const VALID_MODES: MailViewMode[] = ["list", "right", "bottom"];

/**
 * Gère le mode d'affichage de l'aperçu du message et le persiste dans
 * localStorage. Par défaut « list » : la liste occupe toute la largeur et le
 * contenu d'un message ne s'affiche qu'au clic.
 */
export function useMailViewMode() {
  const [viewMode, setViewModeState] = useState<MailViewMode>("list");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VALID_MODES.includes(stored as MailViewMode)) {
        setViewModeState(stored as MailViewMode);
      }
    } catch {
      /* localStorage indisponible : on garde le défaut */
    }
  }, []);

  const setViewMode = useCallback((mode: MailViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* noop */
    }
  }, []);

  return { viewMode, setViewMode };
}
