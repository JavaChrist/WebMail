"use client"; // ✅ Obligatoire pour `useEffect` et `useState`

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/config/firebase";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  return null;
}
