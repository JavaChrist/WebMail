import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import fs from "fs";
import path from "path";

// Lecture, au runtime uniquement, d'une cle de service locale (dev).
// Volontairement non importee statiquement pour ne pas casser le build Vercel
// lorsque le fichier est absent (il est gitignore).
function loadLocalServiceAccount(): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} | null {
  try {
    const explicit = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    let filePath: string | null = null;

    if (explicit && fs.existsSync(explicit)) {
      filePath = explicit;
    } else {
      const root = process.cwd();
      const match = fs
        .readdirSync(root)
        .find((f) => f.includes("firebase-adminsdk") && f.endsWith(".json"));
      if (match) filePath = path.join(root, match);
    }

    if (!filePath) return null;

    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!raw.project_id || !raw.client_email || !raw.private_key) return null;

    return {
      projectId: raw.project_id,
      clientEmail: raw.client_email,
      privateKey: raw.private_key,
    };
  } catch {
    return null;
  }
}

// Fonction pour initialiser Firebase Admin
function createFirebaseAdminApp() {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  try {
    console.log("🔑 Initialisation Firebase Admin...");

    // PRIORITE au fichier de cle de service local s'il est present (dev).
    // C'est le credential historiquement valide ; les variables d'env servent
    // de fallback (notamment sur Vercel ou le fichier est absent).
    const local = loadLocalServiceAccount();
    if (local) {
      console.log("📁 Utilisation de la clé de service locale");
      const app = initializeApp({
        credential: cert({
          projectId: local.projectId,
          clientEmail: local.clientEmail,
          privateKey: local.privateKey.replace(/\\n/g, "\n"),
        }),
        storageBucket: `${local.projectId}.appspot.com`,
      });

      console.log("✅ Firebase Admin initialisé avec clé de service locale");
      return app;
    }

    // Initialisation via les variables d'environnement (compatible Vercel)
    if (process.env.FIREBASE_ADMIN_PROJECT_ID &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY) {

      console.log("📋 Utilisation des variables d'environnement");
      const app = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/^['"]|['"]$/g, "").replace(/\\n/g, "\n"),
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
// Ignorer les champs undefined (ex : contentHtml absent) plutôt que de lever
// une erreur lors des ecritures.
try {
  adminDb.settings({ ignoreUndefinedProperties: true });
} catch {
  /* settings deja appliquees */
}
const adminAuth = getAuth(adminApp);
const adminStorage = getStorage(adminApp);

export { adminApp, adminDb, adminAuth, adminStorage };
