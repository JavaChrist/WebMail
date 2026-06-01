import Imap from "imap";
import { simpleParser } from "mailparser";

interface ImapConnInfo {
  email: string;
  imapServer: string;
  imapPort: number;
  imapSecure?: boolean;
}

export interface AttachmentIdentifier {
  index?: number;
  filename?: string;
}

export interface FetchedAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

function createImap(account: ImapConnInfo, password: string): Imap {
  return new Imap({
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
    connTimeout: 60000,
    authTimeout: 60000,
  });
}

/**
 * Récupère une pièce jointe à la demande via IMAP.
 *
 * Première version : on télécharge le message complet par UID puis on le parse
 * avec `simpleParser` pour en extraire la pièce jointe ciblée (par index, puis
 * par filename en repli). Une optimisation possible serait un FETCH partiel du
 * body part exact via la BODYSTRUCTURE, mais le fetch complet reste acceptable
 * et bien plus simple à fiabiliser.
 *
 * Retourne `null` si le message ou la pièce jointe est introuvable.
 */
export function fetchAttachment(
  account: ImapConnInfo,
  password: string,
  imapPath: string,
  uid: number,
  identifier: AttachmentIdentifier
): Promise<FetchedAttachment | null> {
  return new Promise((resolve, reject) => {
    const imap = createImap(account, password);
    let settled = false;

    const finish = (value: FetchedAttachment | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        imap.end();
      } catch {
        /* noop */
      }
      resolve(value);
    };

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        imap.end();
      } catch {
        /* noop */
      }
      reject(err);
    };

    const timeout = setTimeout(
      () => fail(new Error("Timeout de la récupération de la pièce jointe")),
      120000
    );

    imap.once("ready", () => {
      imap.openBox(imapPath, true, (errOpen) => {
        if (errOpen) {
          fail(new Error("Impossible d'ouvrir le dossier IMAP"));
          return;
        }

        let buffer = "";
        let ended = false;
        let bodyDone = false;

        const tryParse = async () => {
          if (!ended || !bodyDone) return;
          try {
            const parsed = await simpleParser(buffer);
            const list = parsed.attachments || [];
            let att = undefined as (typeof list)[number] | undefined;

            if (
              typeof identifier.index === "number" &&
              identifier.index >= 0 &&
              list[identifier.index]
            ) {
              att = list[identifier.index];
            }
            if (!att && identifier.filename) {
              att = list.find((a) => a.filename === identifier.filename);
            }
            if (!att && list.length === 1) {
              att = list[0];
            }

            if (!att || !att.content) {
              finish(null);
              return;
            }

            finish({
              filename: att.filename || "piece-jointe",
              contentType: att.contentType || "application/octet-stream",
              content: att.content as Buffer,
            });
          } catch {
            finish(null);
          }
        };

        const f = imap.fetch(uid, { bodies: "", markSeen: false });
        f.on("message", (msg) => {
          msg.on("body", (stream) => {
            stream.on("data", (chunk) => {
              buffer += chunk.toString("utf8");
            });
            stream.once("end", () => {
              bodyDone = true;
              tryParse();
            });
          });
        });
        f.once("error", () => fail(new Error("Erreur de récupération IMAP")));
        f.once("end", () => {
          ended = true;
          tryParse();
        });
      });
    });

    imap.once("error", (err: Error) =>
      fail(new Error(`Erreur de connexion IMAP: ${err.message}`))
    );

    imap.connect();
  });
}
