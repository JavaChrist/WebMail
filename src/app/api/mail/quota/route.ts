import { NextResponse } from "next/server";
import { adminDb } from "@/config/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { getAccountQuota } from "@/lib/mail/quotaService";
import { verifyRequest, AuthError } from "@/lib/mail/apiAuth";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { uid } = await verifyRequest(request);
    const { accountId } = await request.json();

    if (!accountId) {
      return NextResponse.json({ error: "accountId est requis" }, { status: 400 });
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

    const result = await getAccountQuota({
      email: account.email as string,
      password: account.password as string,
      imapServer: (account.imapServer as string) ?? "",
      imapPort: (account.imapPort as number) ?? 993,
      imapSecure:
        account.imapSecure !== undefined ? Boolean(account.imapSecure) : true,
    });

    await adminDb
      .collection("mailAccounts")
      .doc(accountId)
      .update({
        quotaUsedMb: result.usedMb,
        quotaTotalMb: result.quotaMb,
        quotaCheckedAt: Timestamp.now(),
      });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erreur lors de la récupération du quota:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}
