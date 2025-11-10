import { auth } from "@/config/firebase";
import { signOut } from "firebase/auth";

export async function checkAuthState(): Promise<boolean> {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(!!user);
    });
  });
}

export async function refreshAuthToken(): Promise<string | null> {
  try {
    if (!auth.currentUser) {
      throw new Error("Utilisateur non connecté");
    }

    const token = await auth.currentUser.getIdToken(true); // Force refresh
    console.log("Token Firebase rafraîchi avec succès");
    return token;
  } catch (error) {
    console.error("Erreur lors du rafraîchissement du token:", error);
    return null;
  }
}

export async function handleAuthError(): Promise<void> {
  console.log("Gestion de l'erreur d'authentification - déconnexion");
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Erreur lors de la déconnexion:", error);
  }
  // Redirection sera gérée par AuthWrapper
}

export function isAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; message?: string };
  return err.code === 'auth/invalid-user-token' ||
    err.code === 'auth/user-token-expired' ||
    (err.message?.includes('UNAUTHENTICATED') ?? false) ||
    (err.message?.includes('Missing or insufficient permissions') ?? false);
} 