import type { Metadata } from "next";
import "../styles/calendar.css"; 

export const metadata: Metadata = {
  title: "WebMail App",
  description: "Une application Next.js pour gérer les emails, contacts et calendrier.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className="antialiased bg-gray-800 text-white min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
