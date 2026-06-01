export type AiAction = "translate" | "correct" | "rephrase";

export interface RunAiParams {
  text: string;
  action: AiAction;
  targetLang?: string;
}

/** Taille max du texte envoyé au modèle (tronqué au-delà pour borner le coût). */
const MAX_INPUT_CHARS = 8000;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2048;

function buildSystemPrompt(action: AiAction, targetLang: string): string {
  switch (action) {
    case "translate":
      return `Tu es un assistant de messagerie. Traduis le texte de l'utilisateur en ${targetLang}. Conserve le sens, le registre et un ton d'e-mail naturel. Réponds UNIQUEMENT avec la traduction, sans aucun commentaire ni guillemets.`;
    case "correct":
      return "Tu es un correcteur. Corrige l'orthographe, la grammaire et la ponctuation du texte SANS changer le sens, la langue ni le style. Réponds UNIQUEMENT avec le texte corrigé, sans commentaire.";
    case "rephrase":
      return "Tu es un assistant de rédaction. Reformule le texte de façon claire, fluide et professionnelle, dans LA MÊME langue que l'original. Conserve le sens. Réponds UNIQUEMENT avec le texte reformulé, sans commentaire.";
  }
}

/** Concatène les blocs `text` de la réponse Anthropic (content est un tableau de blocs). */
function extractText(data: unknown): string {
  const content = (data as { content?: Array<{ type?: string; text?: string }> })
    ?.content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("")
    .trim();
}

/**
 * Encapsule l'appel au fournisseur IA — Anthropic (Claude) via la Messages API,
 * appelée par `fetch` côté serveur (aucune dépendance npm). Lit
 * `ANTHROPIC_API_KEY` et `ANTHROPIC_MODEL`. Abstraction volontaire pour pouvoir
 * changer de fournisseur plus tard.
 */
export async function runAi({
  text,
  action,
  targetLang = "français",
}: RunAiParams): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error("Assistant IA non configuré") as Error & {
      code?: string;
    };
    err.code = "NO_KEY";
    throw err;
  }

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const input = text.slice(0, MAX_INPUT_CHARS);

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(action, targetLang),
      messages: [{ role: "user", content: input }],
    }),
  });

  if (!res.ok) {
    // On ne logge pas le contenu du mail, seulement le statut.
    throw new Error(`Erreur du fournisseur IA (${res.status})`);
  }

  const data = await res.json();
  const result = extractText(data);
  if (!result) {
    throw new Error("Réponse IA vide");
  }
  return result;
}
