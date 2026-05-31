"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MailMessage } from "@/types/mail";
import {
  listMessagesByFolder,
  markRead as markReadService,
  toggleStar as toggleStarService,
  moveMessage as moveMessageService,
  deleteMessagePermanently,
} from "@/lib/mail/messageService";

export function useMailMessages(
  accountId: string | null,
  folderId: string | null
) {
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const reload = useCallback(async () => {
    if (!accountId || !folderId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    try {
      const list = await listMessagesByFolder(accountId, folderId);
      setMessages(list);
    } catch (error) {
      console.error("Erreur lors du chargement des messages:", error);
    } finally {
      setLoading(false);
    }
  }, [accountId, folderId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filteredMessages = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return messages;
    return messages.filter((m) => {
      const haystack = [
        m.subject,
        m.from.email,
        m.from.name ?? "",
        m.snippet ?? "",
        ...m.to.map((t) => `${t.email} ${t.name ?? ""}`),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [messages, searchTerm]);

  const markRead = useCallback(async (messageId: string, read: boolean) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, read } : m))
    );
    try {
      await markReadService(messageId, read);
    } catch (error) {
      console.error("Erreur lors du marquage lu/non lu:", error);
    }
  }, []);

  const toggleStar = useCallback(
    async (messageId: string, starred: boolean) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, starred } : m))
      );
      try {
        await toggleStarService(messageId, starred);
      } catch (error) {
        console.error("Erreur lors du marquage favori:", error);
      }
    },
    []
  );

  const moveMessage = useCallback(
    async (messageId: string, targetFolderId: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      try {
        await moveMessageService(messageId, targetFolderId);
      } catch (error) {
        console.error("Erreur lors du déplacement du message:", error);
        await reload();
      }
    },
    [reload]
  );

  const deleteMessage = useCallback(async (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    try {
      await deleteMessagePermanently(messageId);
    } catch (error) {
      console.error("Erreur lors de la suppression du message:", error);
    }
  }, []);

  return {
    messages: filteredMessages,
    rawMessages: messages,
    loading,
    searchTerm,
    setSearchTerm,
    reload,
    markRead,
    toggleStar,
    moveMessage,
    deleteMessage,
  };
}
