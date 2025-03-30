"use client"; // ✅ Autorisé ici

import Sidebar from "@/components/Sidebar";
import clsx from "clsx";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export default function LayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <body
      className={clsx(
        inter.variable,
        "font-sans antialiased bg-gray-800 min-h-screen flex"
      )}
    >
      <div className="flex w-full h-screen">
        <aside className="w-64 bg-gray-200 h-full">
          <Sidebar />
        </aside>
        <main className="flex-1 p-6 text-white overflow-auto">{children}</main>
      </div>
    </body>
  );
}
