import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WebMail",
    short_name: "WebMail",
    description: "Messagerie moderne (IMAP/SMTP)",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f172a",
    theme_color: "#1a4ed8",
    icons: [
      { src: "/icone/logo192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone/logo512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Pas de maskable dédié : on réutilise le 512 (l'utilisateur pourra
      // fournir un vrai maskable plus tard pour un meilleur rendu Android).
      { src: "/icone/logo512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
