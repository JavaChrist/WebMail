import { auth, db, storage } from './firebase-config.js';
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    getDoc,
    doc,
    updateDoc,
    serverTimestamp,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM chargé, initialisation...');

    // Récupération des éléments du DOM
    const settingsBtn = document.getElementById('emailSettingsBtn');
    const settingsModal = document.getElementById('emailSettingsModal');
    const closeSettingsBtn = document.querySelector('.close-settings');
    const emailAccountForm = document.getElementById('emailAccountForm');

    console.log('État initial des éléments:', {
        settingsBtn,
        settingsModal,
        closeSettingsBtn
    });

    // Gestionnaire de clic sur le bouton des réglages
    if (settingsBtn) {
        settingsBtn.onclick = function (e) {
            console.log('Clic sur le bouton des réglages');
            e.preventDefault();
            if (settingsModal) {
                settingsModal.style.display = 'block';
                console.log('Modal affichée');
                // Fermer la modal hamburger
                const hamburgerModal = document.getElementById('myModal');
                hamburgerModal.classList.remove('open');
            } else {
                console.error('Modal des réglages non trouvée');
            }
        };
    } else {
        console.error('Bouton des réglages non trouvé');
    }

    // Gestionnaire de fermeture
    if (closeSettingsBtn) {
        closeSettingsBtn.onclick = function () {
            console.log('Fermeture de la modal');
            settingsModal.style.display = 'none';
        };
    }

    // Fermeture en cliquant en dehors
    window.onclick = function (e) {
        if (e.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    };

    // Gestion du formulaire
    if (emailAccountForm) {
        emailAccountForm.onsubmit = async function (e) {
            e.preventDefault();

            const formData = {
                accountName: document.getElementById('accountName').value,
                emailAddress: document.getElementById('emailAddress').value,
                password: document.getElementById('password').value,
                imapServer: document.getElementById('imapServer').value,
                imapPort: document.getElementById('imapPort').value,
                imapSsl: document.getElementById('imapSsl').checked,
                smtpServer: document.getElementById('smtpServer').value,
                smtpPort: document.getElementById('smtpPort').value,
                smtpSsl: document.getElementById('smtpSsl').checked
            };

            try {
                // Ici, ajoutez votre logique pour sauvegarder le compte
                console.log('Données du compte:', formData);
                // Réinitialiser le formulaire et fermer la modal
                emailAccountForm.reset();
                settingsModal.style.display = 'none';
            } catch (error) {
                console.error('Erreur lors de la sauvegarde:', error);
                alert('Erreur lors de la sauvegarde du compte');
            }
        };
    }

    // Sélection par ID plutôt que par classe
    const minimizeBtn = document.getElementById('minimizeEmailBtn');
    const maximizeBtn = document.getElementById('maximizeEmailBtn');
    const closeBtn = document.getElementById('closeEmailBtn');
    const modal = document.getElementById('composeEmailModal');
    const newEmailBtn = document.getElementById('newEmailBtn');

    // États possibles dans l'ordre croissant de taille
    const STATES = ['minimized', 'normal', 'maximized'];
    let currentState = 'normal';

    // Dimensions pour chaque état
    const states = {
        normal: {
            width: '600px',
            height: '80vh',
            top: 'auto',
            left: 'auto',
            right: '30px',
            bottom: '0'
        },
        maximized: {
            width: '90vw',
            height: '90vh',
            top: '5vh',
            left: '5vw',
            right: '5vw',
            bottom: '5vh'
        },
        minimized: {
            width: '600px',
            height: '48px',
            top: 'auto',
            left: 'auto',
            right: '30px',
            bottom: '0'
        }
    };

    // Fonction pour appliquer un état
    function applyState(newState) {
        console.log(`Changement d'état: ${currentState} -> ${newState}`);
        currentState = newState;

        Object.entries(states[newState]).forEach(([prop, value]) => {
            modal.style[prop] = value;
        });

        console.log('Nouvel état:', currentState);
    }

    if (modal) {
        // Nouveau message
        newEmailBtn?.addEventListener('click', function (e) {
            e.preventDefault();
            modal.style.display = 'block';
            applyState('normal');
            console.log('Modal ouverte en état normal');
        });

        // Fermer
        closeBtn?.addEventListener('click', function () {
            modal.style.display = 'none';
            currentState = 'normal';
            console.log('Modal fermée');
        });

        // Maximize - passe à la taille supérieure
        maximizeBtn?.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Clic sur maximize, état actuel:', currentState);

            const currentIndex = STATES.indexOf(currentState);
            if (currentIndex < STATES.length - 1) {
                applyState(STATES[currentIndex + 1]);
                console.log('Passage à la taille supérieure');
            } else {
                console.log('Déjà à la taille maximale');
            }
        });

        // Minimize - passe à la taille inférieure
        minimizeBtn?.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Clic sur minimize, état actuel:', currentState);

            const currentIndex = STATES.indexOf(currentState);
            if (currentIndex > 0) {
                applyState(STATES[currentIndex - 1]);
                console.log('Passage à la taille inférieure');
            } else {
                console.log('Déjà à la taille minimale');
            }
        });
    }

    // Code pour l'éditeur
    const fontSelect = document.querySelector('.font-select');
    const sizeSelect = document.querySelector('.font-size');
    const boldBtn = document.querySelector('[data-command="bold"]');
    const italicBtn = document.querySelector('[data-command="italic"]');
    const underlineBtn = document.querySelector('[data-command="underline"]');
    const message = document.querySelector('.editor-content');

    console.log('Éléments trouvés:', {
        fontSelect: fontSelect,
        sizeSelect: sizeSelect,
        boldBtn: boldBtn,
        italicBtn: italicBtn,
        underlineBtn: underlineBtn,
        message: message
    });

    // Initialiser les selects avec les options
    if (fontSelect) {
        populateSelect(fontSelect, fontFamilyOptions);
    }

    if (sizeSelect) {
        populateSelect(sizeSelect, fontSizeOptions);
    }

    // Fonction pour mettre à jour l'état actif des boutons
    function updateButtonStates() {
        if (document.queryCommandState('bold')) {
            boldBtn.classList.add('active');
        } else {
            boldBtn.classList.remove('active');
        }

        if (document.queryCommandState('italic')) {
            italicBtn.classList.add('active');
        } else {
            italicBtn.classList.remove('active');
        }

        if (document.queryCommandState('underline')) {
            underlineBtn.classList.add('active');
        } else {
            underlineBtn.classList.remove('active');
        }
    }

    if (message) {
        // Activer le mode styleWithCSS
        document.execCommand('styleWithCSS', false, true);

        // Police
        fontSelect?.addEventListener('change', function () {
            message.focus();
            document.execCommand('fontName', false, this.value);
            console.log('Police appliquée:', this.value);
        });

        // Taille
        sizeSelect?.addEventListener('change', function () {
            message.focus();
            document.execCommand('fontSize', false, this.value);
            console.log('Taille appliquée:', this.value);
        });

        // Gras
        boldBtn?.addEventListener('click', function (e) {
            e.preventDefault();
            message.focus();
            document.execCommand('bold', false, null);
            updateButtonStates();
            console.log('Gras appliqué');
        });

        // Italique
        italicBtn?.addEventListener('click', function (e) {
            e.preventDefault();
            message.focus();
            document.execCommand('italic', false, null);
            updateButtonStates();
            console.log('Italique appliqué');
        });

        // Souligné
        underlineBtn?.addEventListener('click', function (e) {
            e.preventDefault();
            message.focus();
            document.execCommand('underline', false, null);
            updateButtonStates();
            console.log('Souligné appliqué');
        });

        // Mettre à jour l'état des boutons lors de la sélection
        message.addEventListener('keyup', updateButtonStates);
        message.addEventListener('mouseup', updateButtonStates);
        document.addEventListener('selectionchange', updateButtonStates);

        // Log pour le débogage
        message.addEventListener('input', function () {
            console.log('Contenu modifié:', this.innerHTML);
            updateButtonStates();
        });
    } else {
        console.error('Élément message non trouvé');
    }
});

