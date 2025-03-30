# WebMail - Application de Messagerie Web

## 📋 Description

WebMail est une application de messagerie web moderne développée avec Next.js, Firebase et TailwindCSS. Elle permet de gérer vos emails, contacts et calendrier dans une interface élégante et intuitive.

## 🚀 Fonctionnalités

### 📧 Gestion des Emails

- Configuration IMAP/SMTP pour la connexion à votre compte email
- Synchronisation des emails avec chiffrement sécurisé des mots de passe
- Lecture, envoi et gestion des emails
- Support des pièces jointes
- Interface utilisateur moderne et réactive
- Gestion des brouillons et des emails envoyés

### 👥 Gestion des Contacts

- Création, modification et suppression de contacts
- Organisation des contacts par catégories
- Recherche rapide de contacts
- Synchronisation avec Firebase
- Interface intuitive de gestion des contacts

### 📅 Calendrier

- Gestion des événements avec différentes priorités
- Catégorisation des événements (réunions, tâches, rappels, personnel, autre)
- Vue par mois, semaine, jour et agenda
- Interface personnalisée en français
- Synchronisation avec Firebase

## 🛠️ Technologies Utilisées

- Next.js 14 (App Router)
- Firebase (Authentication, Firestore)
- TailwindCSS
- TypeScript
- Node-IMAP et Nodemailer
- React Big Calendar
- Lucide Icons
- date-fns

## 🔒 Sécurité

- Authentification utilisateur via Firebase
- Chiffrement des mots de passe email
- Règles de sécurité Firestore personnalisées
- Gestion sécurisée des tokens d'authentification

## 🔧 Configuration Requise

- Node.js 18+
- Compte Firebase
- Compte email avec accès IMAP/SMTP

## ⚙️ Variables d'Environnement

```env
# Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=votre_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=votre_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=votre_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=votre_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=votre_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=votre_app_id

# Firebase Admin
FIREBASE_ADMIN_PROJECT_ID=votre_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=votre_client_email
FIREBASE_ADMIN_PRIVATE_KEY=votre_private_key

# Encryption
ENCRYPTION_KEY=votre_cle_de_chiffrement
```

## 📝 Notes de Mise à Jour

### 🆕 Dernières Modifications (Mars 2024)

#### 📧 Module Email

- Amélioration de la synchronisation des emails
- Ajout de logs détaillés pour le débogage
- Correction du chiffrement des mots de passe
- Optimisation de la gestion des erreurs
- Amélioration de la configuration Firebase Admin

#### 👥 Module Contacts

- Ajout de la gestion complète des contacts
- Interface utilisateur améliorée
- Synchronisation avec Firestore
- Système de catégorisation des contacts

## 🚀 Installation

1. Cloner le repository
2. Installer les dépendances : `npm install`
3. Configurer les variables d'environnement
4. Lancer en développement : `npm run dev`

## 👥 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## 📄 Licence

MIT
