import { NextResponse } from "next/server";
import { simpleParser } from "mailparser";
import { adminDb, adminStorage } from "@/config/firebase-admin";
import CryptoJS from "crypto-js";
import Imap from "imap";

interface EmailData {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  content: string;
  timestamp: Date;
  read: boolean;
  starred: boolean;
  folder: string;
  userId: string;
  selected: boolean;
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
    url: string;
  }>;
}

const decryptPassword = (encryptedPassword: string) => {
  try {
    if (!process.env.NEXT_PUBLIC_ENCRYPTION_KEY) {
      console.error(
        "❌ NEXT_PUBLIC_ENCRYPTION_KEY n'est pas définie dans les variables d'environnement"
      );
      throw new Error("Clé de chiffrement non définie");
    }

    console.log(
      "🔑 Tentative de déchiffrement avec la clé:",
      process.env.NEXT_PUBLIC_ENCRYPTION_KEY.substring(0, 5) + "..."
    );
    console.log(
      "🔐 Mot de passe chiffré reçu:",
      encryptedPassword.substring(0, 20) + "..."
    );

    const bytes = CryptoJS.AES.decrypt(
      encryptedPassword,
      process.env.NEXT_PUBLIC_ENCRYPTION_KEY
    );
    const result = bytes.toString(CryptoJS.enc.Utf8);

    if (!result) {
      console.error("❌ Le déchiffrement a produit une chaîne vide");
      throw new Error("Le déchiffrement a échoué - résultat vide");
    }

    console.log("✅ Déchiffrement réussi");
    return result;
  } catch (error) {
    console.error("❌ Erreur détaillée lors du décryptage:", error);
    console.error(
      "🔑 Clé de chiffrement utilisée:",
      process.env.NEXT_PUBLIC_ENCRYPTION_KEY ? "présente" : "manquante"
    );
    console.error(
      "🔐 Mot de passe chiffré (premiers caractères):",
      encryptedPassword.substring(0, 20) + "..."
    );
    throw new Error(
      `Erreur lors du décryptage du mot de passe: ${
        error instanceof Error ? error.message : "Erreur inconnue"
      }`
    );
  }
};

const processEmails = (
  messages: any[],
  existingMessageIds: Set<string>,
  userId: string,
  imap: Imap
): Promise<EmailData[]> => {
  return new Promise((resolve, reject) => {
    const emails: EmailData[] = [];
    let processedCount = 0;

    messages.forEach((msg) => {
      const stream = imap.fetch(msg, {
        bodies: "",
        struct: true,
      });

      stream.on("message", (msg: any) => {
        msg.on("body", (stream: any) => {
          let buffer = "";
          stream.on("data", (chunk: Buffer) => {
            buffer += chunk.toString("utf8");
          });
          stream.once("end", async () => {
            try {
              const parsed = await simpleParser(buffer);
              if (!existingMessageIds.has(parsed.messageId)) {
                // Filtrer les pièces jointes valides
                const validAttachments = parsed.attachments.filter((att) => {
                  if (!att.filename || !att.contentType || !att.content) {
                    return false;
                  }
                  // Limiter la taille à 5MB
                  if (att.size && att.size > 5000000) {
                    console.log(
                      "⚠️ Pièce jointe trop grande ignorée:",
                      att.filename
                    );
                    return false;
                  }
                  return true;
                });

                // Traiter les pièces jointes
                const processedAttachments = await Promise.all(
                  validAttachments.map(async (att) => {
                    try {
                      // Créer un nom de fichier unique
                      const uniqueFilename = `${Date.now()}-${att.filename}`;
                      const filePath = `attachments/${userId}/${uniqueFilename}`;

                      // Uploader le fichier dans Firebase Storage
                      const fileRef = adminStorage.bucket().file(filePath);
                      await fileRef.save(att.content, {
                        contentType: att.contentType,
                        metadata: {
                          originalFilename: att.filename,
                          emailMessageId: parsed.messageId,
                        },
                      });

                      // Obtenir l'URL publique
                      const [url] = await fileRef.getSignedUrl({
                        action: "read",
                        expires: "03-01-2500", // URL valide pour longtemps
                      });

                      return {
                        filename: att.filename,
                        contentType: att.contentType,
                        size: att.size || 0,
                        url: url,
                      };
                    } catch (error) {
                      console.error(
                        "Erreur lors du traitement d'une pièce jointe:",
                        error
                      );
                      return null;
                    }
                  })
                );

                const emailData: EmailData = {
                  messageId: parsed.messageId,
                  from: parsed.from?.text || "",
                  to: parsed.to?.text || "",
                  subject: parsed.subject || "",
                  content: parsed.html || parsed.textAsHtml || "",
                  timestamp: parsed.date || new Date(),
                  read: false,
                  starred: false,
                  folder: "inbox",
                  userId: userId,
                  selected: false,
                };

                // Ajouter les pièces jointes valides
                const validProcessedAttachments = processedAttachments.filter(
                  (att): att is NonNullable<typeof att> => att !== null
                );
                if (validProcessedAttachments.length > 0) {
                  emailData.attachments = validProcessedAttachments;
                }

                emails.push(emailData);
              }
            } catch (error) {
              console.error("Erreur lors du traitement d'un email:", error);
            }
            processedCount++;
            if (processedCount === messages.length) {
              resolve(emails);
            }
          });
        });
      });

      stream.once("error", (err: Error) => {
        console.error("Erreur lors de la récupération d'un email:", err);
        reject(err);
      });
    });
  });
};

