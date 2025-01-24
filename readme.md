# Webmail Application

## Description

Une application de messagerie web moderne développée avec JavaScript, Firebase et Node.js. Cette application permet la gestion des emails, des contacts et du calendrier avec une interface utilisateur intuitive.

## Fonctionnalités principales

### 🔐 Système d'Authentification et Sécurité

#### Gestion des sessions
- Connexion obligatoire pour accéder à l'application
- Déconnexion automatique après 30 minutes d'inactivité
- Session expirée après 5 minutes de fermeture du navigateur
- Protection des routes contre les accès non autorisés

#### Sécurité
- Authentification Firebase
- Routes protégées
- Vérification continue de l'état de connexion
- Déconnexion sécurisée automatique et manuelle

#### Fonctionnalités de connexion
- Interface de connexion intuitive
- Gestion des erreurs d'authentification
- Redirection automatique vers la page de connexion
- Bouton de déconnexion accessible sur toutes les pages

### 📧 Gestion des emails

- Réception et envoi d'emails
- Support IMAP/SMTP
- Éditeur de texte riche
- Gestion des pièces jointes
- Organisation en dossiers (Boîte de réception, Envoyés, Brouillons, etc.)

### 👥 Gestion des contacts

- Carnet d'adresses complet
- Import/Export des contacts (CSV, JSON)
- Photos de profil
- Organisation en groupes

### 📅 Calendrier

#### Vues multiples

- Vue jour avec créneaux horaires
- Vue semaine avec planning détaillé
- Vue mois avec aperçu des événements
- Liste chronologique des rendez-vous

#### Gestion des rendez-vous

- Création, modification et suppression de rendez-vous
- Système de répétition flexible :
  - Quotidienne
  - Hebdomadaire
  - Bi-hebdomadaire
  - Mensuelle
  - Annuelle
- Gestion intelligente des dates de répétition (31 du mois)

#### Catégorisation et visibilité

- Système de visibilité :
  - Par défaut (bleu-vert)
  - Privé (rouge pastel)
  - Professionnel (vert pastel)
- Rubriques avec code couleur :
  - Rendez-vous (indigo)
  - Tâche à réaliser (orange foncé)
  - Tâche validée (vert forêt)
  - Divers (marron)

#### Rappels et notifications

- Système de rappels personnalisables
- Options de rappel :
  - Minutes (15, 30, 45)
  - Heures (1, 2, 4, 6, 8, 12)
  - Jours (1-6)
  - Semaines (1-4)

## Technologies utilisées

### Frontend

- HTML5/CSS3
- JavaScript (Vanilla)
- Firebase SDK
- BoxIcons pour les icônes
- Système d'authentification Firebase

### Backend

- Node.js
- Express.js
- Firebase Admin SDK
- Node-IMAP
- Nodemailer

### Base de données et stockage

- Firebase Firestore
- Firebase Storage

## Installation

1. Cloner le repository
2. Installer les dépendances avec `npm install`
3. Configurer les variables d'environnement
4. Lancer l'application avec `npm start`

## Configuration

1. Créer un projet Firebase
2. Configurer les clés d'API
3. Mettre à jour les variables d'environnement
4. Configurer l'authentification Firebase :
   - Activer l'authentification par email/mot de passe
   - Configurer les règles de sécurité
   - Définir les domaines autorisés

## Sécurité

Pour assurer la sécurité de l'application :
1. Toutes les routes sont protégées sauf la page de connexion
2. Les sessions sont automatiquement gérées
3. Les déconnexions automatiques sont configurées
4. Les tentatives d'accès non autorisées sont redirigées

## Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :

1. Fork le projet
2. Créer une branche pour votre fonctionnalité
3. Commiter vos changements
4. Pousser vers la branche
5. Ouvrir une Pull Request

## Licence

Ce projet est sous licence MIT.
