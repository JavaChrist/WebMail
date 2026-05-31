import { NextResponse } from "next/server";
import { adminDb } from "@/config/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { verifyRequest, AuthError } from "@/lib/mail/apiAuth";
import { FOLDER_ORDER } from "@/lib/mail/constants";

const COLLECTION = "mailFolders";

async function assertAccountOwner(accountId: string, uid: string) {
  const snap = await adminDb.collection("mailAccounts").doc(accountId).get();
  if (!snap.exists || snap.data()?.userId !== uid) {
    throw new AuthError("Compte introuvable", 404);
  }
}

export async function GET(request: Request) {
  try {
    const { uid } = await verifyRequest(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    if (!accountId) {
      return NextResponse.json({ error: "accountId requis" }, { status: 400 });
    }
    await assertAccountOwner(accountId, uid);
    const snap = await adminDb
      .collection(COLLECTION)
      .where("accountId", "==", accountId)
      .get();
    const folders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ folders });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { uid } = await verifyRequest(request);
    const { accountId, name, parentFolderId } = await request.json();
    if (!accountId || !name) {
      return NextResponse.json(
        { error: "accountId et name sont requis" },
        { status: 400 }
      );
    }
    await assertAccountOwner(accountId, uid);
    const now = Timestamp.now();
    const ref = await adminDb.collection(COLLECTION).add({
      userId: uid,
      accountId,
      parentFolderId: parentFolderId ?? null,
      name: String(name).trim(),
      folderType: "custom",
      systemFolder: false,
      sortOrder: FOLDER_ORDER.custom,
      imapPath: "",
      unreadCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ id: ref.id });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { uid } = await verifyRequest(request);
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");
    if (!folderId) {
      return NextResponse.json({ error: "folderId requis" }, { status: 400 });
    }
    const ref = adminDb.collection(COLLECTION).doc(folderId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.userId !== uid) {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }
    if (snap.data()?.systemFolder) {
      return NextResponse.json(
        { error: "Un dossier système ne peut pas être supprimé" },
        { status: 400 }
      );
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
