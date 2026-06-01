"use client"; // ✅ Obligatoire pour `useEffect` et `useState`

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/config/firebase";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      router.replace(user ? "/email" : "/login");
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500" />
    </div>
  );
}
