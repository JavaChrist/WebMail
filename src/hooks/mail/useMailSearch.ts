"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MailMessage } from "@/types/mail";
import { searchMessagesByUser } from "@/lib/mail/messageService";

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;
const MAX_RESULTS = 100;
const FETCH_CAP = 500;

/**
 * Recherche globale multi-comptes. Quand la saisie (débouncée) atteint
 * MIN_CHARS, on rapatrie une fois un lot borné des messages de l'utilisateur
 * (tous comptes), mis en cache, puis on filtre `contains` côté client.
 */
export function useMailSearch(term: string, userId: string | null) {
  const [debounced, setDebounced] = useState(term);
  const [dataset, setDataset] = useState<MailMessage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const loadedForUser = useRef<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [term]);

  const active = debounced.trim().length >= MIN_CHARS;

  // Invalide le cache si l'utilisateur change.
  useEffect(() => {
    if (loadedForUser.current !== userId) {
      setDataset(null);
      loadedForUser.current = null;
    }
  }, [userId]);

  useEffect(() => {
    if (!active || !userId) return;
    if (dataset !== null) return;
    let cancelled = false;
    setLoading(true);
    searchMessagesByUser(userId, FETCH_CAP)
      .then((list) => {
        if (!cancelled) {
          setDataset(list);
          loadedForUser.current = userId;
        }
      })
      .catch((e) => console.error("Erreur de recherche:", e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, userId, dataset]);

  const refresh = useCallback(() => setDataset(null), []);

  const results = useMemo(() => {
    if (!active || !dataset) return [];
    const t = debounced.trim().toLowerCase();
    return dataset
      .filter((m) => {
        const haystack = [
          m.subject,
          m.from.email,
          m.from.name ?? "",
          m.snippet ?? "",
          ...m.to.map((x) => `${x.email} ${x.name ?? ""}`),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(t);
      })
      .slice(0, MAX_RESULTS);
  }, [active, dataset, debounced]);

  return { active, results, loading, refresh };
}
