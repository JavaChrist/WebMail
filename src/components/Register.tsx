"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { Eye, EyeOff } from "lucide-react";
import { auth } from "@/config/firebase";

export default function Register() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nettoyer les champs au chargement du composant
  useEffect(() => {
    if (pathname === "/register") {
      setEmail("temp-value");
      setPassword("temp-value");
      setConfirmPassword("temp-value");

      setTimeout(() => {
        setEmail("");
        setPassword("");
        setConfirmPassword("");
      }, 50);
    }
  }, [pathname]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push("/app");
    } catch (err: any) {
      let errorMessage = "Une erreur est survenue lors de l'inscription";

      switch (err.code) {
        case "auth/email-already-in-use":
          errorMessage = "Cette adresse email est déjà utilisée";
          break;
        case "auth/invalid-email":
          errorMessage = "L'adresse email n'est pas valide";
          break;
        case "auth/operation-not-allowed":
          errorMessage = "L'inscription par email n'est pas activée";
          break;
        case "auth/weak-password":
          errorMessage =
            "Le mot de passe est trop faible. Il doit contenir au moins 6 caractères";
          break;
        case "auth/network-request-failed":
          errorMessage =
            "Erreur de connexion réseau. Vérifiez votre connexion internet";
          break;
        default:
          errorMessage = "Impossible de créer le compte. Veuillez réessayer";
      }

      setError(errorMessage);
    }
  };

  const handleGoogleRegister = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push("/app");
    } catch (error: any) {
      let errorMessage =
        "Une erreur est survenue lors de l'inscription avec Google";

      switch (error.code) {
        case "auth/popup-closed-by-user":
          errorMessage = "La fenêtre d'inscription Google a été fermée";
          break;
        case "auth/cancelled-popup-request":
          errorMessage = "L'inscription avec Google a été annulée";
          break;
        case "auth/popup-blocked":
          errorMessage =
            "La fenêtre d'inscription Google a été bloquée. Veuillez autoriser les popups";
          break;
        case "auth/account-exists-with-different-credential":
          errorMessage =
            "Un compte existe déjà avec cette adresse email mais avec une méthode de connexion différente";
          break;
        default:
          errorMessage =
            "Impossible de s'inscrire avec Google. Veuillez réessayer";
      }

      setError(errorMessage);
    }
  };

  return (
    <div className="w-full max-w-md bg-gray-900 text-white p-8 rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6 text-center">Inscription</h1>
      <form onSubmit={handleRegister} className="flex flex-col space-y-4">
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
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Confirmer le mot de passe"
            className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg p-3 pr-12 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
        >
          S'inscrire
        </button>
      </form>

      <button
        onClick={handleGoogleRegister}
        className="mt-4 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition w-full"
      >
        S'inscrire avec Google
      </button>

      {error && <p className="text-red-500 mt-4 text-center">{error}</p>}

      <p className="mt-4 text-center text-gray-400">
        Déjà un compte ?{" "}
        <a href="/login" className="text-blue-400 hover:text-blue-300">
          Se connecter
        </a>
      </p>
    </div>
  );
}
