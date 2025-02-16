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

    // Écouter les changements d'état d'authentification
    auth.onAuthStateChanged(async (user) => {
        console.log('🔄 Changement d\'état d\'authentification détecté');
        if (user) {
            console.log('👤 Utilisateur connecté:', {
                uid: user.uid,
                email: user.email,
                isAnonymous: user.isAnonymous,
                emailVerified: user.emailVerified
            });
            await loadEmailAccounts();
            startEmailRefresh();
        } else {
            console.log('⚠️ Aucun utilisateur connecté');
            const accountsContainer = document.querySelector('.email-accounts');
            if (accountsContainer) {
                accountsContainer.innerHTML = '<h3>Mes comptes email</h3><p>Veuillez vous connecter pour voir vos comptes email</p>';
            }
            stopEmailRefresh();
        }
    });

    // Fonction pour charger et afficher les comptes email
    async function loadEmailAccounts() {
        try {
            const user = auth.currentUser;
            if (!user) {
                console.log('❌ Aucun utilisateur connecté');
                return;
            }

            const userRef = doc(db, 'users', user.uid);
            const emailAccountsRef = collection(userRef, 'emailAccounts');
            const querySnapshot = await getDocs(emailAccountsRef);

            const accountsContainer = document.querySelector('.email-accounts');
            if (!accountsContainer) {
                console.log('❌ Container des comptes email non trouvé');
                return;
            }

            accountsContainer.innerHTML = '<h3>Mes comptes email</h3>';

            if (querySnapshot.empty) {
                accountsContainer.innerHTML += '<p>Aucun compte email configuré</p>';
                return;
            }

            querySnapshot.forEach((doc) => {
                const account = doc.data();
                const accountElement = document.createElement('div');
                accountElement.className = 'email-account';
                accountElement.innerHTML = `
                    <div class="account-info">
                        <i class='bx bx-envelope'></i>
                        <span>${account.accountName} (${account.emailAddress})</span>
                    </div>
                    <div class="account-actions">
                        <button class="edit-btn" title="Modifier">
                            <i class='bx bx-edit'></i>
                        </button>
                        <button class="delete-btn" title="Supprimer">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                `;
                accountsContainer.appendChild(accountElement);

                // Gestionnaire pour le bouton modifier
                const editBtn = accountElement.querySelector('.edit-btn');
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEditModal(doc.id, account);
                });

                // Gestionnaire pour le bouton supprimer
                const deleteBtn = accountElement.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm('Êtes-vous sûr de vouloir supprimer ce compte email ?')) {
                        await deleteEmailAccount(doc.id);
                    }
                });

                // Gestionnaire pour le clic sur le compte
                accountElement.addEventListener('click', () => {
                    openEditModal(doc.id, account);
                });
            });

            console.log('✅ Comptes email chargés avec succès');
        } catch (error) {
            console.error('❌ Erreur lors du chargement des comptes:', error);
        }
    }

    // Fonction pour ouvrir la modal en mode édition
    async function openEditModal(accountId, accountData) {
        const modal = document.getElementById('emailSettingsModal');
        const form = document.getElementById('emailAccountForm');

        // Remplir le formulaire avec les données du compte
        Object.keys(accountData).forEach(key => {
            const input = document.getElementById(key);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = accountData[key];
                } else {
                    input.value = accountData[key];
                }
            }
        });

        // Modifier le titre et le bouton de la modal
        const modalTitle = modal.querySelector('h2');
        modalTitle.textContent = 'Modifier le compte email';

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="bx bx-save"></i> Mettre à jour';

        // Stocker l'ID du compte dans le formulaire
        form.dataset.accountId = accountId;

        // Afficher la modal
        modal.style.display = 'block';
    }

    // Fonction pour supprimer un compte email
    async function deleteEmailAccount(accountId) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('Utilisateur non connecté');

            const accountRef = doc(db, 'users', user.uid, 'emailAccounts', accountId);
            await deleteDoc(accountRef);

            console.log('✅ Compte email supprimé avec succès');
            await loadEmailAccounts(); // Recharger la liste

        } catch (error) {
            console.error('❌ Erreur lors de la suppression:', error);
            alert('Erreur lors de la suppression du compte : ' + error.message);
        }
    }

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

    // Modifier le gestionnaire du formulaire pour gérer à la fois l'ajout et la modification
    if (emailAccountForm) {
        emailAccountForm.onsubmit = async function (e) {
            e.preventDefault();

            const formData = {
                accountName: document.getElementById('accountName').value,
                emailAddress: document.getElementById('emailAddress').value,
                password: document.getElementById('password').value,
                imapServer: document.getElementById('imapServer').value,
                imapPort: document.getElementById('imapPort').value,
                imapSecurity: document.getElementById('imapSecurity').value,
                imapUsername: document.getElementById('imapUsername').value,
                imapAuth: document.getElementById('imapAuth').checked,
                smtpServer: document.getElementById('smtpServer').value,
                smtpPort: document.getElementById('smtpPort').value,
                smtpSecurity: document.getElementById('smtpSecurity').value,
                smtpUsername: document.getElementById('smtpUsername').value,
                smtpAuth: document.getElementById('smtpAuth').checked
            };

            try {
                const user = auth.currentUser;
                if (!user) {
                    throw new Error('Vous devez être connecté pour gérer les comptes email');
                }

                const accountId = this.dataset.accountId;
                const userRef = doc(db, 'users', user.uid);

                if (accountId) {
                    // Mode modification
                    const accountRef = doc(userRef, 'emailAccounts', accountId);
                    await updateDoc(accountRef, {
                        ...formData,
                        updatedAt: serverTimestamp()
                    });
                    console.log('✅ Compte email mis à jour avec succès');
                    alert('Compte email mis à jour avec succès !');
                } else {
                    // Mode création
                    const emailAccountsRef = collection(userRef, 'emailAccounts');
                    const docRef = await addDoc(emailAccountsRef, {
                        ...formData,
                        userId: user.uid,
                        createdAt: serverTimestamp()
                    });
                    console.log('✅ Nouveau compte email ajouté:', docRef.id);
                    alert('Compte email ajouté avec succès !');
                }

                // Réinitialiser le formulaire et la modal
                this.reset();
                delete this.dataset.accountId;
                document.getElementById('emailSettingsModal').style.display = 'none';

                // Recharger la liste des comptes
                await loadEmailAccounts();

            } catch (error) {
                console.error('❌ Erreur lors de la sauvegarde:', error);
                alert('Erreur lors de la sauvegarde du compte : ' + error.message);
            }
        };
    }

    // Charger les comptes email au chargement de la page
    loadEmailAccounts();

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

        // Retirer toutes les classes d'état
        modal.classList.remove('minimized', 'normal', 'maximized');

        // Ajouter la nouvelle classe d'état
        if (newState !== 'normal') {
            modal.classList.add(newState);
        }

        currentState = newState;
        console.log('Nouvel état:', currentState);
    }

    if (modal) {
        // Nouveau message
        newEmailBtn?.addEventListener('click', function (e) {
            e.preventDefault();
            modal.style.display = 'block';
            applyState('normal');

            // Initialiser l'éditeur avec la signature
            const editorContent = document.querySelector('.editor-content');
            if (editorContent) {
                editorContent.innerHTML = '<br><br><br><div class="signature">Grohens Christian<br>Développeur web Freelance<br>5, rue Maurice Fonvieille<br>31120 Portet sur Garonne<br>09 52 62 31 71<br><a href="http://www.javachrist.fr">www.javachrist.fr</a></div>';
                // Placer le curseur au début de l'éditeur
                const range = document.createRange();
                const sel = window.getSelection();
                range.setStart(editorContent, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
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
    const editorContent = document.querySelector('.editor-content');
    const fontSelects = document.querySelectorAll('.font-select');
    const sizeSelects = document.querySelectorAll('.font-size');
    const editorButtons = document.querySelectorAll('.editor-toolbar button[data-command]');

    if (editorContent) {
        console.log('✅ Éditeur trouvé');

        // Initialiser tous les sélecteurs de police
        fontSelects.forEach(fontSelect => {
            console.log('✅ Sélecteur de police trouvé');
            fontSelect.innerHTML = fontFamilyOptions.map(option =>
                `<option value="${option.value}">${option.label}</option>`
            ).join('');

            // Ajouter l'écouteur d'événements
            fontSelect.addEventListener('change', function () {
                console.log('🎨 Changement de police détecté');

                if (!editorContent) {
                    console.log('❌ Pas de contenu éditeur');
                    return;
                }

                // Forcer le focus sur l'éditeur
                editorContent.focus();

                // Obtenir la sélection actuelle
                let selection = window.getSelection();

                // Si aucune sélection n'existe, créer une nouvelle sélection au point d'insertion
                if (!selection.rangeCount) {
                    console.log('❌ Pas de sélection - création d\'une nouvelle sélection au point d\'insertion');
                    const range = document.createRange();
                    range.setStart(editorContent, 0);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }

                const selectedFont = this.value;
                console.log('🎨 Police sélectionnée:', selectedFont);

                // Réactiver styleWithCSS avant chaque commande
                document.execCommand('styleWithCSS', false, true);
                document.execCommand('fontName', false, selectedFont);
                console.log('✅ Police appliquée');
            });
        });

        // Initialiser tous les sélecteurs de taille
        sizeSelects.forEach(sizeSelect => {
            console.log('✅ Sélecteur de taille trouvé');
            sizeSelect.innerHTML = fontSizeOptions.map(option =>
                `<option value="${option.value}"${option.value === '3' ? ' selected' : ''}>${option.label}</option>`
            ).join('');

            // Ajouter l'écouteur d'événements
            sizeSelect.addEventListener('change', function () {
                console.log('📏 Changement de taille détecté');

                if (!editorContent) {
                    console.log('❌ Pas de contenu éditeur');
                    return;
                }

                // Forcer le focus sur l'éditeur
                editorContent.focus();

                // Obtenir la sélection actuelle
                let selection = window.getSelection();

                // Si aucune sélection n'existe, créer une nouvelle sélection au point d'insertion
                if (!selection.rangeCount) {
                    console.log('❌ Pas de sélection - création d\'une nouvelle sélection au point d\'insertion');
                    const range = document.createRange();
                    range.setStart(editorContent, 0);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }

                const selectedSize = this.value;
                console.log('📏 Taille sélectionnée:', selectedSize);

                // Réactiver styleWithCSS avant chaque commande
                document.execCommand('styleWithCSS', false, true);
                document.execCommand('fontSize', false, selectedSize);
                console.log('✅ Taille appliquée');
            });
        });

        // Activer le mode styleWithCSS pour une meilleure gestion des styles
        document.execCommand('styleWithCSS', false, true);

        // Initialiser l'éditeur avec la signature
        editorContent.innerHTML = `<br><br><br><div class="signature">Grohens Christian<br>Développeur web Freelance<br>5, rue Maurice Fonvieille<br>31120 Portet sur Garonne<br>09 52 62 31 71<br><a href="http://www.javachrist.fr">www.javachrist.fr</a></div>`;

        // Placer le curseur au début
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStart(editorContent, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);

        // Gestionnaire pour tous les boutons de style
        editorButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const command = button.getAttribute('data-command');
                editorContent.focus();
                document.execCommand('styleWithCSS', false, true);
                document.execCommand(command, false, null);
                updateButtonStates();
                console.log(`Style ${command} appliqué`);
            });
        });

        // Mettre à jour l'état des boutons lors de la sélection
        editorContent.addEventListener('keyup', updateButtonStates);
        editorContent.addEventListener('mouseup', updateButtonStates);
        document.addEventListener('selectionchange', updateButtonStates);

        // Log pour le débogage
        editorContent.addEventListener('input', function () {
            console.log('Contenu modifié:', this.innerHTML);
        });
    }

    // Fonction pour mettre à jour l'état des boutons
    function updateButtonStates() {
        editorButtons.forEach(button => {
            const command = button.getAttribute('data-command');
            if (document.queryCommandState(command)) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    // Fonction pour récupérer le compte email actif
    async function getActiveEmailAccount() {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('Utilisateur non connecté');
        }

        const userRef = doc(db, 'users', user.uid);
        const emailAccountsRef = collection(userRef, 'emailAccounts');
        const querySnapshot = await getDocs(emailAccountsRef);

        if (querySnapshot.empty) {
            throw new Error('Aucun compte email configuré');
        }

        // Pour l'instant, on utilise le premier compte trouvé
        const accountDoc = querySnapshot.docs[0];
        return { id: accountDoc.id, ...accountDoc.data() };
    }

    // Fonction pour envoyer un email
    async function sendEmail(emailData) {
        try {
            console.log('🚀 Début de l\'envoi d\'email...');
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Utilisateur non connecté');
            }

            console.log('👤 Récupération du compte email actif...');
            const account = await getActiveEmailAccount();
            console.log('✅ Compte email trouvé:', account.emailAddress);

            // Vérification des données du compte
            if (!account.smtpServer || !account.smtpPort || !account.emailAddress || !account.password) {
                throw new Error('Configuration SMTP incomplète');
            }

            const token = await user.getIdToken();
            console.log('🔑 Token Firebase obtenu');

            // Configuration SMTP avec vérification des valeurs
            const smtpConfig = {
                host: account.smtpServer.trim(),
                port: parseInt(account.smtpPort),
                secure: true, // Force SSL/TLS
                auth: {
                    user: account.emailAddress.trim(),
                    pass: account.password
                },
                tls: {
                    rejectUnauthorized: false // Désactive la vérification du certificat
                }
            };

            // Log de vérification (sans le mot de passe)
            console.log('📤 Configuration SMTP:', {
                host: smtpConfig.host,
                port: smtpConfig.port,
                secure: smtpConfig.secure,
                auth: { user: smtpConfig.auth.user }
            });

            // Vérification des données d'envoi
            if (!emailData.to || !emailData.subject) {
                throw new Error('Destinataire ou sujet manquant');
            }

            console.log('📨 Envoi de la requête au serveur...');
            const response = await fetch('http://localhost:3000/api/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    from: account.emailAddress.trim(),
                    to: emailData.to.trim(),
                    subject: emailData.subject.trim(),
                    html: emailData.content,
                    smtpConfig
                })
            });

            console.log('📬 Réponse du serveur reçue:', response.status);
            const responseData = await response.json();

            if (!response.ok) {
                console.error('❌ Erreur serveur:', responseData);
                throw new Error(responseData.error || 'Erreur lors de l\'envoi de l\'email');
            }

            console.log('✅ Email envoyé avec succès:', responseData);
            return responseData;

        } catch (error) {
            console.error('❌ Erreur lors de l\'envoi:', error);
            throw error;
        }
    }

    // Gestionnaire pour le formulaire d'envoi d'email
    document.getElementById('composeForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('📝 Soumission du formulaire d\'email');

        const submitButton = e.target.querySelector('.send-btn');
        const originalText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Envoi en cours...';

        try {
            const editorContent = document.querySelector('.editor-content');
            const messageContent = editorContent.innerHTML;
            console.log('Contenu initial:', messageContent);

            // Extraire la signature existante
            const signatureMatch = messageContent.match(/<div class="signature">[\s\S]*?<\/div>/);
            if (!signatureMatch) {
                console.error('❌ Signature non trouvée dans le contenu');
                throw new Error('Erreur de formatage du message');
            }

            // Séparer le contenu et la signature
            const contentBeforeSignature = messageContent.substring(0, signatureMatch.index);
            const signature = signatureMatch[0];

            // Nettoyer le contenu en supprimant les balises <br> vides au début et à la fin
            const cleanContent = contentBeforeSignature
                .replace(/^(?:<br\s*\/?>\s*)*/, '') // Supprime les <br> au début
                .replace(/(?:<br\s*\/?>\s*)*$/, '') // Supprime les <br> à la fin
                .trim();

            // Vérifier si le contenu est vide après nettoyage
            if (!cleanContent) {
                throw new Error('Le contenu du message ne peut pas être vide');
            }

            // Construire le contenu final avec le texte du message et la signature
            const finalContent = `<div class="message-content">${cleanContent}</div><br><br>${signature}`;
            console.log('Contenu final:', finalContent);

            const emailData = {
                to: document.getElementById('compose-to').value,
                subject: document.getElementById('compose-subject').value,
                content: finalContent
            };

            console.log('📧 Données de l\'email:', {
                to: emailData.to,
                subject: emailData.subject,
                contentLength: finalContent.length
            });

            await sendEmail(emailData);

            // Réinitialiser le formulaire et afficher un message de succès
            e.target.reset();
            // Réinitialiser l'éditeur avec la signature par défaut
            editorContent.innerHTML = `<br><br><br><div class="signature">Grohens Christian<br>Développeur web Freelance<br>5, rue Maurice Fonvieille<br>31120 Portet sur Garonne<br>09 52 62 31 71<br><a href="http://www.javachrist.fr">www.javachrist.fr</a></div>`;
            showNotification('Email envoyé avec succès !', 'success');

            // Fermer la modal
            document.getElementById('composeEmailModal').style.display = 'none';

        } catch (error) {
            console.error('❌ Erreur lors de l\'envoi:', error);
            showNotification(error.message, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    });

    // Fonction pour formater la date
    function formatDate(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const oneDay = 24 * 60 * 60 * 1000;

        if (diff < oneDay && date.getDate() === now.getDate()) {
            return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        } else if (diff < 7 * oneDay) {
            return date.toLocaleDateString('fr-FR', { weekday: 'long' });
        } else {
            return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        }
    }

    // Fonction pour charger les dossiers IMAP
    async function loadFolders() {
        try {
            const user = auth.currentUser;
            if (!user) {
                console.error('❌ Aucun utilisateur connecté');
                return;
            }

            const token = await user.getIdToken();
            const response = await fetch('http://localhost:3000/api/email/folders', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de la récupération des dossiers');
            }

            displayFolders(data.folders);
        } catch (error) {
            console.error('❌ Erreur lors du chargement des dossiers:', error);
            showNotification('Erreur lors du chargement des dossiers: ' + error.message, 'error');
        }
    }

    // Fonction pour décoder le HTML
    function decodeHTML(html) {
        const txt = document.createElement('textarea');
        txt.innerHTML = html;
        return txt.value;
    }

    // Fonction pour afficher les emails
    function displayEmails(emails) {
        const emailList = document.querySelector('.email-list');
        if (!emailList) return;

    // Fonction pour mettre à jour l'état des boutons de la barre d'outils
    function updateToolbarButtons() {
        const selectedEmails = document.querySelectorAll('.email-select:checked');
        const toolbarButtons = document.querySelectorAll('.toolbar-right button');

        toolbarButtons.forEach(button => {
            button.disabled = selectedEmails.length === 0;
            button.style.opacity = selectedEmails.length === 0 ? '0.5' : '1';
        });
    }

    // Ajouter les gestionnaires d'événements pour les boutons de la barre d'outils
    document.addEventListener('DOMContentLoaded', () => {
        const deleteBtn = document.querySelector('.delete-btn');
        const archiveBtn = document.querySelector('.archive-btn');
        const spamBtn = document.querySelector('.spam-btn');

        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                const selectedEmails = document.querySelectorAll('.email-select:checked');
                const currentFolder = document.querySelector('.folder-item.active')?.dataset.folder || 'INBOX';

                for (const checkbox of selectedEmails) {
                    const uid = checkbox.dataset.uid;
                    await moveEmail(uid, currentFolder, 'Trash');
                }

                await fetchEmails(currentFolder);
            });
        }

        if (archiveBtn) {
            archiveBtn.addEventListener('click', async () => {
                const selectedEmails = document.querySelectorAll('.email-select:checked');
                const currentFolder = document.querySelector('.folder-item.active')?.dataset.folder || 'INBOX';

                for (const checkbox of selectedEmails) {
                    const uid = checkbox.dataset.uid;
                    await moveEmail(uid, currentFolder, 'Archives');
                }

                await fetchEmails(currentFolder);
            });
        }

        if (spamBtn) {
            spamBtn.addEventListener('click', async () => {
                const selectedEmails = document.querySelectorAll('.email-select:checked');
                const currentFolder = document.querySelector('.folder-item.active')?.dataset.folder || 'INBOX';

                for (const checkbox of selectedEmails) {
                    const uid = checkbox.dataset.uid;
                    await moveEmail(uid, currentFolder, 'Junk');
                }

                await fetchEmails(currentFolder);
            });
        }
    });

    // Fonction pour ouvrir un email
    function openEmail(email) {
        const decodeHTML = (html) => {
            const txt = document.createElement('textarea');
            txt.innerHTML = html;
            return txt.value;
        };

        const emailViewModal = document.createElement('div');
        emailViewModal.className = 'email-view-modal';
        emailViewModal.innerHTML = `
            <div class="email-view-content">
                <div class="email-view-header">
                    <div class="email-view-subject">${decodeHTML(email.subject)}</div>
                    <div class="email-view-info">
                        <div>De: ${decodeHTML(email.from)}</div>
                        <div>À: ${decodeHTML(email.to)}</div>
                        <div>Date: ${formatDate(email.date)}</div>
                    </div>
                    <button class="close-email-view">×</button>
                </div>
                <div class="email-view-body">
                    ${email.body}
                </div>
            </div>
        `;

        // Ajouter le style pour la modal
        const style = document.createElement('style');
        style.textContent = `
            .email-view-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            }
            .email-view-content {
                background: white;
                width: 80%;
                max-width: 800px;
                max-height: 90vh;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                display: flex;
                flex-direction: column;
            }
            .email-view-header {
                padding: 20px;
                border-bottom: 1px solid #eee;
            }
            .email-view-subject {
                font-size: 1.5em;
                font-weight: bold;
                margin-bottom: 10px;
            }
            .email-view-info {
                color: #666;
                font-size: 0.9em;
            }
            .email-view-info > div {
                margin: 5px 0;
            }
            .email-view-body {
                padding: 20px;
                overflow-y: auto;
                flex-grow: 1;
            }
            .close-email-view {
                position: absolute;
                top: 10px;
                right: 10px;
                border: none;
                background: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
            }
            .close-email-view:hover {
                color: #000;
            }
        `;
        document.head.appendChild(style);

        // Ajouter la modal au document
        document.body.appendChild(emailViewModal);

        // Gestionnaire pour fermer la modal
        const closeBtn = emailViewModal.querySelector('.close-email-view');
        closeBtn.onclick = () => {
            emailViewModal.remove();
        };

        // Fermer en cliquant en dehors
        emailViewModal.onclick = (e) => {
            if (e.target === emailViewModal) {
                emailViewModal.remove();
            }
        };
    }

    // Rafraîchir les emails périodiquement
    let refreshInterval;

    function startEmailRefresh() {
        fetchEmails(); // Première récupération
        refreshInterval = setInterval(fetchEmails, 60000); // Rafraîchir toutes les minutes
    }

    function stopEmailRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    }

    // Ajouter les gestionnaires de glisser-déposer pour les emails
    function initializeDragAndDrop() {
        const emailList = document.querySelector('.email-list');
        const folders = document.querySelectorAll('.folder-item');

        // Rendre les emails glissables
        emailList.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('email-item')) {
                e.dataTransfer.setData('text/plain', e.target.dataset.uid);
                e.target.classList.add('dragging');
            }
        });

        emailList.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('email-item')) {
                e.target.classList.remove('dragging');
            }
        });

        // Rendre les dossiers réceptifs au drop
        folders.forEach(folder => {
            folder.addEventListener('dragover', (e) => {
                e.preventDefault();
                folder.classList.add('drag-over');
            });

            folder.addEventListener('dragleave', () => {
                folder.classList.remove('drag-over');
            });

            folder.addEventListener('drop', async (e) => {
                e.preventDefault();
                folder.classList.remove('drag-over');

                const messageUid = e.dataTransfer.getData('text/plain');
                const currentFolder = document.querySelector('.folder-item.active')?.dataset.folder || 'INBOX';
                const targetFolder = folder.dataset.folder;

                if (messageUid && currentFolder !== targetFolder) {
                    await moveEmail(messageUid, currentFolder, targetFolder);
                }
            });
        });
    }

    emailList.innerHTML = '';
    emails.forEach(email => {
        const emailItem = document.createElement('div');
        emailItem.className = 'email-item';
        emailItem.draggable = true;
        emailItem.dataset.uid = email.uid;

        emailItem.innerHTML = `
            <div class="email-checkbox">
                <input type="checkbox" class="email-select" data-uid="${email.uid}">
            </div>
            <div class="email-sender">${decodeHTML(email.from)}</div>
            <div class="email-content">
                <div class="email-subject">${decodeHTML(email.subject)}</div>
                <div class="email-preview">${decodeHTML(email.body.substring(0, 100))}...</div>
            </div>
            <div class="email-date">${formatDate(email.date)}</div>
        `;

        emailItem.addEventListener('click', (e) => {
            if (!e.target.matches('input[type="checkbox"]')) {
                openEmail(email);
            }
        });

        emailList.appendChild(emailItem);
    });

    updateToolbarButtons();
}

    // Initialiser les fonctionnalités au chargement
    document.addEventListener('DOMContentLoaded', async function () {
        // ... existing initialization code ...

        // Charger les dossiers
        await loadFolders();

        // Initialiser le glisser-déposer
        initializeDragAndDrop();

        // Charger les emails de la boîte de réception par défaut
        await fetchEmails('INBOX');
    });
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
    { value: '1', label: 'Très petit' },
    { value: '2', label: 'Petit' },
    { value: '3', label: 'Normal' },
    { value: '4', label: 'Moyen' },
    { value: '5', label: 'Grand' },
    { value: '6', label: 'Très grand' },
    { value: '7', label: 'Énorme' }
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

