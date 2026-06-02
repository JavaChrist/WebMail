import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { adminDb } from "@/config/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { decryptPassword } from "@/lib/mail/crypto";
import { verifyRequest, AuthError } from "@/lib/mail/apiAuth";
import { appendToMailbox } from "@/lib/mail/imapAppend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Limite de taille cumulée des pièces jointes (~20 Mo de binaire). */
const MAX_ATTACHMENTS_BYTES = 20 * 1024 * 1024;

interface IncomingAttachment {
  filename: string;
  contentType?: string;
  contentBase64: string;
}

function parseAddresses(value?: string) {
  if (!value) return [];
  return value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((email) => ({ email }));
}

export async function POST(request: Request) {
  try {
    const { uid } = await verifyRequest(request);
    const body = await request.json();
    const { accountId, to, cc, bcc, subject, content } = body;
    const incoming: IncomingAttachment[] = Array.isArray(body.attachments)
      ? body.attachments
      : [];

    if (!accountId || !to) {
      return NextResponse.json(
        { error: "accountId et destinataire sont requis" },
        { status: 400 }
      );
    }

    const accountSnap = await adminDb
      .collection("mailAccounts")
      .doc(accountId)
      .get();
    if (!accountSnap.exists || accountSnap.data()?.userId !== uid) {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    }

    const account = accountSnap.data() as Record<string, unknown>;
    if (!account.email || !account.password) {
      return NextResponse.json(
        { error: "Configuration du compte incomplète" },
        { status: 400 }
      );
    }

    // Pièces jointes : décodage base64 + contrôle de taille cumulée.
    const attachments = incoming
      .filter((a) => a && a.contentBase64)
      .map((a) => ({
        filename: a.filename || "piece-jointe",
        content: Buffer.from(a.contentBase64, "base64"),
        contentType: a.contentType || "application/octet-stream",
      }));
    const totalBytes = attachments.reduce((sum, a) => sum + a.content.length, 0);
    if (totalBytes > MAX_ATTACHMENTS_BYTES) {
      return NextResponse.json(
        { error: "Pièces jointes trop volumineuses (max 20 Mo au total)" },
        { status: 400 }
      );
    }

    const password = decryptPassword(account.password as string);
    // La signature est désormais insérée côté client dans le corps : pas de
    // ré-ajout serveur pour éviter les doublons.
    const htmlBody = (content as string) || "";

    const fromHeader = `${
      (account.displayName as string) || account.email
    } <${account.email}>`;

    const mailOptions = {
      from: fromHeader,
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject: subject || "(sans objet)",
      html: htmlBody,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    const transporter = nodemailer.createTransport({
      host: account.smtpServer as string,
      port: account.smtpPort as number,
      secure: Boolean(account.smtpSecure),
      auth: { user: account.email as string, pass: password },
    });

    await transporter.sendMail(mailOptions);

    // Dossier « Envoyés » (Firestore + imapPath pour l'APPEND).
    const sentFolderSnap = await adminDb
      .collection("mailFolders")
      .where("accountId", "==", accountId)
      .where("folderType", "==", "sent")
      .limit(1)
      .get();
    const sentFolderDoc = sentFolderSnap.empty ? null : sentFolderSnap.docs[0];
    const sentFolderId = sentFolderDoc?.id ?? null;
    const sentImapPath = (sentFolderDoc?.data().imapPath as string) || "";

    if (sentFolderId) {
      const now = Timestamp.now();
      await adminDb.collection("mailMessages").add({
        userId: uid,
        accountId,
        folderIds: [sentFolderId],
        primaryFolderId: sentFolderId,
        messageId: `sent_${Date.now()}@webmail`,
        imapUid: null,
        from: {
          email: account.email,
          name: (account.displayName as string) || "",
        },
        to: parseAddresses(to),
        cc: parseAddresses(cc),
        bcc: parseAddresses(bcc),
        subject: subject || "(sans objet)",
        snippet: ((content as string) || "")
          .replace(/<[^>]+>/g, "")
          .slice(0, 160),
        contentHtml: htmlBody,
        contentText: "",
        timestamp: now,
        read: true,
        starred: false,
        hasAttachments: attachments.length > 0,
        attachments: attachments.map((a, i) => ({
          filename: a.filename,
          contentType: a.contentType,
          size: a.content.length,
          index: i,
        })),
        flags: [],
        createdAt: now,
        updatedAt: now,
      });
    }

    // APPEND IMAP best-effort : ne bloque pas l'envoi en cas d'échec.
    if (sentImapPath) {
      try {
        const raw = await new Promise<Buffer>((resolve, reject) => {
          new MailComposer(mailOptions).compile().build((err, message) =>
            err ? reject(err) : resolve(message)
          );
        });
        await appendToMailbox(
          {
            email: account.email as string,
            imapServer: (account.imapServer as string) ?? "",
            imapPort: (account.imapPort as number) ?? 993,
            imapSecure:
              account.imapSecure !== undefined
                ? Boolean(account.imapSecure)
                : true,
          },
          password,
          sentImapPath,
          raw
        );
      } catch (appendError) {
        console.warn(
          "APPEND IMAP du message envoyé échoué (toléré):",
          appendError
        );
      }
    }

    return NextResponse.json({ message: "Email envoyé avec succès" });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erreur lors de l'envoi:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur lors de l'envoi" },
      { status: 500 }
    );
  }
}