// Dans la section des options de l'éditeur
const fontFamilyOptions = [
    { value: 'Arial, sans-serif', label: 'Arial' },
    { value: 'Times New Roman, serif', label: 'Times New Roman' },
    { value: 'Helvetica, sans-serif', label: 'Helvetica' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: 'Verdana, sans-serif', label: 'Verdana' },
    { value: 'Tahoma, sans-serif', label: 'Tahoma' },
    { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet MS' },
    { value: 'Courier New, monospace', label: 'Courier New' },
    { value: 'Palatino, serif', label: 'Palatino' },
    { value: 'Garamond, serif', label: 'Garamond' },
    { value: 'Bookman, serif', label: 'Bookman' },
    { value: 'Comic Sans MS, cursive', label: 'Comic Sans MS' },
    { value: 'Impact, sans-serif', label: 'Impact' },
    { value: 'Lucida Sans, sans-serif', label: 'Lucida Sans' }
];

const fontSizeOptions = [
    { value: '8px', label: '8px' },
    { value: '9px', label: '9px' },
    { value: '10px', label: '10px' },
    { value: '11px', label: '11px' },
    { value: '12px', label: '12px' },
    { value: '13px', label: '13px' },
    { value: '14px', label: '14px' },
    { value: '16px', label: '16px' },
    { value: '18px', label: '18px' },
    { value: '20px', label: '20px' },
    { value: '22px', label: '22px' },
    { value: '24px', label: '24px' },
    { value: '26px', label: '26px' },
    { value: '28px', label: '28px' },
    { value: '32px', label: '32px' },
    { value: '36px', label: '36px' },
    { value: '40px', label: '40px' },
    { value: '48px', label: '48px' }
];

// Fonction pour peupler les selects
function populateSelect(select, options) {
    select.innerHTML = ''; // Vider le select
    options.forEach(option => {
        const optElement = document.createElement('option');
        optElement.value = option.value;
        optElement.textContent = option.label;
        select.appendChild(optElement);
    });
}

// Ajoutez ce CSS
const style = document.createElement('style');
style.textContent = `
    .editor-toolbar button.active {
        background-color: var(--first-color-lighter);
        color: var(--first-color);
    }
`;
document.head.appendChild(style);