// Gestionnaire pour le bouton d'ajout de dossier principal
document.querySelector('.add-folder-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const folderName = prompt('Nom du nouveau dossier d\'archives :');
    if (folderName) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('Vous devez être connecté');

            const token = await user.getIdToken();
            const response = await fetch('http://localhost:3000/api/email/folders/create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    folderName: `Archives/${folderName}`,
                    parentFolder: null
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Erreur lors de la création du dossier');
            }

            showNotification('Dossier créé avec succès', 'success');
            await loadFolders(); // Recharger la liste des dossiers
        } catch (error) {
            console.error('Erreur:', error);
            showNotification(error.message, 'error');
        }
    }
});

// Fonction pour créer un sous-dossier
async function createSubfolder(parentPath) {
    const folderName = prompt('Nom du nouveau sous-dossier :');
    if (folderName) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('Vous devez être connecté');

            const token = await user.getIdToken();
            const response = await fetch('http://localhost:3000/api/email/folders/create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    folderName,
                    parentFolder: parentPath
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Erreur lors de la création du sous-dossier');
            }

            showNotification('Sous-dossier créé avec succès', 'success');
            await loadFolders(); // Recharger la liste des dossiers
        } catch (error) {
            console.error('Erreur:', error);
            showNotification(error.message, 'error');
        }
    }
}

