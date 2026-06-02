import { NextResponse } from "next/server";
import { adminDb } from "@/config/firebase-admin";
import { syncAccount } from "@/lib/mail/syncService";
import { verifyRequest, AuthError } from "@/lib/mail/apiAuth";

// IMAP (sockets TCP via `net`) nécessite le runtime Node — PAS edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Durée max de la fonction serverless. 60 s convient au plan Pro ; sur Hobby la
// limite réelle est ~10 s → voir la note plus bas si la sync échoue toujours.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { uid } = await verifyRequest(request);
    const { accountId } = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId est requis" },
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

    const result = await syncAccount(accountId);
    return NextResponse.json({
      message: `${result.synced} nouveaux messages`,
      synced: result.synced,
      total: result.total,
      folders: result.folders,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    // Message réel (sans mot de passe) pour le toast client + les logs Vercel.
    const message =
      error instanceof Error ? error.message : "Erreur de synchronisation";
    console.error("Erreur de synchronisation /api/mail/sync:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
