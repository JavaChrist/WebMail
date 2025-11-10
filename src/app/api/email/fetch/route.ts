import { NextResponse } from "next/server";
import { simpleParser, AddressObject } from "mailparser";
import { adminDb } from "@/config/firebase-admin";
import CryptoJS from "crypto-js";
import Imap from "imap";

interface EmailAccount {
  email: string;
  password: string;
  imapServer: string;
  imapPort: number;
  useSSL: boolean;
}

interface ImapError extends Error {
  code?: string;
  command?: string;
}

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
      `Erreur lors du décryptage du mot de passe: ${error instanceof Error ? error.message : "Erreur inconnue"
      }`
    );
  }
};

const convertEmailAddressToString = (address: AddressObject | AddressObject[] | string | undefined): string => {
  if (!address) return "";
  if (typeof address === 'string') return address;
  if (Array.isArray(address)) {
    return address.map(addr => addr.text || "").join(", ");
  }
  return address.text || "";
};

const fetchEmails = async (
  emailAccount: EmailAccount,
  password: string,
  userId: string
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
      tls: true,
      tlsOptions: {
        rejectUnauthorized: false,
        servername: emailAccount.imapServer,
        minVersion: 'TLSv1.2'
      },
      debug: console.log,
      connTimeout: 120000, // 2 minutes pour la connexion initiale
      authTimeout: 120000, // 2 minutes pour l'authentification
      keepalive: {
        interval: 30000, // Vérifier la connexion toutes les 30 secondes
        idleInterval: 10000 // Intervalle d'inactivité de 10 secondes
      }
    });

    const connectionTimeout = setTimeout(() => {
      console.error("❌ Timeout de la connexion IMAP");
      imap.end();
      reject(new Error("Timeout de la connexion IMAP"));
    }, 900000); // 15 minutes de timeout global pour permettre de récupérer tous les emails

    let isConnected = false;
    let isAuthenticated = false;

    imap.once("error", (err: ImapError) => {
      clearTimeout(connectionTimeout);
      console.error("❌ Erreur IMAP détaillée:", {
        message: err.message,
        stack: err.stack,
        name: err.name,
        code: err.code,
        command: err.command,
        isConnected,
        isAuthenticated
      });
      imap.end();
      reject(new Error(`Erreur de connexion IMAP: ${err.message}`));
    });

    imap.once("end", () => {
      clearTimeout(connectionTimeout);
      console.log("✅ Connexion IMAP terminée", {
        isConnected,
        isAuthenticated
      });
    });

    imap.once("ready", () => {
      clearTimeout(connectionTimeout);
      isConnected = true;
      isAuthenticated = true;
      console.log("✅ Connexion IMAP établie avec succès");
      console.log("📋 Configuration IMAP:", {
        user: emailAccount.email,
        host: emailAccount.imapServer,
        port: emailAccount.imapPort,
        tls: true,
        secure: true,
        isConnected,
        isAuthenticated
      });

      // Vérifier si la connexion est toujours active
      const checkConnection = setInterval(() => {
        if (!isConnected || !isAuthenticated) {
          console.error("❌ Connexion IMAP perdue");
          clearInterval(checkConnection);
          imap.end();
          reject(new Error("Connexion IMAP perdue"));
        }
      }, 10000);

      console.log("📋 Liste des dossiers disponibles:");
      imap.getBoxes((err: Error | null, boxes: Imap.MailBoxes) => {
        if (err) {
          console.error("❌ Erreur lors de la liste des dossiers:", err);
          clearInterval(checkConnection);
          imap.end();
          reject(err);
          return;
        }

        const folderNames = Object.keys(boxes);
        console.log("📂 Dossiers trouvés:", folderNames);

        if (folderNames.length === 0) {
          console.error("❌ Aucun dossier trouvé");
          clearInterval(checkConnection);
          imap.end();
          reject(new Error("Aucun dossier trouvé"));
          return;
        }

        // Fonction pour récupérer les emails d'un dossier spécifique
        const fetchFolderEmails = (folder: string): Promise<EmailData[]> => {
          return new Promise((resolveFolder, rejectFolder) => {
            if (!isConnected || !isAuthenticated) {
              rejectFolder(new Error("Connexion IMAP perdue"));
              return;
            }

            console.log(`📂 Tentative d'ouverture du dossier ${folder}...`);

            // Timeout pour l'ouverture du dossier
            const folderTimeout = setTimeout(() => {
              console.error(`❌ Timeout lors de l'ouverture du dossier ${folder}`);
              resolveFolder([]);
            }, 120000); // 2 minutes timeout pour chaque dossier

            imap.openBox(folder, false, (err, box) => {
              clearTimeout(folderTimeout);

              if (err) {
                console.log(
                  `⚠️ Dossier ${folder} non trouvé ou inaccessible:`,
                  err.message
                );
                resolveFolder([]);
                return;
              }

              if (!isConnected || !isAuthenticated) {
                rejectFolder(new Error("Connexion IMAP perdue"));
                return;
              }

              console.log(`📦 Informations du dossier ${folder}:`, {
                messages: box.messages.total,
                flags: box.flags,
                permFlags: box.permFlags,
                uidvalidity: box.uidvalidity
              });

              if (box.messages.total === 0) {
                console.log(`📭 Dossier ${folder} vide`);
                resolveFolder([]);
                return;
              }

              console.log(`📥 Récupération des emails du dossier ${folder}...`);

              // Récupérer TOUS les emails
              const messageRange = `1:${box.messages.total}`;
              console.log(`🔍 Plage de messages à récupérer: ${messageRange} (${box.messages.total} emails)`);

              const expectedTotal = box.messages.total;

              // Timeout pour la récupération des messages
              const fetchTimeout = setTimeout(() => {
                console.error(`❌ Timeout global - ${parsedCount}/${expectedTotal} emails parsés`);
                if (!hasResolved) {
                  hasResolved = true;
                  resolveFolder(emails); // Retourner les emails déjà parsés
                }
              }, 600000); // 10 minutes timeout pour permettre le parsing de tous les emails

              const fetch = imap.seq.fetch(messageRange, {
                bodies: '',
                struct: true
              });

              const emails: EmailData[] = [];
              let parsedCount = 0; // Messages parsés
              let hasError = false;
              let hasResolved = false;

              fetch.on('message', (msg, seqno) => {
                if (!isConnected || !isAuthenticated) {
                  hasError = true;
                  return;
                }

                console.log(`📨 Traitement de l'email #${seqno}`);
                let messageBuffer = '';

                msg.on('body', (stream) => {
                  stream.on('data', (chunk) => {
                    messageBuffer += chunk.toString('utf8');
                  });
                });

                msg.once('end', async () => {

                  try {
                    if (hasError || !isConnected || !isAuthenticated) {
                      parsedCount++;
                      return;
                    }

                    console.log(`📧 Traitement du contenu de l'email #${seqno}`);
                    const parsed = await simpleParser(messageBuffer);

                    if (parsed.messageId) {
                      console.log(`✅ Email #${seqno} parsé avec succès:`, {
                        messageId: parsed.messageId,
                        subject: parsed.subject,
                        from: convertEmailAddressToString(parsed.from),
                        to: convertEmailAddressToString(parsed.to)
                      });

                      const emailData: EmailData = {
                        messageId: parsed.messageId,
                        from: convertEmailAddressToString(parsed.from),
                        to: convertEmailAddressToString(parsed.to),
                        subject: parsed.subject || "",
                        content: parsed.html || parsed.textAsHtml || "",
                        timestamp: parsed.date || new Date(),
                        read: false,
                        starred: false,
                        folder: folder.toLowerCase(),
                        userId: userId,
                        selected: false,
                      };

                      emails.push(emailData);
                      console.log(`✅ Email #${seqno} ajouté à la liste`);
                    }
                  } catch (error) {
                    console.error(`❌ Erreur lors du traitement de l'email #${seqno}:`, error);
                    hasError = true;
                  } finally {
                    parsedCount++;
                    console.log(`📊 Progression: ${parsedCount}/${expectedTotal} emails parsés`);

                    if (parsedCount === expectedTotal && !hasResolved) {
                      hasResolved = true;
                      clearTimeout(fetchTimeout);
                      console.log(`✅ ${emails.length} nouveaux emails traités dans ${folder}`);
                      resolveFolder(emails);
                    }
                  }
                });
              });

              fetch.once('error', (err) => {
                if (!hasResolved) {
                  hasResolved = true;
                  clearTimeout(fetchTimeout);
                  console.error(`❌ Erreur lors de la récupération des emails:`, err);
                  hasError = true;
                  resolveFolder(emails);
                }
              });

              fetch.once('end', () => {
                clearTimeout(fetchTimeout);
                console.log(`✅ Fin de la récupération des emails dans ${folder}`);
                console.log(`⏳ Attente du parsing de tous les emails (${parsedCount}/${expectedTotal} déjà parsés)...`);
                // Attendre jusqu'à 5 minutes pour que tous les emails soient parsés
                setTimeout(() => {
                  if (!hasResolved) {
                    hasResolved = true;
                    console.log(`⚠️ Timeout de sécurité - Résolution du dossier ${folder} avec ${emails.length} emails (${parsedCount}/${expectedTotal} parsés)`);
                    resolveFolder(emails);
                  }
                }, 300000); // 5 minutes pour le parsing de tous les emails
              });
            });
          });
        };

        // Récupérer les emails de la boîte de réception et du dossier envoyés
        Promise.all([
          fetchFolderEmails("INBOX"),
          fetchFolderEmails("Sent"),
          fetchFolderEmails("Sent Items"),
          fetchFolderEmails("Envoyés"),
          fetchFolderEmails("Éléments envoyés"),
          fetchFolderEmails("Drafts"),
          fetchFolderEmails("Brouillons"),
          fetchFolderEmails("Trash"),
          fetchFolderEmails("Corbeille")
        ])
          .then(([inboxEmails, sentEmails, sentItemsEmails, sentEmailsFr, sentItemsEmailsFr, draftsEmails, draftsEmailsFr, trashEmails, trashEmailsFr]) => {
            clearInterval(checkConnection);

            // Utiliser un Set pour éviter les doublons
            const uniqueEmails = new Map<string, EmailData>();

            // Fonction pour ajouter des emails sans doublons
            const addUniqueEmails = (emails: EmailData[], folder: string) => {
              emails.forEach(email => {
                if (!uniqueEmails.has(email.messageId)) {
                  uniqueEmails.set(email.messageId, { ...email, folder });
                }
              });
            };

            // Ajouter les emails de chaque dossier
            addUniqueEmails(inboxEmails, "inbox");
            addUniqueEmails(sentEmails, "sent");
            addUniqueEmails(sentItemsEmails, "sent");
            addUniqueEmails(sentEmailsFr, "sent");
            addUniqueEmails(sentItemsEmailsFr, "sent");
            addUniqueEmails(draftsEmails, "drafts");
            addUniqueEmails(draftsEmailsFr, "drafts");
            addUniqueEmails(trashEmails, "trash");
            addUniqueEmails(trashEmailsFr, "trash");

            // Convertir le Map en tableau
            const allEmails = Array.from(uniqueEmails.values());

            console.log(`✅ Total des emails uniques synchronisés: ${allEmails.length}`);
            imap.end();
            resolve(allEmails);
          })
          .catch((error) => {
            clearInterval(checkConnection);
            console.error(
              "❌ Erreur lors de la synchronisation des dossiers:",
              error
            );
            imap.end();
            reject(error);
          });
      });
    });

    imap.connect();
  });
};

