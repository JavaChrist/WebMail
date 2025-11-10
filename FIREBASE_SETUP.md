# Configuration Firebase pour WebMail

## Problème actuel

Erreur d'authentification Firebase Admin : `16 UNAUTHENTICATED`

## Solution

### 1. Configurer les variables d'environnement

Créez un fichier `.env.local` à la racine du projet avec :

```bash
# Configuration Firebase Client (Frontend)
NEXT_PUBLIC_FIREBASE_API_KEY=votre_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=webmail-b926e.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=webmail-b926e
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=webmail-b926e.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=votre_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=votre_app_id

# Configuration Firebase Admin (Backend)
FIREBASE_ADMIN_PROJECT_ID=webmail-b926e
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxx@webmail-b926e.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nvotre_cle_privee\n-----END PRIVATE KEY-----\n"

# Clé de chiffrement pour les mots de passe email
NEXT_PUBLIC_ENCRYPTION_KEY=une_cle_secrete_forte_de_32_caracteres
```

### 2. Récupérer les valeurs depuis Firebase Console

1. Allez sur https://console.firebase.google.com/project/webmail-b926e
2. **Pour les variables CLIENT** :
   - Paramètres du projet > Général > Vos applications > Configuration SDK
3. **Pour les variables ADMIN** :
   - Paramètres du projet > Comptes de service > Générer une nouvelle clé privée
   - Copiez les valeurs du fichier JSON téléchargé

### 3. Alternative avec fichier de service account

Si vous préférez utiliser le fichier JSON :

1. Renommez `webmail-b926e-firebase-adminsdk-ma0c3-ac85ebac4f.json` en `firebase-admin-key.json`
2. Modifiez `src/config/firebase-admin.ts` pour utiliser ce fichier

### 4. Nettoyer les configurations corrompues

Connectez-vous à l'application et supprimez les configurations email avec des serveurs incorrects (ionos.smtp.fr au lieu de smtp.ionos.com).

### 5. Redémarrer l'application

```bash
npm run dev
```

## Test

Une fois configuré, l'erreur d'authentification devrait disparaître et vous devriez pouvoir :

- Configurer vos emails
- Synchroniser les emails
- Envoyer des emails