// Modifier la fonction displayFolders pour ajouter les boutons de sous-dossiers
function displayFolders(folders) {
    const mailFolders = document.querySelector('.mail-folders');
    if (!mailFolders) return;

    mailFolders.innerHTML = '';

    // Créer la boîte de réception
    const inboxFolder = folders.find(f => f.name.toUpperCase() === 'INBOX');
    if (inboxFolder) {
        const inboxElement = document.createElement('div');
        inboxElement.className = 'accordion-item';
        inboxElement.innerHTML = `
            <div class="accordion-header">
                <i class='bx bx-inbox'></i>
                <span>Boîte de réception</span>
                <i class='bx bx-chevron-down'></i>
            </div>
            <div class="accordion-content">
                <a href="#" class="folder-item" data-folder="${inboxFolder.path}">Principal</a>
            </div>
        `;
        mailFolders.appendChild(inboxElement);
    }

    // Créer les autres dossiers principaux
    const mainFolders = [
        { name: 'Drafts', icon: 'bx-edit', label: 'Brouillons' },
        { name: 'Sent', icon: 'bx-send', label: 'Envoyés' },
        { name: 'Junk', icon: 'bx-error', label: 'Spam' },
        { name: 'Trash', icon: 'bx-trash', label: 'Corbeille' }
    ];

    mainFolders.forEach(mainFolder => {
        const folder = folders.find(f => f.name.toUpperCase() === mainFolder.name.toUpperCase());
        if (folder) {
            const folderElement = document.createElement('a');
            folderElement.href = '#';
            folderElement.className = 'folder-item';
            folderElement.dataset.folder = folder.path;
            folderElement.innerHTML = `
                <i class='bx ${mainFolder.icon}'></i>
                ${mainFolder.label}
            `;
            mailFolders.appendChild(folderElement);
        }
    });

    // Créer la section Archives avec bouton d'ajout
    const archivesElement = document.createElement('div');
    archivesElement.className = 'accordion-item';
    archivesElement.innerHTML = `
        <div class="accordion-header">
            <i class='bx bx-archive'></i>
            <span>Archives</span>
            <button class="add-folder-btn" title="Nouveau dossier">
                <i class='bx bx-plus'></i>
            </button>
            <i class='bx bx-chevron-down'></i>
        </div>
        <div class="accordion-content">
            ${folders
            .filter(f => f.name.toLowerCase().includes('archive'))
            .map(folder => `
                    <div class="folder-item-container">
                        <a href="#" class="folder-item" data-folder="${folder.path}">${folder.name}</a>
                        <button class="add-subfolder-btn" title="Ajouter un sous-dossier" data-parent="${folder.path}">
                            <i class='bx bx-plus'></i>
                        </button>
                    </div>
                `).join('')}
        </div>
    `;
    mailFolders.appendChild(archivesElement);

    // Ajouter les gestionnaires pour les boutons de sous-dossiers
    archivesElement.querySelectorAll('.add-subfolder-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const parentPath = btn.dataset.parent;
            createSubfolder(parentPath);
        });
    });

    // Gestionnaires pour les dossiers existants
    mailFolders.querySelectorAll('.folder-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            e.preventDefault();
            const folder = e.currentTarget.dataset.folder;
            await fetchEmails(folder);
            document.querySelectorAll('.folder-item').forEach(f => f.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });

    // Gérer l'accordéon
    mailFolders.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            item.classList.toggle('active');
        });
    });
}

// Fonction pour récupérer les emails
async function fetchEmails(folder = 'INBOX') {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error('❌ Utilisateur non connecté');
            return;
        }

        const token = await user.getIdToken();
        const response = await fetch(`http://localhost:3000/api/email/messages?folder=${encodeURIComponent(folder)}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des emails');
        }

        const data = await response.json();
        displayEmails(data.messages);
    } catch (error) {
        console.error('❌ Erreur:', error);
        showNotification(error.message, 'error');
    }
}

// Fonction utilitaire pour afficher les notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}