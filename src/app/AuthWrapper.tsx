"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/config/firebase";
import Sidebar from "@/components/Sidebar";

export default function AuthWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (!currentUser && pathname !== "/login") {
        router.push("/login");
      } else if (currentUser && (pathname === "/login" || pathname === "/")) {
        router.push("/app");
      }
    });

    return () => unsubscribe();
  }, [router, pathname]);

  if (loading) return <p className="text-center text-white">Chargement...</p>;

  return (
    <div className="flex flex-1">
      {user && pathname !== "/login" && <Sidebar />}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