const fetchEmails = async (
  emailAccount: any,
  password: string,
  userId: string,
  existingMessageIds: Set<string>
): Promise<EmailData[]> => {
  return new Promise((resolve, reject) => {
    console.log("🔐 Configuration IMAP:", {
      user: emailAccount.email,
      host: emailAccount.imapServer,
      port: emailAccount.imapPort,
      useSSL: emailAccount.useSSL,
    });

    const imap = new Imap({
      user: emailAccount.email,
      password: password,
      host: emailAccount.imapServer || "imap.gmail.com",
      port: emailAccount.imapPort || 993,
      tls: emailAccount.useSSL,
      tlsOptions: { rejectUnauthorized: false },
    });

    imap.once("error", (err) => {
      console.error("❌ Erreur IMAP:", err);
      imap.end();
      reject(new Error(`Erreur de connexion IMAP: ${err.message}`));
    });

    imap.once("end", () => {
      console.log("✅ Connexion IMAP terminée");
    });

    imap.once("ready", () => {
      console.log("✅ Connexion IMAP établie");

      // Fonction pour récupérer les emails d'un dossier spécifique
      const fetchFolderEmails = (folder: string): Promise<EmailData[]> => {
        return new Promise((resolveFolder, rejectFolder) => {
          console.log(`📂 Tentative d'ouverture du dossier ${folder}...`);
          imap.openBox(folder, false, (err, box) => {
            if (err) {
              console.log(
                `⚠️ Dossier ${folder} non trouvé ou inaccessible:`,
                err.message
              );
              resolveFolder([]); // Retourner un tableau vide au lieu de rejeter
              return;
            }

            console.log(`📥 Récupération des emails du dossier ${folder}...`);
            imap.search(["ALL"], (err, results) => {
              if (err) {
                console.error(
                  `❌ Erreur lors de la recherche des emails dans ${folder}:`,
                  err
                );
                resolveFolder([]); // Retourner un tableau vide au lieu de rejeter
                return;
              }

              console.log(`✅ ${results.length} emails trouvés dans ${folder}`);
              if (results.length === 0) {
                resolveFolder([]);
                return;
              }

              processEmails(results, existingMessageIds, userId, imap)
                .then((emails) => {
                  console.log(
                    `✅ ${emails.length} nouveaux emails traités dans ${folder}`
                  );
                  resolveFolder(emails);
                })
                .catch((error) => {
                  console.error(
                    `❌ Erreur lors du traitement des emails de ${folder}:`,
                    error
                  );
                  resolveFolder([]); // Retourner un tableau vide au lieu de rejeter
                });
            });
          });
        });
      };

      // Récupérer les emails de la boîte de réception et du dossier envoyés
      Promise.all([
        fetchFolderEmails("INBOX"),
        fetchFolderEmails("Sent"),
        fetchFolderEmails("Envoyés"),
        fetchFolderEmails("[Gmail]/Sent Mail"),
      ])
        .then(([inboxEmails, sentEmails, sentEmailsFr, gmailSentEmails]) => {
          // Combiner tous les emails
          const allEmails = [
            ...inboxEmails.map((email) => ({ ...email, folder: "inbox" })),
            ...sentEmails.map((email) => ({ ...email, folder: "sent" })),
            ...sentEmailsFr.map((email) => ({ ...email, folder: "sent" })),
            ...gmailSentEmails.map((email) => ({ ...email, folder: "sent" })),
          ];

          console.log(`✅ Total des emails synchronisés: ${allEmails.length}`);
          imap.end();
          resolve(allEmails);
        })
        .catch((error) => {
          console.error(
            "❌ Erreur lors de la synchronisation des dossiers:",
            error
          );
          imap.end();
          reject(error);
        });
    });

    imap.connect();
  });
};

