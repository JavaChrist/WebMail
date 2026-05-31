import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { adminDb } from "@/config/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { decryptPassword } from "@/lib/mail/crypto";
import { verifyRequest, AuthError } from "@/lib/mail/apiAuth";

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

    const password = decryptPassword(account.password as string);
    const signature = (account.signature as string) || "";
    const htmlBody = `${(content as string) || ""}${
      signature ? `<br/><br/>${signature}` : ""
    }`;

    const transporter = nodemailer.createTransport({
      host: account.smtpServer as string,
      port: account.smtpPort as number,
      secure: Boolean(account.smtpSecure),
      auth: { user: account.email as string, pass: password },
    });

    await transporter.sendMail({
      from: `${(account.displayName as string) || account.email} <${account.email}>`,
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject: subject || "(sans objet)",
      html: htmlBody,
    });

    const sentFolderSnap = await adminDb
      .collection("mailFolders")
      .where("accountId", "==", accountId)
      .where("folderType", "==", "sent")
      .limit(1)
      .get();
    const sentFolderId = sentFolderSnap.empty ? null : sentFolderSnap.docs[0].id;

    if (sentFolderId) {
      const now = Timestamp.now();
      await adminDb.collection("mailMessages").add({
        userId: uid,
        accountId,
        folderIds: [sentFolderId],
        primaryFolderId: sentFolderId,
        messageId: `sent_${Date.now()}@webmail`,
        from: {
          email: account.email,
          name: (account.displayName as string) || "",
        },
        to: parseAddresses(to),
        cc: parseAddresses(cc),
        bcc: parseAddresses(bcc),
        subject: subject || "(sans objet)",
        snippet: ((content as string) || "").replace(/<[^>]+>/g, "").slice(0, 160),
        contentHtml: htmlBody,
        contentText: "",
        timestamp: now,
        read: true,
        starred: false,
        hasAttachments: false,
        flags: [],
        createdAt: now,
        updatedAt: now,
      });
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
