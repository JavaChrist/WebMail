import {
    auth,
    db,
    storage,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    doc,
    setDoc,
    serverTimestamp,
    ref,
    uploadBytes,
    getDownloadURL
} from './firebase-config.js';

// Fonction pour les alertes
const showAlert = (message, type) => {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 3000);
};

// Fonction pour l'upload de la photo
const uploadProfileImage = async (file, userId) => {
    try {
        // Stocker la photo dans localStorage avant l'upload
        const reader = new FileReader();
        await new Promise((resolve, reject) => {
            reader.onload = function (e) {
                const photoData = {
                    data: e.target.result,
                    name: file.name,
                    type: file.type
                };
                localStorage.setItem('initialProfilePhoto', JSON.stringify(photoData));
                console.log('📸 Photo stockée dans localStorage avant upload:', file.name);
                resolve();
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const timestamp = Date.now();
        const extension = file.name.split('.').pop();
        const fileName = `profilePhotos/${userId}/${timestamp}.${extension}`;
        const storageRef = ref(storage, fileName);

        const snapshot = await uploadBytes(storageRef, file);
        const photoURL = await getDownloadURL(snapshot.ref);
        console.log('✅ Photo uploadée avec succès:', photoURL);
        return photoURL;
    } catch (error) {
        console.error('❌ Erreur upload:', error);
        throw error;
    }
};

// Fonction de validation
const validateForm = (email, password) => {
    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error('Format d\'email invalide');
    }

    // Validation mot de passe
    if (password.length < 6) {
        throw new Error('Le mot de passe doit contenir au moins 6 caractères');
    }
};

// Gestionnaire de connexion
const handleLogin = async (e) => {
    e.preventDefault();
    try {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-pass').value;

        await signInWithEmailAndPassword(auth, email, password);
        showAlert('Connexion réussie !', 'success');
        setTimeout(() => window.location.href = 'index.html', 1500);
    } catch (error) {
        showAlert('Erreur de connexion: ' + error.message, 'error');
    }
};

// Gestionnaire d'inscription
const handleRegister = async (e) => {
    e.preventDefault();
    console.log('Début inscription...');

    try {
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-pass').value;
        const firstName = document.getElementById('register-firstname').value.trim();
        const lastName = document.getElementById('register-lastname').value.trim();
        const photoFile = document.getElementById('register-photo').files[0];

        // Validation des champs
        if (!email || !password || !firstName || !lastName) {
            throw new Error('Tous les champs sont obligatoires');
        }

        // Validation email et mot de passe
        validateForm(email, password);

        console.log('Données validées, création utilisateur...');

        try {
            // Upload de la photo d'abord si elle existe
            let photoURL = '/assets/image/defaut-contact.png';
            if (photoFile) {
                try {
                    console.log('📸 Début upload photo...');
                    photoURL = await uploadProfileImage(photoFile, 'temp'); // On utilisera un ID temporaire
                    console.log('✅ Photo uploadée avec succès:', photoURL);
                } catch (uploadError) {
                    console.error('❌ Erreur upload photo:', uploadError);
                    // Continue même si l'upload de la photo échoue
                }
            }

            // Création de l'utilisateur
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log('👤 Utilisateur créé:', user.uid);

            // Mise à jour du profil
            try {
                await updateProfile(user, {
                    displayName: `${firstName} ${lastName}`,
                    photoURL: photoURL
                });
                console.log('✅ Profil mis à jour');
            } catch (profileError) {
                console.error('❌ Erreur mise à jour profil:', profileError);
            }

            // Création document Firestore
            try {
                await setDoc(doc(db, 'users', user.uid), {
                    uid: user.uid,
                    email,
                    firstName,
                    lastName,
                    photoURL,
                    createdAt: serverTimestamp()
                });
                console.log('✅ Document Firestore créé');
            } catch (firestoreError) {
                console.error('❌ Erreur Firestore:', firestoreError);
            }

            showAlert('Inscription réussie !', 'success');
            setTimeout(() => window.location.href = 'index.html', 1500);

        } catch (error) {
            console.error('❌ Erreur complète:', error);
            let message;

            switch (error.code) {
                case 'auth/email-already-in-use':
                    message = 'Cette adresse email est déjà utilisée. Veuillez vous connecter ou utiliser une autre adresse.';
                    // Basculer vers le formulaire de connexion et pré-remplir l'email
                    document.getElementById('show-login').click();
                    const loginEmail = document.getElementById('login-email');
                    if (loginEmail) {
                        loginEmail.value = email;
                    }
                    break;
                case 'auth/invalid-email':
                    message = 'Format d\'email invalide. Veuillez vérifier votre saisie.';
                    break;
                case 'auth/operation-not-allowed':
                    message = 'L\'inscription est temporairement désactivée. Veuillez réessayer plus tard.';
                    break;
                case 'auth/weak-password':
                    message = 'Le mot de passe est trop faible. Il doit contenir au moins 6 caractères.';
                    break;
                default:
                    message = 'Erreur lors de l\'inscription : ' + error.message;
            }

            showAlert(message, 'error');
            throw error;
        }

    } catch (error) {
        console.error('❌ Erreur lors de l\'inscription:', error);
    }
};

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
    // Toggle password visibility
    const togglePassword = (inputId, eyeId) => {
        const input = document.getElementById(inputId);
        const eye = document.getElementById(eyeId);
        if (eye && input) {
            eye.addEventListener('click', () => {
                input.type = input.type === 'password' ? 'text' : 'password';
                eye.classList.toggle('bx-hide');
                eye.classList.toggle('bx-show');
            });
        }
    };

    // Setup photo preview
    const photoInput = document.getElementById('register-photo');
    const previewContainer = document.getElementById('photo-preview-container');
    if (photoInput && previewContainer) {
        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewContainer.innerHTML = `
                        <img src="${e.target.result}" id="photo-preview" alt="Prévisualisation">
                    `;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Toggle forms
    document.getElementById('show-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form')?.classList.add('hidden');
        document.getElementById('register-form')?.classList.remove('hidden');
    });

    document.getElementById('show-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-form')?.classList.add('hidden');
        document.getElementById('login-form')?.classList.remove('hidden');
    });

    // Setup password toggles
    togglePassword('login-pass', 'login-eye');
    togglePassword('register-pass', 'register-eye');

    // Setup form submissions
    document.querySelector('.login__form')?.addEventListener('submit', handleLogin);
    const registerForm = document.querySelector('.register__form');
    if (registerForm) {
        console.log('Gestionnaire d\'inscription attaché');
        registerForm.addEventListener('submit', handleRegister);
    } else {
        console.error('Formulaire d\'inscription non trouvé'); // Log de debug
    }

    // Check auth state
    auth.onAuthStateChanged(user => {
        const currentPath = window.location.pathname;
        if (!user && !currentPath.includes('login.html')) {
            window.location.href = 'login.html';
        } else if (user && currentPath.includes('login.html')) {
            window.location.href = 'index.html';
        }
    });
});