import { NextResponse } from "next/server";
import { adminDb } from "@/config/firebase-admin";
import { syncAccount } from "@/lib/mail/syncService";
import { verifyRequest, AuthError } from "@/lib/mail/apiAuth";

export const maxDuration = 300;

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
    console.error("Erreur de synchronisation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}
