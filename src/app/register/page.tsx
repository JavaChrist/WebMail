"use client";
import { useState, useEffect } from "react";
import Register from "@/components/Register";

export default function RegisterPage() {
  const [renderKey, setRenderKey] = useState(Date.now());

  useEffect(() => {
    setRenderKey(Date.now());
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
      <Register key={renderKey} />
    </div>
  );
}
