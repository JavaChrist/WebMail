import { useState } from "react";

export function useEmailSelection() {
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  const handleSelectionChange = async (
    emailIds: string[],
    selected: boolean
  ) => {
    try {
      const response = await fetch("/api/email/select", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ emailIds, selected }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la mise à jour de la sélection");
      }

      const newSelected = new Set(selectedEmails);
      if (selected) {
        emailIds.forEach((id) => newSelected.add(id));
      } else {
        emailIds.forEach((id) => newSelected.delete(id));
      }
      setSelectedEmails(newSelected);
    } catch (error) {
      console.error("Erreur lors de la sélection des emails:", error);
      // Vous pouvez ajouter ici une notification d'erreur
    }
  };

  const clearSelection = () => {
    setSelectedEmails(new Set());
  };

  return {
    selectedEmails,
    handleSelectionChange,
    clearSelection,
  };
}