export async function POST(request: Request) {
  console.log("🚀 Début de la requête de synchronisation");

  try {
    const body = await request.json();
    console.log("📝 Corps de la requête reçu:", body);

    const { userId, accountId } = body;
    console.log("📝 Paramètres extraits:", { userId, accountId });

    if (!userId || !accountId) {
      console.error("❌ Paramètres manquants:", { userId, accountId });
      return NextResponse.json(
        { error: "Paramètres manquants: userId et accountId sont requis" },
        { status: 400 }
      );
    }

    // Récupérer les paramètres du compte email spécifique
    console.log("🔍 Récupération des paramètres du compte email:", accountId);
    const emailAccountSnap = await adminDb
      .collection("emailAccounts")
      .doc(accountId)
      .get();

    if (!emailAccountSnap.exists) {
      console.error("❌ Compte email non trouvé:", accountId);
      return NextResponse.json(
        { error: "Compte email non trouvé" },
        { status: 404 }
      );
    }

    const emailAccount = emailAccountSnap.data();
    console.log("✅ Compte email récupéré:", {
      email: emailAccount?.email,
      hasPassword: !!emailAccount?.password,
    });

    if (!emailAccount?.email || !emailAccount?.password) {
      console.error("❌ Configuration email incomplète:", {
        hasEmail: !!emailAccount?.email,
        hasPassword: !!emailAccount?.password,
      });
      return NextResponse.json(
        { error: "Configuration email incomplète" },
        { status: 400 }
      );
    }

    console.log("🔐 Tentative de déchiffrement du mot de passe");
    const password = await decryptPassword(emailAccount.password);
    console.log("✅ Mot de passe déchiffré avec succès");

    // Récupérer les emails existants
    const existingEmailsSnapshot = await adminDb
      .collection("emails")
      .where("userId", "==", userId)
      .get();

    const existingMessageIds = new Set(
      existingEmailsSnapshot.docs.map((doc) => doc.data().messageId)
    );

    // Récupérer les nouveaux emails
    const newEmails = await fetchEmails(
      emailAccount,
      password,
      userId,
      existingMessageIds
    );

    if (newEmails.length > 0) {
      console.log(`✅ ${newEmails.length} nouveaux emails trouvés`);
      const batch = adminDb.batch();
      newEmails.forEach((email) => {
        const docRef = adminDb.collection("emails").doc();
        batch.set(docRef, email);
      });
      await batch.commit();
    }

    return NextResponse.json({
      message: `${newEmails.length} emails synchronisés`,
      totalEmails: newEmails.length,
    });
  } catch (error: unknown) {
    console.error("❌ Erreur détaillée:", error);
    console.error(
      "Stack trace:",
      error instanceof Error ? error.stack : "Pas de stack trace"
    );
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur inconnue",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
