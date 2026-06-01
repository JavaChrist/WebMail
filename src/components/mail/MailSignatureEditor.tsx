"use client";

import { useState } from "react";
import { Image as ImageIcon, Plus, X, Trash2, Loader2 } from "lucide-react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useTheme } from "@/context/ThemeContext";
import { storage } from "@/config/firebase";
import type { SignatureData, SignatureSocial } from "@/types/mail";

const ACCENT_DEFAULT = "#1a4ed8";

const SOCIAL_TYPES = [
  "github",
  "linkedin",
  "twitter",
  "facebook",
  "instagram",
  "website",
  "custom",
] as const;

function socialLabel(type: string): string {
  const map: Record<string, string> = {
    github: "GitHub",
    linkedin: "LinkedIn",
    twitter: "Twitter",
    facebook: "Facebook",
    instagram: "Instagram",
    website: "Site",
    custom: "Lien",
  };
  return map[type] ?? type;
}

function esc(value: string | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Nettoyage HTML raisonnable : supprime scripts, gestionnaires inline et javascript:. */
export function sanitizeSignatureHtml(html: string): string {
  return html
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*\/?\s*(?:iframe|object|embed)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "");
}

/**
 * Génère le HTML de la signature (table 2 colonnes à styles INLINE) à partir
 * des données structurées. Aucune édition WYSIWYG dans un tableau : le HTML est
 * entièrement produit ici, ce qui élimine le bug de caret du contentEditable.
 */
export function generateSignatureHtml(d: SignatureData): string {
  const accent =
    d.accentColor && /^#[0-9a-fA-F]{3,8}$/.test(d.accentColor)
      ? d.accentColor
      : ACCENT_DEFAULT;
  const titles = (d.titles ?? []).filter((t) => t.trim() !== "");
  const socials = (d.socials ?? []).filter((s) => (s.url ?? "").trim() !== "");
  const hasImage = !!(d.imageUrl && d.imageUrl.trim());
  const hasContent =
    hasImage ||
    !!d.name ||
    titles.length > 0 ||
    !!d.address ||
    !!d.phone ||
    !!d.website?.url ||
    socials.length > 0;
  if (!hasContent) return "";

  const imgCell = hasImage
    ? `<td style="vertical-align:top;width:96px;padding-right:14px;"><img src="${esc(
        d.imageUrl
      )}" alt="" width="96" style="display:block;border-radius:6px;max-width:96px;height:auto;" /></td>`
    : "";

  const rightLines: string[] = [];
  if (d.name) {
    rightLines.push(
      `<div style="font-weight:bold;font-size:15px;color:#111827;">${esc(
        d.name
      )}</div>`
    );
  }
  titles.forEach((t) =>
    rightLines.push(
      `<div style="font-weight:bold;color:#111827;">${esc(t)}</div>`
    )
  );
  if (d.address) {
    rightLines.push(
      `<div style="color:#374151;">${esc(d.address).replace(/\n/g, "<br>")}</div>`
    );
  }

  const rightCell = `<td style="vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;">${rightLines.join(
    ""
  )}</td>`;

  const table =
    `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">` +
    `<tbody><tr>${imgCell}${rightCell}</tr></tbody></table>`;

  const belowLines: string[] = [];
  if (d.phone) belowLines.push(`<div>Tél : <strong>${esc(d.phone)}</strong></div>`);
  if (d.website?.url) {
    const label = esc(d.website.label || d.website.url);
    belowLines.push(
      `<div><a href="${esc(
        d.website.url
      )}" target="_blank" rel="noopener noreferrer" style="color:${accent};text-decoration:none;">${label}</a></div>`
    );
  }
  const below = belowLines.length
    ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111827;line-height:1.6;margin-top:8px;">${belowLines.join(
        ""
      )}</div>`
    : "";

  const socialRow = socials.length
    ? `<div style="margin-top:8px;">` +
      socials
        .map((s) => {
          const inner =
            s.iconUrl && s.iconUrl.trim()
              ? `<img src="${esc(s.iconUrl)}" alt="${esc(
                  socialLabel(s.type)
                )}" width="24" height="24" style="border:0;display:inline-block;vertical-align:middle;" />`
              : `<span style="display:inline-block;padding:3px 8px;background:${accent};color:#ffffff;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;">${esc(
                  socialLabel(s.type)
                )}</span>`;
          return `<a href="${esc(
            s.url
          )}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-right:6px;text-decoration:none;">${inner}</a>`;
        })
        .join("") +
      `</div>`
    : "";

  return table + below + socialRow;
}

interface MailSignatureEditorProps {
  value: string;
  data?: SignatureData | null;
  onChange: (html: string, data: SignatureData | null) => void;
  userId?: string | null;
  accountId?: string | null;
}

