import {
    auth,
    db,
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    signOut,
    storage,
    ref,
    uploadBytes,
    getDownloadURL,
    updateProfile
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const publicPages = ['/login.html'];
    const currentPath = window.location.pathname;
    let isRedirecting = false;

    // Gestion du changement de photo de profil
    const changePhotoBtn = document.getElementById('changePhotoBtn');
    const profilePhotoInput = document.getElementById('profilePhotoInput');

    if (changePhotoBtn && profilePhotoInput) {
        changePhotoBtn.addEventListener('click', () => {
            profilePhotoInput.click();
        });

        profilePhotoInput.addEventListener('change', async (e) => {
            if (!e.target.files.length) return;

            const file = e.target.files[0];
            console.log('📸 Photo sélectionnée:', file.name);

            const user = auth.currentUser;

            if (!user) {
                // Convertir le fichier en base64 pour le stockage
                const reader = new FileReader();
                reader.onload = function (e) {
                    const base64Data = e.target.result;
                    // Stocker à la fois les données base64 et le nom du fichier
                    const photoData = {
                        data: base64Data,
                        name: file.name,
                        type: file.type
                    };
                    localStorage.setItem('initialProfilePhoto', JSON.stringify(photoData));
                    console.log('📸 Photo temporairement stockée dans localStorage:', file.name);

                    // Afficher la photo sélectionnée immédiatement
                    const profilePhoto = document.querySelector('.photo-login');
                    if (profilePhoto) {
                        profilePhoto.src = base64Data;
                    }
                };
                reader.readAsDataURL(file);
                return;
            }

            try {
                // Créer une référence dans Storage
                const storageRef = ref(storage, `profilePhotos/${user.uid}/profile`);
                console.log('📤 Début du téléchargement vers Firebase Storage');

                // Télécharger le fichier
                await uploadBytes(storageRef, file);
                console.log('✅ Fichier téléchargé avec succès');

                // Obtenir l'URL de téléchargement
                const photoURL = await getDownloadURL(storageRef);
                console.log('🔗 URL de téléchargement obtenue:', photoURL);

                // Mettre à jour le profil utilisateur
                await updateProfile(user, { photoURL });
                console.log('👤 Profil utilisateur mis à jour');

                // Mettre à jour Firestore
                const userRef = doc(db, 'users', user.uid);
                await setDoc(userRef, { photoURL }, { merge: true });
                console.log('💾 Document Firestore mis à jour');

                // Mettre à jour l'interface
                document.querySelector('.photo-login').src = photoURL;

                alert('Photo de profil mise à jour avec succès !');
            } catch (error) {
                console.error('❌ Erreur lors de la mise à jour de la photo:', error);
                alert('Erreur lors de la mise à jour de la photo. Veuillez réessayer.');
            }
        });
    }

    // Fonction pour vérifier si une page est publique
    const isPublicPage = (path) => publicPages.some(page => path.includes(page));

    // Fonction pour mettre à jour l'UI
    async function updateUI(user) {
        if (!user) return;

        const profilePhoto = document.querySelector('.photo-login');
        if (profilePhoto) {
            try {
                // Vérifier d'abord si l'utilisateur a une photo dans Firestore
                const userRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userRef);
                const userData = userDoc.exists() ? userDoc.data() : null;

                // Vérifier si c'est une URL Firebase Storage
                if (userData?.photoURL && userData.photoURL.includes('firebasestorage.googleapis.com')) {
                    profilePhoto.src = userData.photoURL;
                } else {
                    profilePhoto.src = '/assets/image/defaut-contact.png';
                }

                profilePhoto.onerror = function () {
                    console.log('Erreur de chargement de la photo, utilisation de la photo par défaut');
                    this.src = '/assets/image/defaut-contact.png';
                    this.onerror = null;
                };
            } catch (error) {
                console.error('Erreur lors du chargement de la photo:', error);
                profilePhoto.src = '/assets/image/defaut-contact.png';
            }
        }

        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
    }

    // Fonction pour initialiser la photo de profil
    async function initializeProfilePhoto(user, photoData = null) {
        try {
            console.log('🚀 Début de l\'initialisation de la photo de profil');
            const storageRef = ref(storage, `profilePhotos/${user.uid}/profile`);

            if (photoData) {
                console.log('📸 Photo personnalisée détectée, préparation du téléchargement');
                try {
                    // Vérifier si les données sont valides
                    if (!photoData.startsWith('data:')) {
                        throw new Error('Format de données invalide');
                    }

                    // Convertir le base64 en Blob
                    const response = await fetch(photoData);
                    const blob = await response.blob();
                    console.log('📦 Photo convertie en Blob:', blob.size, 'bytes');

                    // Télécharger vers Firebase Storage
                    console.log('📤 Téléchargement vers Firebase Storage...');
                    await uploadBytes(storageRef, blob);
                    console.log('✅ Photo téléchargée avec succès');
                } catch (error) {
                    console.error('❌ Erreur lors du traitement de la photo personnalisée:', error);
                    throw error;
                }
            } else {
                console.log('ℹ️ Aucune photo personnalisée, utilisation de la photo par défaut');
                const response = await fetch('/assets/image/defaut-contact.png');
                const blob = await response.blob();
                await uploadBytes(storageRef, blob);
            }

            // Obtenir l'URL de la photo
            const photoURL = await getDownloadURL(storageRef);
            console.log('🔗 URL de la photo obtenue:', photoURL);

            // Mettre à jour le profil utilisateur
            await updateProfile(user, { photoURL });
            console.log('👤 Profil utilisateur mis à jour avec la nouvelle photo');

            return photoURL;
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation de la photo:', error);
            return '/assets/image/defaut-contact.png';
        }
    }

    // Gestion de l'état d'authentification et de la photo de profil
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('👤 Utilisateur connecté - ID:', user.uid);

            try {
                // Vérifier Firestore
                const userRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    console.log('✅ Document trouvé:', userDoc.data());
                    const userData = userDoc.data();

                    // Mise à jour de la photo de profil
                    const profilePhoto = document.querySelector('.photo-login');
                    if (profilePhoto) {
                        if (userData.photoURL && userData.photoURL.includes('firebasestorage.googleapis.com')) {
                            console.log('🖼️ Chargement photo depuis Firebase Storage');
                            try {
                                const storageRef = ref(storage, `profilePhotos/${user.uid}/profile`);
                                const photoURL = await getDownloadURL(storageRef);
                                profilePhoto.src = photoURL;
                                console.log('✅ Photo chargée avec succès');
                            } catch (error) {
                                console.error('❌ Erreur de chargement de la photo:', error);
                                if (error.code === 'storage/object-not-found') {
                                    console.log('🔄 Réinitialisation de la photo de profil...');
                                    try {
                                        // Réinitialiser avec la photo par défaut
                                        const photoURL = await initializeProfilePhoto(user);
                                        // Mettre à jour Firestore avec la nouvelle URL
                                        await setDoc(userRef, { photoURL }, { merge: true });
                                        profilePhoto.src = photoURL;
                                        console.log('✅ Photo réinitialisée avec succès');
                                    } catch (initError) {
                                        console.error('❌ Erreur lors de la réinitialisation:', initError);
                                        profilePhoto.src = '/assets/image/defaut-contact.png';
                                    }
                                } else {
                                    profilePhoto.src = '/assets/image/defaut-contact.png';
                                }
                            }
                        } else {
                            console.log('ℹ️ Utilisation de la photo par défaut');
                            profilePhoto.src = '/assets/image/defaut-contact.png';
                        }
                    }
                } else {
                    console.log('⚠️ Document non trouvé, création du profil...');

                    // Récupérer la photo stockée dans le localStorage
                    const storedPhotoJson = localStorage.getItem('initialProfilePhoto');
                    console.log('🔍 Recherche d\'une photo stockée:', storedPhotoJson ? 'Trouvée' : 'Non trouvée');

                    let photoURL;
                    const profilePhoto = document.querySelector('.photo-login');

                    if (storedPhotoJson) {
                        try {
                            const storedPhoto = JSON.parse(storedPhotoJson);
                            console.log('📸 Photo trouvée dans localStorage:', storedPhoto.name);

                            // Créer une référence dans Storage avec le nom du fichier original
                            const storageRef = ref(storage, `profilePhotos/${user.uid}/profile`);

                            // Convertir le base64 en Blob
                            const response = await fetch(storedPhoto.data);
                            const blob = await response.blob();
                            console.log('📦 Photo convertie en Blob:', blob.size, 'bytes');

                            // Télécharger vers Firebase Storage
                            console.log('📤 Téléchargement vers Firebase Storage...');
                            await uploadBytes(storageRef, blob);
                            console.log('✅ Photo téléchargée avec succès');

                            // Obtenir l'URL de téléchargement
                            photoURL = await getDownloadURL(storageRef);
                            console.log('🔗 URL de téléchargement obtenue:', photoURL);

                            // Mettre à jour le profil utilisateur
                            await updateProfile(user, { photoURL });
                            console.log('👤 Profil utilisateur mis à jour avec la nouvelle photo');

                            if (profilePhoto) {
                                profilePhoto.src = photoURL;
                            }

                            localStorage.removeItem('initialProfilePhoto');
                            console.log('🗑️ Photo supprimée du localStorage');
                        } catch (error) {
                            console.error('❌ Erreur lors de l\'initialisation de la photo stockée:', error);
                            photoURL = '/assets/image/defaut-contact.png';
                            if (profilePhoto) profilePhoto.src = photoURL;
                        }
                    } else {
                        console.log('ℹ️ Aucune photo stockée, utilisation de la photo par défaut');
                        photoURL = '/assets/image/defaut-contact.png';
                        if (profilePhoto) profilePhoto.src = photoURL;
                    }

                    // Créer le document utilisateur avec la photoURL
                    try {
                        await setDoc(userRef, {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName || '',
                            photoURL: photoURL,
                            createdAt: serverTimestamp(),
                            lastLogin: serverTimestamp()
                        });
                        console.log('✅ Profil créé avec succès avec la photo:', photoURL);
                    } catch (error) {
                        console.error('❌ Erreur lors de la création du profil:', error);
                    }
                }

            } catch (error) {
                console.error('❌ Erreur:', error);
                console.error('Stack:', error.stack);
            }
        } else {
            console.log('⚠️ Aucun utilisateur connecté');
            const profilePhoto = document.querySelector('.photo-login');
            if (profilePhoto) {
                profilePhoto.src = '/assets/image/defaut-contact.png';
            }
        }
    });

    // Un seul écouteur d'authentification
    const unsubscribe = auth.onAuthStateChanged((user) => {
        if (isRedirecting) return;

        if (!user && !isPublicPage(currentPath)) {
            isRedirecting = true;
            window.location.replace('/login.html');
        } else if (user && isPublicPage(currentPath)) {
            isRedirecting = true;
            window.location.replace('/index.html');
        } else if (user) {
            updateUI(user);
        }
    });

    // Gestion de la déconnexion
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            isRedirecting = true;
            try {
                await signOut(auth);
                window.location.replace('/login.html');
            } catch (error) {
                console.error('Erreur de déconnexion:', error);
                isRedirecting = false;
            }
        });
    }

    // Nettoyage à la fermeture
    window.addEventListener('unload', () => {
        unsubscribe();
    });
});