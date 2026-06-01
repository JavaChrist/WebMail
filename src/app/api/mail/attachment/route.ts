import { NextResponse } from "next/server";
import { adminDb } from "@/config/firebase-admin";
import { decryptPassword } from "@/lib/mail/crypto";
import { fetchAttachment } from "@/lib/mail/attachmentService";
import { verifyRequest, AuthError } from "@/lib/mail/apiAuth";

export const maxDuration = 120;

function contentDisposition(
  disposition: "inline" | "attachment",
  filename: string
): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(
    filename
  )}`;
}

export async function GET(request: Request) {
  try {
    const { uid } = await verifyRequest(request);
    const { searchParams } = new URL(request.url);

    const messageId = searchParams.get("messageId");
    let accountId = searchParams.get("accountId");
    let folderId = searchParams.get("folderId");
    let imapUid = searchParams.get("imapUid")
      ? Number(searchParams.get("imapUid"))
      : NaN;

    const indexParam = searchParams.get("index");
    const filenameParam = searchParams.get("filename") || undefined;
    const disposition =
      searchParams.get("disposition") === "inline" ? "inline" : "attachment";

    // Résolution via le message Firestore (chemin privilégié)
    if (messageId) {
      const msgSnap = await adminDb
        .collection("mailMessages")
        .doc(messageId)
        .get();
      if (!msgSnap.exists || msgSnap.data()?.userId !== uid) {
        return NextResponse.json(
          { error: "Message introuvable" },
          { status: 404 }
        );
      }
      const msg = msgSnap.data() as Record<string, unknown>;
      accountId = (msg.accountId as string) ?? accountId;
      folderId = (msg.primaryFolderId as string) ?? folderId;
      imapUid =
        typeof msg.imapUid === "number" ? (msg.imapUid as number) : imapUid;
    }

    if (!accountId || !folderId) {
      return NextResponse.json(
        { error: "Paramètres manquants (accountId/folderId)" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(imapUid)) {
      return NextResponse.json(
        { error: "UID IMAP indisponible pour ce message" },
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

    const folderSnap = await adminDb
      .collection("mailFolders")
      .doc(folderId)
      .get();
    if (!folderSnap.exists) {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }
    const folder = folderSnap.data() as Record<string, unknown>;
    if (folder.accountId !== accountId) {
      return NextResponse.json({ error: "Dossier invalide" }, { status: 400 });
    }
    const imapPath = (folder.imapPath as string) || "";
    if (!imapPath) {
      return NextResponse.json(
        { error: "Dossier IMAP non synchronisé pour ce compte" },
        { status: 400 }
      );
    }

    const password = decryptPassword(account.password as string);

    const result = await fetchAttachment(
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
      imapPath,
      imapUid,
      {
        index: indexParam !== null ? Number(indexParam) : undefined,
        filename: filenameParam,
      }
    );

    if (!result) {
      return NextResponse.json(
        { error: "Pièce jointe introuvable" },
        { status: 404 }
      );
    }

    return new NextResponse(new Uint8Array(result.content), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Length": String(result.content.length),
        "Content-Disposition": contentDisposition(disposition, result.filename),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erreur lors de la récupération de la pièce jointe:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}
