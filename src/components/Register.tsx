"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/config/firebase";

export default function Register() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
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

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push("/app");
    } catch (err: any) {
      setError("Erreur lors de l'inscription : " + err.message);
    }
  };

  const handleGoogleRegister = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push("/app");
    } catch (error: any) {
      setError("Erreur avec Google : " + error.message);
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
        <input
          type="password"
          placeholder="Mot de passe"
          className="bg-gray-800 text-white border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
          required
        />
        <input
          type="password"
          placeholder="Confirmer le mot de passe"
          className="bg-gray-800 text-white border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="off"
          required
        />
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
