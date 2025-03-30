import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Vérifier que toutes les variables d'environnement nécessaires sont présentes
if (!process.env.FIREBASE_ADMIN_PROJECT_ID) {
  throw new Error("FIREBASE_ADMIN_PROJECT_ID est manquant");
}
if (!process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
  throw new Error("FIREBASE_ADMIN_CLIENT_EMAIL est manquant");
}
if (!process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
  throw new Error("FIREBASE_ADMIN_PRIVATE_KEY est manquant");
}

// Initialiser l'application Firebase Admin si elle n'existe pas déjà
const apps = getApps();
const adminApp =
  apps.length === 0
    ? initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(
            /\\n/g,
            "\n"
          ),
        }),
      })
    : apps[0];

// Initialiser Firestore et Auth
const adminDb = getFirestore(adminApp);
const adminAuth = getAuth(adminApp);

export { adminApp, adminDb, adminAuth };
