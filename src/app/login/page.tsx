"use client";
import { useState, useEffect } from "react";
import Login from "@/components/Login";

export default function LoginPage() {
  const [renderKey, setRenderKey] = useState(Date.now()); // 🔥 Clé dynamique

  useEffect(() => {
    setRenderKey(Date.now()); // 🔥 Change la clé dès qu'on arrive sur /login
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
      <Login key={renderKey} /> {/* ✅ Re-render forcé du formulaire */}
    </div>
  );
}
