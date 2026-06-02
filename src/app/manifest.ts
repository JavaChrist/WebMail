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
      // Icône d'app sur fond sombre opaque (rendu écran d'accueil / installation).
      { src: "/icone/app-icon.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone/app-icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone/app-icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
