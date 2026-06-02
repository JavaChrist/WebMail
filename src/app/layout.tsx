import { Inter } from "next/font/google";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import AppShell from "./AppShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WebMail",
  description: "Messagerie moderne",
  applicationName: "WebMail",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WebMail",
  },
  other: {
    // Balise standard (remplace l'avertissement de dépréciation apple-mobile-web-app-capable)
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icone/logo16.png", sizes: "16x16", type: "image/png" },
      { url: "/icone/logo32.png", sizes: "32x32", type: "image/png" },
      { url: "/icone/logo48.png", sizes: "48x48", type: "image/png" },
      { url: "/icone/logo96.png", sizes: "96x96", type: "image/png" },
      { url: "/icone/logo192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/icone/logo32.png",
    apple: "/icone/app-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
