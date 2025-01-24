import { auth, signOut } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // Vérifier le statut de connexion
    auth.onAuthStateChanged((user) => {
        if (user) {
            // Utilisateur connecté
            console.log('Utilisateur connecté:', user);

            // Mettre à jour la photo de profil
            const profilePhoto = document.querySelector('.photo-login');
            if (profilePhoto) {
                // Utiliser la photo de l'utilisateur si elle existe, sinon utiliser l'image par défaut
                profilePhoto.src = user.photoURL || '/assets/image/image-profil.png';

                // Gérer l'erreur de chargement de l'image
                profilePhoto.onerror = function () {
                    console.log('Erreur de chargement de la photo de profil, utilisation de l\'image par défaut');
                    this.src = '/assets/image/image-profil.png';
                };
            }

            // Afficher les éléments de l'utilisateur connecté
            const loginBtn = document.getElementById('loginBtn');
            const logoutBtn = document.getElementById('logoutBtn');
            if (loginBtn) loginBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'inline-block';

        } else {
            // Utilisateur non connecté
            console.log('Aucun utilisateur connecté');

            // Remettre la photo par défaut
            const profilePhoto = document.querySelector('.photo-login');
            if (profilePhoto) {
                profilePhoto.src = '/assets/image/image-profil.png';
            }

            // Afficher le bouton de connexion
            const loginBtn = document.getElementById('loginBtn');
            const logoutBtn = document.getElementById('logoutBtn');
            if (loginBtn) loginBtn.style.display = 'inline-block';
            if (logoutBtn) logoutBtn.style.display = 'none';

            // Rediriger vers la page de connexion si on n'est pas déjà dessus
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = 'login.html';
            }
        }
    });

    // Gestion de la déconnexion
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            signOut(auth).then(() => {
                console.log('Déconnexion réussie');
                window.location.href = 'index.html';
            }).catch((error) => {
                console.error('Erreur lors de la déconnexion:', error);
            });
        });
    }
});