export async function POST(request: Request) {
  console.log("🚀 Début de la requête de synchronisation");
  console.log("🔍 Test adminDb:", !!adminDb);
  console.log("🔍 Type adminDb:", typeof adminDb);

  // Créer une promesse avec timeout global
  const timeoutPromise = new Promise<EmailData[]>((_, reject) => {
    setTimeout(() => {
      reject(new Error("Timeout global de la synchronisation"));
    }, 900000); // 15 minutes maximum pour permettre le parsing de tous les emails
  });

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
    console.log("🔍 Appel à adminDb.collection()...");
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

    // Récupérer les nouveaux emails avec timeout
    const fetchPromise = fetchEmails(
      emailAccount as EmailAccount,
      password,
      userId
    );

    // Utiliser Promise.race pour avoir un timeout global
    const newEmails = await Promise.race([fetchPromise, timeoutPromise]) as EmailData[];

    if (newEmails && newEmails.length > 0) {
      console.log(`✅ ${newEmails.length} nouveaux emails trouvés`);
      const batch = adminDb.batch();

      // Vérifier les doublons avant d'ajouter
      const existingEmailsQuery = await adminDb
        .collection("emails")
        .where("userId", "==", userId)
        .get();

      const existingMessageIdsSet = new Set(
        existingEmailsQuery.docs.map(doc => doc.data().messageId)
      );

      // Filtrer les emails qui n'existent pas déjà
      const uniqueNewEmails = newEmails.filter(
        (email: EmailData) => !existingMessageIdsSet.has(email.messageId)
      );

      console.log(`📧 ${uniqueNewEmails.length} emails uniques à ajouter`);

      uniqueNewEmails.forEach((email: EmailData) => {
        const docRef = adminDb.collection("emails").doc();
        batch.set(docRef, email);
      });

      await batch.commit();
      console.log("✅ Emails ajoutés avec succès");
    }

    return NextResponse.json({
      message: `${newEmails?.length || 0} emails synchronisés`,
      totalEmails: newEmails?.length || 0,
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
