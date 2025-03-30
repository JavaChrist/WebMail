"use client";
import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "@/config/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useTheme } from "@/context/ThemeContext";

interface Email {
  id: string;
  from: string;
  subject: string;
  timestamp: any;
  read: boolean;
  userId: string;
}

export default function AppPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadEmails, setUnreadEmails] = useState<Email[]>([]);
  const router = useRouter();
  const { isDarkMode } = useTheme();

  const loadUnreadEmails = useCallback(async (userId: string) => {
    try {
      const emailsRef = collection(db, "emails");
      const q = query(
        emailsRef,
        where("userId", "==", userId),
        where("read", "==", false)
      );

      const querySnapshot = await getDocs(q);
      const emails = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Email[];

      emails.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
      const limitedEmails = emails.slice(0, 15);

      setUnreadEmails(limitedEmails);
    } catch (error) {
      console.error("Erreur lors du chargement des emails:", error);
      setUnreadEmails([]);
    }
  }, []);

  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;

    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        setUserEmail(user.email);
        await loadUnreadEmails(user.uid);
        refreshInterval = setInterval(() => {
          loadUnreadEmails(user.uid);
        }, 30000); // Rafraîchir toutes les 30 secondes
        setIsLoading(false);
      } else {
        setIsLoading(false);
        router.push("/login");
      }
    });

    return () => {
      unsubscribe();
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [router, loadUnreadEmails]);

  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center min-h-screen ${
          isDarkMode ? "bg-black" : "bg-white"
        }`}
      >
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? "bg-black" : "bg-white"}`}>
      <div className="container mx-auto px-4 py-8">
        <h1
          className={`text-3xl font-bold mb-6 ${
            isDarkMode ? "text-white" : "text-black"
          }`}
        >
          Bienvenue dans votre WebMail
        </h1>

        <div
          className={`${
            isDarkMode
              ? "bg-gray-900 text-white border-gray-700"
              : "bg-white text-black border-gray-200"
          } p-6 rounded-lg mb-6 shadow-lg border`}
        >
          <p className="text-xl">
            Connecté en tant que :{" "}
            <span className={isDarkMode ? "text-white" : "text-black"}>
              {userEmail}
            </span>
          </p>
        </div>

        <div
          className={`${
            isDarkMode ? "bg-gray-900" : "bg-white"
          } rounded-lg shadow-lg overflow-hidden`}
        >
          <div
            className={`p-4 ${
              isDarkMode
                ? "bg-gray-800 border-gray-700"
                : "bg-gray-100 border-gray-200"
            } border-b`}
          >
            <h2
              className={`text-xl font-bold ${
                isDarkMode ? "text-white" : "text-black"
              }`}
            >
              Emails non lus récents
            </h2>
          </div>

          {unreadEmails.length > 0 ? (
            <div>
              {unreadEmails.map((email) => (
                <div
                  key={email.id}
                  className={`border-b ${
                    isDarkMode
                      ? "border-gray-800 hover:bg-gray-800"
                      : "border-gray-200 hover:bg-gray-100"
                  } p-4 transition-colors cursor-pointer`}
                  onClick={() => router.push(`/email?emailId=${email.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <div>
                        <span
                          className={`font-semibold block ${
                            isDarkMode ? "text-white" : "text-black"
                          }`}
                        >
                          {email.from.replace(/['"]/g, "")}
                        </span>
                        <span
                          className={
                            isDarkMode ? "text-gray-300" : "text-gray-600"
                          }
                        >
                          {email.subject}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`text-sm ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      {new Date(
                        email.timestamp.seconds * 1000
                      ).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))}

              <div
                className={`p-4 ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`}
              >
                <button
                  onClick={() => router.push("/email")}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Voir tous les emails →
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`p-8 text-center ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Aucun email non lu
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