export default function MailSignatureEditor({
  value,
  data,
  onChange,
  userId,
  accountId,
}: MailSignatureEditorProps) {
  const { isDarkMode } = useTheme();
  // Signature héritée (HTML libre sans données structurées) : ouvrir l'onglet HTML
  // pour ne pas écraser l'existant ; sinon l'assistant par défaut.
  const [tab, setTab] = useState<"assistant" | "html">(() =>
    !data && value ? "html" : "assistant"
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current: SignatureData = data ?? {};
  const titles = current.titles ?? [];
  const socials = current.socials ?? [];

  const emit = (next: SignatureData) =>
    onChange(sanitizeSignatureHtml(generateSignatureHtml(next)), next);
  const update = (patch: Partial<SignatureData>) =>
    emit({ ...current, ...patch });

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!userId) {
      setError("Connexion requise pour téléverser. Utilisez une URL à la place.");
      return null;
    }
    setError(null);
    setUploading(true);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `signatures/${userId}/${accountId ?? "default"}/${Date.now()}_${safe}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    } catch {
      setError(
        "Échec du téléversement (règles Storage non déployées ?). Utilisez une URL en repli."
      );
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleImageFile = async (file: File | null | undefined) => {
    if (!file) return;
    const url = await uploadImage(file);
    if (url) update({ imageUrl: url });
  };

  const handleIconFile = async (index: number, file: File | null | undefined) => {
    if (!file) return;
    const url = await uploadImage(file);
    if (url) setSocial(index, { iconUrl: url });
  };

  const setTitle = (i: number, v: string) =>
    update({ titles: titles.map((t, idx) => (idx === i ? v : t)) });
  const addTitle = () => update({ titles: [...titles, ""] });
  const removeTitle = (i: number) =>
    update({ titles: titles.filter((_, idx) => idx !== i) });

  const setSocial = (i: number, patch: Partial<SignatureSocial>) =>
    update({
      socials: socials.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    });
  const addSocial = () =>
    update({ socials: [...socials, { type: "github", url: "" }] });
  const removeSocial = (i: number) =>
    update({ socials: socials.filter((_, idx) => idx !== i) });

  const field = `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDarkMode
      ? "bg-gray-700 text-white border-gray-600"
      : "bg-white text-gray-900 border-gray-300"
  }`;
  const smallField = `px-2 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDarkMode
      ? "bg-gray-700 text-white border-gray-600"
      : "bg-white text-gray-900 border-gray-300"
  }`;
  const tabBtn = (active: boolean) =>
    `px-3 py-1.5 text-sm rounded-lg ${
      active
        ? "bg-blue-600 text-white"
        : isDarkMode
        ? "bg-gray-700 hover:bg-gray-600"
        : "bg-gray-100 hover:bg-gray-200"
    }`;

  return (
    <div>
      {/* Onglets */}
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setTab("assistant")}
          className={tabBtn(tab === "assistant")}
        >
          Assistant
        </button>
        <button
          type="button"
          onClick={() => setTab("html")}
          className={tabBtn(tab === "html")}
        >
          HTML
        </button>
      </div>

      {tab === "assistant" ? (
        <div className="space-y-4">
          {/* Image / avatar */}
          <div>
            <label className="block text-sm font-medium mb-1">Image / avatar</label>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                {current.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={current.imageUrl}
                    alt="aperçu"
                    className="w-16 h-16 rounded-lg object-cover border border-gray-300"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                    <ImageIcon size={20} />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer ${
                    isDarkMode
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {uploading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ImageIcon size={14} />
                  )}
                  Téléverser
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      handleImageFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <input
                  type="url"
                  value={current.imageUrl ?? ""}
                  onChange={(e) => update({ imageUrl: e.target.value })}
                  placeholder="ou URL de l'image"
                  spellCheck={false}
                  className={field}
                />
              </div>
            </div>
          </div>

          {/* Nom */}
          <div>
            <label className="block text-sm font-medium mb-1">Nom</label>
            <input
              type="text"
              value={current.name ?? ""}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Grohens Christian"
              spellCheck
              lang="fr"
              className={field}
            />
          </div>

          {/* Titres / fonctions */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Titres / fonctions
            </label>
            <div className="space-y-2">
              {titles.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={t}
                    onChange={(e) => setTitle(i, e.target.value)}
                    placeholder="Développeur web"
                    spellCheck
                    lang="fr"
                    className={field}
                  />
                  <button
                    type="button"
                    onClick={() => removeTitle(i)}
                    title="Retirer la ligne"
                    className="p-1.5 rounded hover:bg-black/10"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {titles.length < 5 && (
                <button
                  type="button"
                  onClick={addTitle}
                  className="flex items-center gap-1 text-sm text-blue-500 hover:underline"
                >
                  <Plus size={14} /> Ajouter une ligne
                </button>
              )}
            </div>
          </div>

          {/* Adresse */}
          <div>
            <label className="block text-sm font-medium mb-1">Adresse</label>
            <textarea
              value={current.address ?? ""}
              onChange={(e) => update({ address: e.target.value })}
              rows={2}
              placeholder="12 rue Exemple&#10;75000 Paris"
              spellCheck
              lang="fr"
              className={field}
            />
          </div>

          {/* Téléphone */}
          <div>
            <label className="block text-sm font-medium mb-1">Téléphone</label>
            <input
              type="text"
              value={current.phone ?? ""}
              onChange={(e) => update({ phone: e.target.value })}
              placeholder="+33 6 00 00 00 00"
              className={field}
            />
          </div>

          {/* Site web */}
          <div>
            <label className="block text-sm font-medium mb-1">Site web</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                type="text"
                value={current.website?.label ?? ""}
                onChange={(e) =>
                  update({
                    website: { ...current.website, label: e.target.value },
                  })
                }
                placeholder="Libellé (www.javachrist.fr)"
                spellCheck={false}
                className={field}
              />
              <input
                type="url"
                value={current.website?.url ?? ""}
                onChange={(e) =>
                  update({
                    website: { ...current.website, url: e.target.value },
                  })
                }
                placeholder="https://www.javachrist.fr"
                spellCheck={false}
                className={field}
              />
            </div>
          </div>

          {/* Couleur d'accent */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Couleur d&apos;accent</label>
            <input
              type="color"
              value={current.accentColor ?? ACCENT_DEFAULT}
              onChange={(e) => update({ accentColor: e.target.value })}
              className="w-8 h-8 p-0 border-0 bg-transparent cursor-pointer"
            />
          </div>

          {/* Réseaux sociaux */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Réseaux sociaux
            </label>
            <div className="space-y-2">
              {socials.map((s, i) => (
                <div
                  key={i}
                  className={`flex flex-wrap items-center gap-2 p-2 rounded-lg border ${
                    isDarkMode ? "border-gray-700" : "border-gray-200"
                  }`}
                >
                  <select
                    value={s.type}
                    onChange={(e) => setSocial(i, { type: e.target.value })}
                    className={smallField}
                  >
                    {SOCIAL_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {socialLabel(t)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="url"
                    value={s.url}
                    onChange={(e) => setSocial(i, { url: e.target.value })}
                    placeholder="https://github.com/votreprofil"
                    spellCheck={false}
                    className={`${field} flex-1 min-w-[160px]`}
                  />
                  <input
                    type="url"
                    value={s.iconUrl ?? ""}
                    onChange={(e) => setSocial(i, { iconUrl: e.target.value })}
                    placeholder="URL icône (option)"
                    spellCheck={false}
                    className={smallField}
                  />
                  <label className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer bg-gray-600 text-white hover:bg-gray-700">
                    <ImageIcon size={12} />
                    Icône
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        handleIconFile(i, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeSocial(i)}
                    title="Supprimer"
                    className="p-1.5 rounded hover:bg-black/10 text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addSocial}
                className="flex items-center gap-1 text-sm text-blue-500 hover:underline"
              >
                <Plus size={14} /> Ajouter un réseau social
              </button>
            </div>
            <p className="mt-1 text-xs opacity-60">
              Sans icône, un badge texte est utilisé (robuste dans tous les
              clients mail).
            </p>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      ) : (
        // Onglet HTML libre (avancé) — édite directement le HTML stocké.
        <div>
          <textarea
            value={value}
            onChange={(e) =>
              onChange(sanitizeSignatureHtml(e.target.value), null)
            }
            rows={8}
            placeholder="<table>…</table>"
            spellCheck={false}
            className={`${field} font-mono text-xs`}
          />
          <p className="mt-1 text-xs opacity-60">
            Édition HTML avancée. Modifier ici réinitialise l&apos;assistant
            (les champs structurés sont alors vidés).
          </p>
        </div>
      )}

      {/* Aperçu temps réel (fond blanc, comme dans un client mail) */}
      <div className="mt-3">
        <div className="text-xs font-medium opacity-60 mb-1">Aperçu</div>
        <div className="rounded-lg border border-gray-300 bg-white p-3 overflow-x-auto">
          {value ? (
            <div
              className="text-sm text-gray-900"
              dangerouslySetInnerHTML={{ __html: value }}
            />
          ) : (
            <p className="text-xs text-gray-400">
              Votre signature apparaîtra ici.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
