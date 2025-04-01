"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/config/firebase";

export default function Login() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // ✅ Purger les champs quand l'utilisateur arrive sur /login
  useEffect(() => {
    if (pathname === "/login") {
      setEmail("temp-value");
      setPassword("temp-value");

      setTimeout(() => {
        setEmail("");
        setPassword("");
      }, 50);
    }
  }, [pathname]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/app");
    } catch (err: any) {
      let errorMessage = "Une erreur est survenue lors de la connexion";

      switch (err.code) {
        case "auth/invalid-email":
          errorMessage = "L'adresse email n'est pas valide";
          break;
        case "auth/user-disabled":
          errorMessage = "Ce compte a été désactivé";
          break;
        case "auth/user-not-found":
          errorMessage = "Aucun compte n'existe avec cette adresse email";
          break;
        case "auth/wrong-password":
          errorMessage = "Le mot de passe est incorrect";
          break;
        case "auth/too-many-requests":
          errorMessage =
            "Trop de tentatives de connexion. Veuillez réessayer plus tard";
          break;
        case "auth/network-request-failed":
          errorMessage =
            "Erreur de connexion réseau. Vérifiez votre connexion internet";
          break;
        default:
          errorMessage =
            "Impossible de se connecter. Vérifiez vos identifiants";
      }

      setError(errorMessage);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push("/app");
    } catch (error: any) {
      let errorMessage =
        "Une erreur est survenue lors de la connexion avec Google";

      switch (error.code) {
        case "auth/popup-closed-by-user":
          errorMessage = "La fenêtre de connexion Google a été fermée";
          break;
        case "auth/cancelled-popup-request":
          errorMessage = "La connexion avec Google a été annulée";
          break;
        case "auth/popup-blocked":
          errorMessage =
            "La fenêtre de connexion Google a été bloquée. Veuillez autoriser les popups";
          break;
        case "auth/account-exists-with-different-credential":
          errorMessage =
            "Un compte existe déjà avec cette adresse email mais avec une méthode de connexion différente";
          break;
        default:
          errorMessage =
            "Impossible de se connecter avec Google. Veuillez réessayer";
      }

      setError(errorMessage);
    }
  };

  return (
    <div className="w-full max-w-md bg-gray-900 text-white p-8 rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6 text-center">Connexion</h1>
      <form onSubmit={handleLogin} className="flex flex-col space-y-4">
        <input
          type="email"
          placeholder="Email"
          className="bg-gray-800 text-white border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
          required
        />
        <input
          type="password"
          placeholder="Mot de passe"
          className="bg-gray-800 text-white border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
          required
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
        >
          Se connecter
        </button>
      </form>

      <button
        onClick={handleGoogleLogin}
        className="mt-4 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition w-full"
      >
        Connexion avec Google
      </button>

      {error && <p className="text-red-500 mt-4 text-center">{error}</p>}

      <p className="mt-4 text-center text-gray-400">
        Pas encore de compte ?{" "}
        <a href="/register" className="text-blue-400 hover:text-blue-300">
          S'inscrire
        </a>
      </p>
    </div>
  );
}
