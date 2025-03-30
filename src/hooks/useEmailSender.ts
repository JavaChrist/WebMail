import { auth } from "@/config/firebase";
import { EmailAccount } from "@/components/email/EmailAccountModal";

interface EmailData {
  to: string;
  subject: string;
  content: string;
  attachments?: File[];
}

export const useEmailSender = (emailAccounts: EmailAccount[]) => {
  console.log(
    "Hook useEmailSender initialisé avec les comptes:",
    emailAccounts.map((account) => ({
      id: account.id,
      email: account.email,
      smtpServer: account.smtpServer,
    }))
  );

  const handleSendEmail = async (emailData: EmailData) => {
    try {
      console.log("Début de l'envoi d'email:", {
        emailData,
        currentUser: auth.currentUser?.email,
        accountsCount: emailAccounts.length,
      });

      if (!auth.currentUser) {
        console.error("Utilisateur non connecté");
        throw new Error("Utilisateur non connecté");
      }

      if (!emailAccounts || emailAccounts.length === 0) {
        console.error("Aucun compte email configuré:", emailAccounts);
        throw new Error("Aucun compte email configuré");
      }

      const selectedAccount = emailAccounts[0];
      console.log("Compte sélectionné:", {
        id: selectedAccount.id,
        email: selectedAccount.email,
        smtpServer: selectedAccount.smtpServer,
      });

      if (!selectedAccount || !selectedAccount.id) {
        console.error("Compte invalide:", selectedAccount);
        throw new Error("Configuration du compte email invalide");
      }

      if (!emailData.to || !emailData.subject || !emailData.content) {
        console.error("Données d'email manquantes:", emailData);
        throw new Error("Veuillez remplir tous les champs du formulaire");
      }

      const requestBody = {
        userId: auth.currentUser.uid,
        accountId: selectedAccount.id,
        to: emailData.to,
        subject: emailData.subject,
        content: emailData.content,
      };

      console.log(
        "Corps de la requête complet:",
        JSON.stringify(requestBody, null, 2)
      );

      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Erreur de la réponse:", error);
        throw new Error(error.error || "Erreur lors de l'envoi de l'email");
      }

      const result = await response.json();
      console.log("Email envoyé avec succès:", result);
      return result;
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'email:", error);
      throw error;
    }
  };

  return { handleSendEmail };
};
