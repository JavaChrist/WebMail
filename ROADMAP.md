# 🛣️ Roadmap WebMail – Objectif : Version stable avant le 15 avril 2025

> 🎯 Objectif : livrer une version fonctionnelle (emails, contacts, calendrier) avant le **15 avril 2025**, avec une base propre, testée et prête à être utilisée en interne ou en beta.

---

## ✅ Étape 1 – Mars 24 ➜ Fin mars : Base propre & structure

- [x] Revenir à un commit stable
- [ ] Créer une branche clean (`reprise-clean`)
- [ ] Nettoyer les composants inutiles
- [ ] Supprimer les scripts obsolètes (`--turbopack`, etc.)
- [ ] Refaire les dossiers : `pages`, `components`, `services`, `api`
- [ ] Ajouter les types manquants (TypeScript)

---

## ✉️ Étape 2 – 1er ➜ 5 avril : Module Emails

- [ ] Connexion IMAP (lecture des emails)
- [ ] Affichage de la boîte de réception
- [ ] Ouverture de mail + affichage complet
- [ ] Envoi via SMTP (avec pièces jointes)
- [ ] Brouillons + gestion des statuts (lu / non lu)

---

## 👥 Étape 3 – 6 ➜ 8 avril : Module Contacts

- [ ] Ajout / édition / suppression de contacts
- [ ] Catégorisation (amis, pro, famille...)
- [ ] Stockage Firebase Firestore
- [ ] UI simple et réactive (liste + fiche contact)

---

## 📅 Étape 4 – 9 ➜ 11 avril : Module Calendrier

- [ ] Vue calendrier (mois / semaine / jour)
- [ ] Création d’événements
- [ ] Stockage dans Firestore
- [ ] Affichage des événements du jour

---

## 🧪 Étape 5 – 12 ➜ 13 avril : Tests & Débogage

- [ ] Tests fonctionnels : navigation, formulaires
- [ ] Tests manuels : tous les modules
- [ ] Amélioration des logs (email + backend)
- [ ] Optimisation des performances

---

## 🚀 Étape 6 – 14 ➜ 15 avril : Finitions & Préparation alpha

- [ ] Meta tags SEO + favicon
- [ ] Responsive design validé
- [ ] README + instructions de déploiement
- [ ] Déploiement sur Vercel (si prêt)
- [ ] Préparation d’une version alpha à distribuer

---

## 💡 Option bonus

- [ ] Ajout d’un thème sombre
- [ ] Intégration d’un système de tags sur les emails
- [ ] Export contacts (CSV)
- [ ] Notifications d’événements par mail

---
