import Imap from "imap";
import { decryptPassword } from "./crypto";

interface AccountData {
  email: string;
  password: string;
  imapServer: string;
  imapPort: number;
  imapSecure?: boolean;
}

export interface QuotaResult {
  /** Le serveur supporte l'extension QUOTA et a renvoyé une valeur exploitable. */
  supported: boolean;
  usedMb: number | null;
  quotaMb: number | null;
}

/**
 * Récupère le quota STORAGE via l'extension IMAP QUOTA (RFC 2087).
 *
 * node-imap n'expose pas GETQUOTAROOT : on envoie donc la commande brute sur la
 * socket déjà authentifiée et on parse la réponse non taguée `* QUOTA ... (STORAGE used limit)`.
 * Les valeurs STORAGE sont exprimées en kilo-octets (unités de 1024 octets).
 *
 * Tout échec (serveur sans QUOTA, parsing impossible, timeout) renvoie
 * `{ supported: false }` afin que l'UI affiche un fallback propre.
 */
export function fetchAccountQuota(
  account: AccountData,
  password: string
): Promise<QuotaResult> {
  return new Promise((resolve) => {
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
    const finish = (value: QuotaResult) => {
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

    const timeout = setTimeout(
      () => finish({ supported: false, usedMb: null, quotaMb: null }),
      35000
    );

    imap.once("ready", () => {
      try {
        if (!imap.serverSupports("QUOTA")) {
          finish({ supported: false, usedMb: null, quotaMb: null });
          return;
        }

        // Accès à la socket interne pour émettre une commande brute.
        const sock = (imap as unknown as { _sock?: NodeJS.ReadWriteStream })
          ._sock;
        if (!sock || typeof sock.write !== "function") {
          finish({ supported: false, usedMb: null, quotaMb: null });
          return;
        }

        const tag = "WMQ1";
        let buffer = "";

        const onData = (data: Buffer | string) => {
          buffer += data.toString();
          if (!buffer.includes(`${tag} `)) return;
          sock.removeListener("data", onData);

          const match = buffer.match(/\*\s+QUOTA\s+\S+\s+\(([^)]*)\)/i);
          if (match) {
            const parts = match[1].trim().split(/\s+/);
            const idx = parts.findIndex((p) => /^STORAGE$/i.test(p));
            if (idx >= 0 && parts[idx + 1] && parts[idx + 2]) {
              const usedKb = parseInt(parts[idx + 1], 10);
              const limitKb = parseInt(parts[idx + 2], 10);
              if (
                Number.isFinite(usedKb) &&
                Number.isFinite(limitKb) &&
                limitKb > 0
              ) {
                finish({
                  supported: true,
                  usedMb: Math.round((usedKb / 1024) * 10) / 10,
                  quotaMb: Math.round((limitKb / 1024) * 10) / 10,
                });
                return;
              }
            }
          }
          finish({ supported: false, usedMb: null, quotaMb: null });
        };

        sock.on("data", onData);
        try {
          sock.write(`${tag} GETQUOTAROOT "INBOX"\r\n`);
        } catch {
          finish({ supported: false, usedMb: null, quotaMb: null });
        }
      } catch {
        finish({ supported: false, usedMb: null, quotaMb: null });
      }
    });

    imap.once("error", () =>
      finish({ supported: false, usedMb: null, quotaMb: null })
    );

    imap.connect();
  });
}

export async function getAccountQuota(
  account: AccountData & { password: string }
): Promise<QuotaResult> {
  const password = decryptPassword(account.password);
  return fetchAccountQuota(account, password);
}
