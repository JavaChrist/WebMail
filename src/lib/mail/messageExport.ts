import type { MailMessage, MailAddress } from "@/types/mail";

function addr(a: MailAddress): string {
  return a.name ? `${a.name} <${a.email}>` : a.email;
}
function addrs(list?: MailAddress[]): string {
  return (list ?? []).map(addr).join(", ");
}
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Corps HTML du message (ou texte enveloppé) pour l'export/impression. */
function bodyHtml(m: MailMessage): string {
  if (m.contentHtml) return m.contentHtml;
  if (m.contentText) return `<pre>${escapeHtml(m.contentText)}</pre>`;
  return "<p>(message vide)</p>";
}

/**
 * Construit un fichier .eml (RFC822 minimal) à partir des champs stockés.
 * TODO : pour un RAW exact, récupérer le message complet via IMAP (comme les PJ).
 */
export function buildEml(m: MailMessage): string {
  const headers = [
    `From: ${addr(m.from)}`,
    `To: ${addrs(m.to)}`,
    m.cc && m.cc.length ? `Cc: ${addrs(m.cc)}` : null,
    `Subject: ${m.subject || "(sans objet)"}`,
    `Date: ${m.timestamp.toUTCString()}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset=utf-8',
  ]
    .filter(Boolean)
    .join("\r\n");
  return `${headers}\r\n\r\n${bodyHtml(m)}`;
}

export function downloadEml(m: MailMessage): void {
  const blob = new Blob([buildEml(m)], { type: "message/rfc822" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(m.subject || "message")
    .replace(/[^\w.\- ]+/g, "_")
    .trim()
    .slice(0, 60) || "message"}.eml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Ouvre une fenêtre d'impression avec en-têtes + corps HTML du message. */
export function printMessage(m: MailMessage): void {
  const w = window.open("", "_blank", "width=820,height=640");
  if (!w) return;
  const meta = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111;border-bottom:1px solid #ddd;padding-bottom:10px;margin-bottom:14px;">
      <div style="font-size:18px;font-weight:bold;margin-bottom:8px;">${escapeHtml(
        m.subject || "(sans objet)"
      )}</div>
      <div><strong>De :</strong> ${escapeHtml(addr(m.from))}</div>
      <div><strong>À :</strong> ${escapeHtml(addrs(m.to)) || "—"}</div>
      ${
        m.cc && m.cc.length
          ? `<div><strong>Cc :</strong> ${escapeHtml(addrs(m.cc))}</div>`
          : ""
      }
      <div><strong>Date :</strong> ${escapeHtml(m.timestamp.toLocaleString("fr-FR"))}</div>
    </div>`;
  w.document.write(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(
      m.subject || "Message"
    )}</title></head><body style="margin:24px;">${meta}<div>${bodyHtml(
      m
    )}</div></body></html>`
  );
  w.document.close();
  w.focus();
  // Laisse le DOM/les images se charger avant l'impression.
  setTimeout(() => {
    w.print();
  }, 300);
}
