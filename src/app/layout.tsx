"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ThemeProvider } from "@/context/ThemeContext";
import { usePathname } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isFullScreen = pathname === "/email";

  return (
    <html lang="fr">
      <body className={inter.className}>
        <ThemeProvider>
          {isFullScreen ? (
            <main className="min-h-screen">{children}</main>
          ) : (
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 lg:ml-64">{children}</main>
            </div>
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
