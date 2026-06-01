"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";
import { Eye, EyeOff } from "lucide-react";
import { auth } from "@/config/firebase";

export default function Login() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

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

  const handleResetPassword = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError("Veuillez d'abord saisir votre adresse email ci-dessus");
      return;
    }
    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo(`Un email de réinitialisation a été envoyé à ${email.trim()}`);
    } catch (err: any) {
      let msg = "Impossible d'envoyer l'email de réinitialisation";
      switch (err.code) {
        case "auth/invalid-email":
          msg = "L'adresse email n'est pas valide";
          break;
        case "auth/missing-email":
          msg = "Veuillez saisir votre adresse email";
          break;
        case "auth/user-not-found":
          msg = "Aucun compte n'existe avec cette adresse email";
          break;
        case "auth/too-many-requests":
          msg = "Trop de tentatives. Veuillez réessayer plus tard";
          break;
        case "auth/network-request-failed":
          msg = "Erreur de connexion réseau. Vérifiez votre connexion internet";
          break;
      }
      setError(msg);
    } finally {
      setResetting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

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
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Mot de passe"
            className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg p-3 pr-12 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={
              showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <button
          type="button"
          onClick={handleResetPassword}
          disabled={resetting}
          className="self-end text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50"
        >
          {resetting ? "Envoi en cours..." : "Mot de passe oublié ?"}
        </button>
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
      {info && <p className="text-green-400 mt-4 text-center">{info}</p>}

      <p className="mt-4 text-center text-gray-400">
        Pas encore de compte ?{" "}
        <a href="/register" className="text-blue-400 hover:text-blue-300">
          S'inscrire
        </a>
      </p>
    </div>
  );
}
