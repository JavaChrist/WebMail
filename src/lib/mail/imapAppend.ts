import Imap from "imap";

interface ImapConnInfo {
  email: string;
  imapServer: string;
  imapPort: number;
  imapSecure?: boolean;
}

/**
 * Ajoute un message brut (RFC822) dans une boîte IMAP (ex. « Sent »/« Envoyés »)
 * via la commande APPEND. Utilisé pour que les messages envoyés apparaissent
 * aussi côté serveur. Tolérant : la connexion est fermée dans tous les cas.
 */
export function appendToMailbox(
  account: ImapConnInfo,
  password: string,
  mailbox: string,
  raw: Buffer | string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: account.email,
      password,
      host: account.imapServer || "imap.ionos.com",
      port: account.imapPort || 993,
      tls: account.imapSecure !== false,
      tlsOptions: {
        rejectUnauthorized: false,
        servername: account.imapServer,
        minVersion: "TLSv1.2",
      },
      connTimeout: 30000,
      authTimeout: 30000,
    });

    let settled = false;
    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        imap.end();
      } catch {
        /* noop */
      }
      if (err) reject(err);
      else resolve();
    };

    const timeout = setTimeout(
      () => done(new Error("Timeout APPEND IMAP")),
      30000
    );

    imap.once("ready", () => {
      imap.append(raw, { mailbox, flags: ["Seen"] }, (err) =>
        done(err || undefined)
      );
    });
    imap.once("error", (err: Error) => done(err));
    imap.connect();
  });
}
