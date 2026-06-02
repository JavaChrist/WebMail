import { NextResponse } from "next/server";
import { adminDb } from "@/config/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { getAccountQuota } from "@/lib/mail/quotaService";
import { verifyRequest, AuthError } from "@/lib/mail/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Payload « quota indisponible » (toujours renvoyé en 200 pour ne pas casser l'UI). */
const UNAVAILABLE = {
  available: false,
  supported: false,
  usedMb: null as number | null,
  quotaMb: null as number | null,
};

export async function POST(request: Request) {
  try {
    const { uid } = await verifyRequest(request);
    const { accountId } = await request.json();

    if (!accountId) {
      return NextResponse.json({ error: "accountId est requis" }, { status: 400 });
    }

    // Le quota dépend d'IMAP (souvent en échec en serverless : timeout/réseau).
    // Tout échec → 200 « indisponible » plutôt que 500.
    try {
      const accountSnap = await adminDb
        .collection("mailAccounts")
        .doc(accountId)
        .get();
      if (!accountSnap.exists || accountSnap.data()?.userId !== uid) {
        return NextResponse.json(UNAVAILABLE);
      }

      const account = accountSnap.data() as Record<string, unknown>;
      if (!account.email || !account.password) {
        return NextResponse.json(UNAVAILABLE);
      }

      const result = await getAccountQuota({
        email: account.email as string,
        password: account.password as string,
        imapServer: (account.imapServer as string) ?? "",
        imapPort: (account.imapPort as number) ?? 993,
        imapSecure:
          account.imapSecure !== undefined ? Boolean(account.imapSecure) : true,
      });

      // Mise à jour best-effort (ne bloque pas la réponse en cas d'échec).
      await adminDb
        .collection("mailAccounts")
        .doc(accountId)
        .update({
          quotaUsedMb: result.usedMb,
          quotaTotalMb: result.quotaMb,
          quotaCheckedAt: Timestamp.now(),
        })
        .catch(() => undefined);

      return NextResponse.json({ ...result, available: result.supported });
    } catch (inner) {
      console.warn(
        "Quota indisponible:",
        inner instanceof Error ? inner.message : "inconnue"
      );
      return NextResponse.json(UNAVAILABLE);
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    // Robustesse maximale : jamais de 500 pour le quota.
    return NextResponse.json(UNAVAILABLE);
  }
}
