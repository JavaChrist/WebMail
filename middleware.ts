import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, getApps, cert } from "firebase-admin/app";

// Initialisation de Firebase Admin
const initializeFirebaseAdmin = () => {
  if (!getApps().length) {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
      }),
    });
  }
  return getApps()[0];
};

export async function middleware(req: NextRequest) {
  // Vérifier si la route doit être protégée
  const app = initializeFirebaseAdmin();
  const auth = getAuth(app);

  try {
    // Récupérer le token depuis le header Authorization
    const token = req.headers.get("Authorization")?.split("Bearer ")[1];
    if (!token) {
      return NextResponse.json(
        { error: "Authentification requise" },
        { status: 401 }
      );
    }

    // Vérifier le token
    const decodedToken = await auth.verifyIdToken(token);

    // Ajouter l'ID de l'utilisateur aux headers pour utilisation ultérieure
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("X-User-ID", decodedToken.uid);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }
}

// Configuration des routes à protéger
export const config = {
  matcher: [
    "/api/emailAccounts/:path*",
    "/api/emailSettings/:path*",
    "/api/emails/:path*",
    "/api/events/:path*",
    "/api/contacts/:path*",
  ],
};
