import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

// Fonction pour initialiser Firebase Admin
function createFirebaseAdminApp() {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  try {
    console.log("🔑 Initialisation Firebase Admin...");

    // Initialisation via les variables d'environnement (compatible Vercel)
    if (process.env.FIREBASE_ADMIN_PROJECT_ID &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY) {

      console.log("📋 Utilisation des variables d'environnement");
      const app = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
        storageBucket: `${process.env.FIREBASE_ADMIN_PROJECT_ID}.appspot.com`,
      });

      console.log("✅ Firebase Admin initialisé avec variables d'environnement");
      return app;
    }

    // Configuration par défaut (ne fonctionnera qu'en développement avec Firebase Auth)
    console.log("🔄 Configuration par défaut (authentification requise)");
    const app = initializeApp({
      projectId: "webmail-b926e",
      storageBucket: "webmail-b926e.appspot.com",
    });

    console.log("⚠️ Firebase Admin initialisé sans credentials - fonctionnalités limitées");
    return app;

  } catch (error) {
    console.error("❌ Erreur critique lors de l'initialisation Firebase Admin:", error);
    console.log("📖 Consultez FIREBASE_SETUP.md pour la configuration");
    throw error;
  }
}

// Initialiser l'application Firebase Admin
const adminApp = createFirebaseAdminApp();

// Initialiser Firestore, Auth et Storage
const adminDb = getFirestore(adminApp);
const adminAuth = getAuth(adminApp);
const adminStorage = getStorage(adminApp);

export { adminApp, adminDb, adminAuth, adminStorage };
