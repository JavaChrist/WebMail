import { NextResponse } from "next/server";
import { adminDb } from "@/config/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { verifyRequest, AuthError } from "@/lib/mail/apiAuth";

export async function POST(request: Request) {
  try {
    const { uid } = await verifyRequest(request);
    const { messageId, targetFolderId } = await request.json();
    if (!messageId || !targetFolderId) {
      return NextResponse.json(
        { error: "messageId et targetFolderId sont requis" },
        { status: 400 }
      );
    }

    const messageRef = adminDb.collection("mailMessages").doc(messageId);
    const messageSnap = await messageRef.get();
    if (!messageSnap.exists || messageSnap.data()?.userId !== uid) {
      return NextResponse.json({ error: "Message introuvable" }, { status: 404 });
    }

    const folderSnap = await adminDb
      .collection("mailFolders")
      .doc(targetFolderId)
      .get();
    if (!folderSnap.exists || folderSnap.data()?.userId !== uid) {
      return NextResponse.json(
        { error: "Dossier cible introuvable" },
        { status: 404 }
      );
    }
    if (folderSnap.data()?.accountId !== messageSnap.data()?.accountId) {
      return NextResponse.json(
        { error: "Le dossier appartient à un autre compte" },
        { status: 400 }
      );
    }

    await messageRef.update({
      primaryFolderId: targetFolderId,
      folderIds: [targetFolderId],
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
