import { NextResponse } from "next/server";
import { adminDb } from "@/config/firebase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { emailIds, selected } = body;

    if (
      !emailIds ||
      !Array.isArray(emailIds) ||
      typeof selected !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Paramètres invalides" },
        { status: 400 }
      );
    }

    const batch = adminDb.batch();

    for (const emailId of emailIds) {
      const emailRef = adminDb.collection("emails").doc(emailId);
      batch.update(emailRef, { selected });
    }

    await batch.commit();

    return NextResponse.json({
      message: `${emailIds.length} emails mis à jour`,
      selected,
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour des emails:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour des emails" },
      { status: 500 }
    );
  }
}
