"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/config/firebase";
import Sidebar from "@/components/Sidebar";

export default function AuthWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        console.log("État d'authentification :", currentUser ? "Connecté" : "Déconnecté");
        setUser(currentUser);
        setLoading(false);
        setAuthError(null);

        if (!currentUser && pathname !== "/login" && pathname !== "/register") {
          console.log("Redirection vers login - utilisateur non connecté");
          router.push("/login");
        } else if (currentUser && (pathname === "/login" || pathname === "/")) {
          console.log("Redirection vers app - utilisateur connecté");
          router.push("/app");
        }
      },
      (error) => {
        console.error("Erreur d'authentification Firebase:", error);
        setAuthError("Erreur d'authentification - veuillez vous reconnecter");
        setLoading(false);
        setUser(null);
        router.push("/login");
      }
    );

    return () => unsubscribe();
  }, [router, pathname]);

  const handleReconnect = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Vérification de l&apos;authentification...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-6 max-w-md">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Problème d&apos;authentification
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {authError}
          </p>
          <button
            onClick={handleReconnect}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Se reconnecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1">
      {user && pathname !== "/login" && pathname !== "/register" && <Sidebar />}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
