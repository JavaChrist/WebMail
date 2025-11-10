"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/config/firebase";
import { collection, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";
import { useTheme } from "@/context/ThemeContext";

interface DiagnosticResult {
  test: string;
  status: "success" | "warning" | "error";
  message: string;
  details?: string;
}

interface CorruptedAccount {
  id: string;
  smtpServer?: string;
  imapServer?: string;
  [key: string]: unknown;
}

export default function DiagnosticPage() {
  const { isDarkMode } = useTheme();
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [corruptedAccounts, setCorruptedAccounts] = useState<CorruptedAccount[]>([]);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);
    const newResults: DiagnosticResult[] = [];

    // Test 1: Authentification utilisateur
    try {
      if (auth.currentUser) {
        newResults.push({
          test: "Authentification utilisateur",
          status: "success",
          message: "Utilisateur connecté",
          details: `UID: ${auth.currentUser.uid}`
        });
      } else {
        newResults.push({
          test: "Authentification utilisateur",
          status: "error",
          message: "Aucun utilisateur connecté"
        });
      }
    } catch (error) {
      newResults.push({
        test: "Authentification utilisateur",
        status: "error",
        message: "Erreur d'authentification",
        details: error instanceof Error ? error.message : "Erreur inconnue"
      });
    }

    // Test 2: Configuration Firebase
    try {
      const config = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      };

      const missingVars = Object.entries(config).filter(([, value]) => !value);

      if (missingVars.length === 0) {
        newResults.push({
          test: "Variables d'environnement Firebase",
          status: "success",
          message: "Toutes les variables Firebase sont définies"
        });
      } else {
        newResults.push({
          test: "Variables d'environnement Firebase",
          status: "warning",
          message: `${missingVars.length} variables manquantes`,
          details: missingVars.map(([key]) => key).join(", ")
        });
      }
    } catch {
      newResults.push({
        test: "Variables d'environnement Firebase",
        status: "error",
        message: "Erreur lors de la vérification des variables"
      });
    }

    // Test 3: Accès Firestore
    if (auth.currentUser) {
      try {
        const testCollection = collection(db, "emailAccounts");
        const q = query(testCollection, where("userId", "==", auth.currentUser.uid));
        const snapshot = await getDocs(q);

        newResults.push({
          test: "Accès Firestore",
          status: "success",
          message: "Connexion Firestore réussie",
          details: `${snapshot.docs.length} comptes email trouvés`
        });

        // Vérifier les comptes corrompus
        const corrupted = snapshot.docs.filter(doc => {
          const data = doc.data();
          return data.smtpServer?.includes("ionos.smtp.fr") ||
            data.imapServer?.includes("ionos.imap.fr");
        });

        if (corrupted.length > 0) {
          newResults.push({
            test: "Configuration email",
            status: "warning",
            message: `${corrupted.length} compte(s) avec serveurs incorrects`,
            details: "Serveurs Ionos incorrects détectés (ionos.smtp.fr au lieu de smtp.ionos.com)"
          });
          setCorruptedAccounts(corrupted.map(doc => ({ id: doc.id, ...doc.data() })));
        } else {
          newResults.push({
            test: "Configuration email",
            status: "success",
            message: "Configurations email correctes"
          });
        }

      } catch (error) {
        newResults.push({
          test: "Accès Firestore",
          status: "error",
          message: "Erreur d'accès Firestore",
          details: error instanceof Error ? error.message : "Erreur inconnue"
        });
      }
    }

    // Test 4: Clé de chiffrement
    try {
      const encryptionKey = process.env.NEXT_PUBLIC_ENCRYPTION_KEY;
      if (encryptionKey) {
        if (encryptionKey.length >= 16) {
          newResults.push({
            test: "Clé de chiffrement",
            status: "success",
            message: "Clé de chiffrement présente et valide"
          });
        } else {
          newResults.push({
            test: "Clé de chiffrement",
            status: "warning",
            message: "Clé de chiffrement trop courte",
            details: "Minimum 16 caractères recommandés"
          });
        }
      } else {
        newResults.push({
          test: "Clé de chiffrement",
          status: "error",
          message: "Clé de chiffrement manquante"
        });
      }
    } catch {
      newResults.push({
        test: "Clé de chiffrement",
        status: "error",
        message: "Erreur lors de la vérification de la clé"
      });
    }

    setResults(newResults);
    setIsRunning(false);
  };

  const fixCorruptedAccounts = async () => {
    for (const account of corruptedAccounts) {
      try {
        await deleteDoc(doc(db, "emailAccounts", account.id));
        console.log(`Compte corrompu supprimé: ${account.id}`);
      } catch (error) {
        console.error(`Erreur lors de la suppression du compte ${account.id}:`, error);
      }
    }
    setCorruptedAccounts([]);
    // Relancer le diagnostic
    await runDiagnostics();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success": return "✅";
      case "warning": return "⚠️";
      case "error": return "❌";
      default: return "ℹ️";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success": return "text-green-600 dark:text-green-400";
      case "warning": return "text-yellow-600 dark:text-yellow-400";
      case "error": return "text-red-600 dark:text-red-400";
      default: return "text-blue-600 dark:text-blue-400";
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className={`p-6 min-h-screen ${isDarkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"}`}>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Diagnostic WebMail</h1>

        <div className="mb-6">
          <button
            onClick={runDiagnostics}
            disabled={isRunning}
            className={`px-6 py-3 rounded-lg font-medium ${isRunning
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
          >
            {isRunning ? "Diagnostic en cours..." : "Relancer le diagnostic"}
          </button>
        </div>

        <div className="space-y-4">
          {results.map((result, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getStatusIcon(result.status)}</span>
                <div className="flex-1">
                  <h3 className="font-medium">{result.test}</h3>
                  <p className={`${getStatusColor(result.status)} mt-1`}>
                    {result.message}
                  </p>
                  {result.details && (
                    <p className={`text-sm mt-2 ${isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}>
                      {result.details}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {corruptedAccounts.length > 0 && (
          <div className={`mt-6 p-4 rounded-lg border ${isDarkMode ? "bg-yellow-900 border-yellow-700" : "bg-yellow-50 border-yellow-200"
            }`}>
            <h3 className="font-medium text-yellow-800 dark:text-yellow-200 mb-3">
              Comptes email corrompus détectés
            </h3>
            <p className={`text-sm mb-4 ${isDarkMode ? "text-yellow-300" : "text-yellow-700"
              }`}>
              {corruptedAccounts.length} compte(s) utilisent des serveurs Ionos incorrects.
              Vous devez les supprimer et les reconfigurer avec les bons serveurs.
            </p>
            <button
              onClick={fixCorruptedAccounts}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
            >
              Supprimer les comptes corrompus
            </button>
          </div>
        )}

        <div className={`mt-8 p-4 rounded-lg ${isDarkMode ? "bg-gray-800" : "bg-blue-50"
          }`}>
          <h3 className="font-medium mb-2">Aide</h3>
          <ul className={`text-sm space-y-1 ${isDarkMode ? "text-gray-300" : "text-gray-700"
            }`}>
            <li>• Si vous avez des erreurs d&apos;authentification, consultez FIREBASE_SETUP.md</li>
            <li>• Pour les problèmes de serveur email, utilisez les configurations prédéfinies</li>
            <li>• Les erreurs 16 UNAUTHENTICATED indiquent un problème de configuration Firebase Admin</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 