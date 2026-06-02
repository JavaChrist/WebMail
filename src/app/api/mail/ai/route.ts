import { NextResponse } from "next/server";
import { verifyRequest, AuthError } from "@/lib/mail/apiAuth";
import { runAi, type AiAction } from "@/lib/mail/aiService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VALID_ACTIONS: AiAction[] = ["translate", "correct", "rephrase"];

export async function POST(request: Request) {
  try {
    await verifyRequest(request);

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Assistant IA non configuré (ANTHROPIC_API_KEY manquante)" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { text, action, targetLang } = body as {
      text?: string;
      action?: AiAction;
      targetLang?: string;
    };

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Texte vide" }, { status: 400 });
    }
    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    }

    const result = await runAi({ text, action, targetLang });
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if ((error as { code?: string })?.code === "NO_KEY") {
      return NextResponse.json(
        { error: "Assistant IA non configuré" },
        { status: 503 }
      );
    }
    // On ne logge jamais le contenu du mail, uniquement le message d'erreur.
    console.error(
      "Erreur Assistant IA:",
      error instanceof Error ? error.message : "inconnue"
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur de l'assistant IA" },
      { status: 500 }
    );
  }
}
