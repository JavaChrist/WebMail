import {
    auth,
    storage,
    ref,
    uploadBytes,
    getDownloadURL,
    updateProfile,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
} from './firebase-config.js';

const showHiddenPass = (loginPass, loginEye) => {
    const input = document.getElementById(loginPass),
        iconEye = document.getElementById(loginEye)

    iconEye.addEventListener('click', () => {
        // Change password to text
        if (input.type === 'password') {
            // Switch to text
            input.type = 'text'
            // Change icon
            iconEye.classList.remove('bx-hide')
            iconEye.classList.add('bx-show')
        } else {
            // Change to password
            input.type = 'password'
            // Change icon
            iconEye.classList.remove('bx-show')
            iconEye.classList.add('bx-hide')
        }
    })
}

// Fonction pour afficher l'alerte
function showAlert(message, type = 'success') {
    console.log('Affichage alerte:', message, type); // Debug log

    // Supprimer l'ancienne alerte si elle existe
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }

    // Créer une nouvelle alerte
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type}`;
    alertElement.textContent = message;

    // Ajouter l'alerte au document
    document.body.appendChild(alertElement);

    // Forcer un reflow pour que l'animation fonctionne
    alertElement.offsetHeight;

    // Afficher l'alerte
    alertElement.style.display = 'block';

    // La masquer après 3 secondes
    setTimeout(() => {
        alertElement.style.display = 'none';
        alertElement.remove();
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    showHiddenPass('login-pass', 'login-eye')
    showHiddenPass('register-pass', 'register-eye')
    // Éléments DOM
    const loginFormContainer = document.getElementById('login-form');
    const registerFormContainer = document.getElementById('register-form');
    const showRegisterBtn = document.getElementById('show-register');
    const showLoginBtn = document.getElementById('show-login');
    const loginFormElement = document.querySelector('.login__form');
    const registerFormElement = document.querySelector('.register__form');

    // Gestion de la bascule entre les formulaires
    if (showRegisterBtn) {
        showRegisterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Switching to register form');
            loginFormContainer.classList.add('hidden');
            registerFormContainer.classList.remove('hidden');
        });
    }

    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Switching to login form');
            registerFormContainer.classList.add('hidden');
            loginFormContainer.classList.remove('hidden');
        });
    }

    // Gestion de la connexion
    if (loginFormElement) {
        loginFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-pass').value;

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                showAlert('Connexion réussie ! Redirection en cours...', 'success');

                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 3000);
            } catch (error) {
                console.error('Erreur de connexion:', error);
                let errorMessage;

                switch (error.code) {
                    case 'auth/invalid-credential':
                        errorMessage = 'Email ou mot de passe incorrect.';
                        break;
                    case 'auth/user-disabled':
                        errorMessage = 'Ce compte a été désactivé.';
                        break;
                    case 'auth/user-not-found':
                        errorMessage = 'Aucun compte ne correspond à cet email.';
                        break;
                    case 'auth/wrong-password':
                        errorMessage = 'Mot de passe incorrect.';
                        break;
                    default:
                        errorMessage = 'Une erreur est survenue lors de la connexion.';
                }

                showAlert(errorMessage, 'error');
            }
        });
    }

    // Gestion de l'inscription
    if (registerFormElement) {
        registerFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Début de l\'inscription');

            try {
                const email = document.getElementById('register-email').value;
                const password = document.getElementById('register-pass').value;
                const firstName = document.getElementById('register-firstname').value;
                const lastName = document.getElementById('register-lastname').value;
                const photoFile = document.getElementById('register-photo').files[0];

                // Vérifier si une photo a été sélectionnée
                if (!photoFile) {
                    showAlert('Veuillez sélectionner une photo de profil', 'error');
                    return;
                }

                // Vérifier le type de fichier
                if (!photoFile.type.startsWith('image/')) {
                    showAlert('Veuillez sélectionner un fichier image valide', 'error');
                    return;
                }

                // Créer l'utilisateur
                console.log('Création de l\'utilisateur...');
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                try {
                    // Upload de la photo
                    console.log('Upload de la photo...');
                    const storageRef = ref(storage, `profilePhotos/${user.uid}`);
                    const snapshot = await uploadBytes(storageRef, photoFile);
                    console.log('Photo uploadée avec succès');

                    // Obtenir l'URL de la photo
                    const photoURL = await getDownloadURL(snapshot.ref);
                    console.log('URL de la photo obtenue:', photoURL);

                    // Mettre à jour le profil avec la photo et le nom
                    await updateProfile(user, {
                        displayName: `${firstName} ${lastName}`,
                        photoURL: photoURL
                    });

                    console.log('Profil mis à jour avec succès');
                    showAlert('Compte créé avec succès ! Redirection en cours...', 'success');

                    // Redirection après un délai
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 3000);

                } catch (uploadError) {
                    console.error('Erreur lors de l\'upload:', uploadError);
                    showAlert('Erreur lors de l\'upload de la photo. Veuillez réessayer.', 'error');
                }

            } catch (error) {
                console.error('Erreur d\'inscription:', error);
                let errorMessage;

                switch (error.code) {
                    case 'auth/email-already-in-use':
                        errorMessage = 'Cette adresse email est déjà utilisée. Veuillez vous connecter ou utiliser une autre adresse.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'L\'adresse email n\'est pas valide.';
                        break;
                    case 'auth/operation-not-allowed':
                        errorMessage = 'L\'inscription par email/mot de passe n\'est pas activée.';
                        break;
                    case 'auth/weak-password':
                        errorMessage = 'Le mot de passe est trop faible. Il doit contenir au moins 6 caractères.';
                        break;
                    default:
                        errorMessage = 'Une erreur est survenue lors de l\'inscription.';
                }

                showAlert(errorMessage, 'error');
            }
        });
    }
});