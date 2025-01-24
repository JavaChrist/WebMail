import { auth, storage, ref, getDownloadURL } from './firebase-config.js';

export function initializeHeader() {
    const modal = document.getElementById("myModal");
    const hamburgerBtn = document.querySelector('.hamburger-btn');
    const closeBtn = document.querySelector('.close');

    // Ouvrir la modal
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', () => {
            if (modal) modal.classList.add('open');
        });
    }

    // Fermer la modal avec le bouton close
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modal) modal.classList.remove('open');
        });
    }

    // Fermer la modal en cliquant en dehors
    document.addEventListener('click', (e) => {
        if (modal && modal.classList.contains('open')) {
            // Vérifier si le clic est en dehors de la modal et du bouton hamburger
            if (!modal.contains(e.target) &&
                !hamburgerBtn.contains(e.target)) {
                modal.classList.remove('open');
            }
        }
    });

    // Empêcher la propagation des clics dans la modal
    if (modal) {
        modal.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}
