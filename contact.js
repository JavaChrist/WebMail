import { auth, db, storage } from './firebase-config.js';
import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

let currentAddressBookId = null;

// Fonctions de gestion des photos
function handlePhotoPreview(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        const photoPreview = document.getElementById('photoPreview');

        reader.onload = function (e) {
            if (photoPreview) {
                photoPreview.src = e.target.result;
            }
        };

        reader.readAsDataURL(input.files[0]);
    }
}

// Définition du template de la modal de contact
const contactModal = `
    <div class="modal-content">
        <h2>Nouveau Contact</h2>
        <form id="newContactForm">
            <div class="form-group photo-upload">
                <div class="photo-preview">
                    <img src="./assets/image/defaut-contact.png" 
                         alt="Photo de profil" 
                         id="photoPreview"
                         onerror="this.src='./assets/image/defaut-contact.png'">
                    <label for="photoInput" class="photo-upload-label">
                        <i class="bx bx-camera"></i>
                    </label>
                </div>
                <input type="file" id="photoInput" accept="image/*" style="display: none">
            </div>
            <div class="form-group">
                <label for="firstName">Prénom</label>
                <input type="text" id="firstName" required>
            </div>
            <div class="form-group">
                <label for="lastName">Nom</label>
                <input type="text" id="lastName" required>
            </div>
            <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" required>
            </div>
            <div class="form-group">
                <label for="phone">Téléphone</label>
                <input type="tel" id="phone">
            </div>
            <div class="form-group">
                <label for="company">Société</label>
                <input type="text" id="company">
            </div>
            <div class="form-group">
                <label for="jobTitle">Fonction</label>
                <input type="text" id="jobTitle">
            </div>
            <div class="form-buttons">
                <button type="submit" class="submit-btn">Enregistrer</button>
                <button type="button" class="cancel-btn">Annuler</button>
            </div>
        </form>
    </div>
`;

// Fonction d'initialisation principale
async function initializeApp() {
    try {
        // Attendre que l'authentification soit prête
        await new Promise((resolve) => {
            const unsubscribe = auth.onAuthStateChanged((user) => {
                unsubscribe();
                if (user) {
                    console.log('Utilisateur connecté:', user.uid);
                    resolve();
                } else {
                    console.log('Utilisateur non connecté, redirection...');
                    window.location.href = '/login.html';
                }
            });
        });

        // Initialiser les gestionnaires d'événements
        initializeEventListeners();

        // Charger les carnets et contacts
        await loadAddressBooks();

    } catch (error) {
        console.error('Erreur initialisation:', error);
    }
}

// Fonction pour charger les carnets d'adresses
async function loadAddressBooks() {
    try {
        if (!auth.currentUser) {
            console.error('Utilisateur non connecté');
            return;
        }

        console.log('Chargement des carnets...');
        const q = query(
            collection(db, 'addressBooks'),
            where('userId', '==', auth.currentUser.uid)
        );

        const querySnapshot = await getDocs(q);
        const addressBooksList = document.querySelector('.address-books-list');

        if (!addressBooksList) {
            console.error('Liste des carnets non trouvée dans le DOM');
            return;
        }

        // Vider la liste actuelle
        addressBooksList.innerHTML = '';

        if (querySnapshot.empty) {
            console.log('Aucun carnet trouvé, création du carnet par défaut...');
            const defaultBookId = await createAddressBook('Carnet par défaut');
            currentAddressBookId = defaultBookId;
            await loadAddressBooks(); // Recharger les carnets
            return;
        }

        console.log('Nombre de carnets trouvés:', querySnapshot.size);

        querySnapshot.forEach((doc) => {
            const book = doc.data();
            console.log('Ajout du carnet:', book.name);

            const bookElement = document.createElement('li');
            bookElement.className = 'address-books-item';
            bookElement.textContent = book.name;

            if (!currentAddressBookId) {
                currentAddressBookId = doc.id;
                bookElement.classList.add('active');
            } else if (doc.id === currentAddressBookId) {
                bookElement.classList.add('active');
            }

            bookElement.addEventListener('click', () => selectAddressBook(doc.id, book.name));
            addressBooksList.appendChild(bookElement);
        });

        // Charger les contacts du carnet actif
        if (currentAddressBookId) {
            await loadContacts();
        }

    } catch (error) {
        console.error('Erreur chargement carnets:', error);
    }
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM chargé, initialisation...');
    initializeApp();
});

// Fonction pour charger les contacts (reste inchangée)
async function loadContacts() {
    try {
        showLoading();

        // Délai artificiel pour test (à retirer en production)
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (!currentAddressBookId) {
            console.log('Aucun carnet sélectionné');
            return;
        }

        console.log('Chargement des contacts pour le carnet:', currentAddressBookId);

        const q = query(
            collection(db, 'contacts'),
            where('addressBookId', '==', currentAddressBookId),
            where('userId', '==', auth.currentUser.uid),
            orderBy('lastName')
        );

        const querySnapshot = await getDocs(q);
        const contactsList = document.querySelector('.contacts-list');
        const contactsCount = document.querySelector('.contacts-count');

        if (!contactsList) {
            console.error('Liste des contacts non trouvée');
            return;
        }

        // Vider la liste actuelle
        contactsList.innerHTML = '';

        // Mettre à jour le compteur de contacts
        if (contactsCount) {
            const count = querySnapshot.size;
            contactsCount.textContent = count === 1 ? '1 contact' : `${count} contacts`;
        }

        if (querySnapshot.empty) {
            console.log('Aucun contact trouvé');
            contactsList.innerHTML = '<div class="no-contacts">Aucun contact dans ce carnet</div>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const contact = {
                id: doc.id,
                ...doc.data()
            };
            const contactElement = createContactElement(contact);
            contactsList.appendChild(contactElement);
        });

        console.log('Contacts chargés:', querySnapshot.size);

    } catch (error) {
        console.error('Erreur lors du chargement des contacts:', error);
    } finally {
        hideLoading();
    }
}

// Fonction pour créer un élément contact
function createContactElement(contact, id) {
    const div = document.createElement('div');
    div.className = 'contact-item';

    // Créer le HTML du contact
    div.innerHTML = `
        <div class="contact-info">
            <img src="${contact.photoUrl || './assets/image/defaut-contact.png'}" 
                 alt="Photo de ${contact.firstName} ${contact.lastName}" 
                 class="contact-photo"
                 onerror="this.src='./assets/image/defaut-contact.png'">
            <div class="contact-text">
                <h3>${contact.lastName || ''}, ${contact.firstName || ''}</h3>
                <p class="job-title">${contact.jobTitle || ''}</p>
                <p class="company">${contact.company || ''}</p>
            </div>
        </div>
    `;

    // Ajouter le gestionnaire de clic pour tout l'élément
    div.addEventListener('click', () => {
        showContactDetails(contact);
        // Ajouter la classe active
        document.querySelectorAll('.contact-item').forEach(item => {
            item.classList.remove('active');
        });
        div.classList.add('active');
    });

    // Ajouter les gestionnaires pour les boutons d'action
    const deleteBtn = div.querySelector('.delete-contact');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => deleteContact(id));
    }

    return div;
}

// Fonction pour éditer un contact
async function editContact(contact) {
    const editModal = document.getElementById('newContactModal');
    editModal.innerHTML = contactModal;
    editModal.classList.add('open');

    // Pré-remplir le formulaire
    document.getElementById('firstName').value = contact.firstName || '';
    document.getElementById('lastName').value = contact.lastName || '';
    document.getElementById('email').value = contact.email || '';
    document.getElementById('phone').value = contact.phone || '';
    document.getElementById('company').value = contact.company || '';
    document.getElementById('jobTitle').value = contact.jobTitle || '';

    // Afficher la photo existante ou l'image par défaut
    const photoPreview = document.getElementById('photoPreview');
    photoPreview.src = contact.photoUrl || './assets/image/defaut-contact.png';
    photoPreview.onerror = function () {
        this.src = './assets/image/defaut-contact.png';
    };

    // Gérer l'aperçu de la nouvelle photo
    const photoInput = document.getElementById('photoInput');
    if (photoInput) {
        photoInput.addEventListener('change', function () {
            handlePhotoPreview(this);
        });
    }

    const form = document.getElementById('newContactForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            let photoUrl = contact.photoUrl; // Garder l'ancienne photo par défaut

            // Upload de la nouvelle photo si sélectionnée
            const photoInput = document.getElementById('photoInput');
            if (photoInput.files.length > 0) {
                const file = photoInput.files[0];

                // Vérifier le type et la taille du fichier
                if (!file.type.match('image.*')) {
                    throw new Error('Le fichier doit être une image');
                }

                if (file.size > 5 * 1024 * 1024) {
                    throw new Error('L\'image ne doit pas dépasser 5 Mo');
                }

                // Utiliser le chemin correct pour le stockage
                const photoRef = ref(storage, `contacts/${auth.currentUser.uid}/${contact.id}`);
                await uploadBytes(photoRef, file);
                photoUrl = await getDownloadURL(photoRef);
            }

            // Mettre à jour le document avec la nouvelle photo
            await updateDoc(doc(db, 'contacts', contact.id), {
                firstName: document.getElementById('firstName').value,
                lastName: document.getElementById('lastName').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                company: document.getElementById('company').value,
                jobTitle: document.getElementById('jobTitle').value,
                photoUrl: photoUrl,
                updatedAt: new Date().toISOString()
            });

            editModal.classList.remove('open');
            await loadContacts();
            alert('Contact modifié avec succès !');
        } catch (error) {
            console.error('Erreur lors de la modification:', error);
            alert('Erreur: ' + error.message);
        }
    });

    // Gestionnaire pour le bouton annuler
    const cancelBtn = editModal.querySelector('.cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            editModal.classList.remove('open');
        });
    }
}

// Fonction pour afficher les détails d'un contact
function showContactDetails(contact) {
    const detailsSection = document.querySelector('.contact-details');
    if (!detailsSection) return;

    detailsSection.innerHTML = `
        <div class="contact-profile">
            <img src="${contact.photoUrl || './assets/image/defaut-contact.png'}" 
                 alt="Photo de profil" 
                 class="profile-photo"
                 onerror="this.src='./assets/image/defaut-contact.png'">
            <h2 class="contact-name">${contact.lastName}, ${contact.firstName}</h2>
            <p class="contact-title">${contact.jobTitle || ''}</p>
            <div class="contact-actions">
                ${contact.email ? `
                    <button class="action-btn" title="Envoyer un email" onclick="window.location.href='mailto:${contact.email}'">
                        <i class="bx bx-envelope"></i>
                        <span>Courriel</span>
                    </button>
                ` : ''}
                ${contact.phone ? `
                    <button class="action-btn" title="Appeler" onclick="window.location.href='tel:${contact.phone}'">
                        <i class="bx bx-phone"></i>
                        <span>Appeler</span>
                    </button>
                ` : ''}
                <button class="action-btn edit-contact" title="Modifier">
                    <i class="bx bx-edit"></i>
                    <span>Modifier</span>
                </button>
                <button class="action-btn delete-contact" title="Supprimer">
                    <i class="bx bx-trash"></i>
                    <span>Supprimer</span>
                </button>
            </div>
        </div>
        <div class="contact-info">
            ${contact.company ? `
                <div class="info-group">
                    <h3>Société</h3>
                    <p>${contact.company}</p>
                </div>
            ` : ''}
            ${contact.jobTitle ? `
                <div class="info-group">
                    <h3>Service</h3>
                    <p>${contact.jobTitle}</p>
                </div>
            ` : ''}
            ${contact.email ? `
                <div class="info-group">
                    <h3>Adresse électronique</h3>
                    <p>${contact.email}</p>
                </div>
            ` : ''}
            ${contact.phone ? `
                <div class="info-group">
                    <h3>Téléphone</h3>
                    <p>${contact.phone}</p>
                </div>
            ` : ''}
        </div>
    `;

    // Ajouter les gestionnaires d'événements
    const editBtn = detailsSection.querySelector('.edit-contact');
    const deleteBtn = detailsSection.querySelector('.delete-contact');

    if (editBtn) {
        editBtn.addEventListener('click', () => editContact(contact));
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (contact.id) {
                deleteContact(contact.id);
            } else {
                console.error('ID du contact manquant');
                alert('Impossible de supprimer ce contact');
            }
        });
    }
}

// Fonction pour créer un nouveau carnet
async function createAddressBook(name) {
    try {
        if (!auth.currentUser) {
            throw new Error('Utilisateur non connecté');
        }

        const bookData = {
            name: name,
            userId: auth.currentUser.uid,
            createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, 'addressBooks'), bookData);
        console.log('Nouveau carnet créé avec ID:', docRef.id);

        await loadAddressBooks();
        return docRef.id;

    } catch (error) {
        console.error('Erreur création carnet:', error);
        throw error;
    }
}

// Fonction pour sélectionner un carnet
async function selectAddressBook(bookId, bookName) {
    try {
        currentAddressBookId = bookId;
        const currentBookSpan = document.querySelector('.current-book');
        if (currentBookSpan) {
            currentBookSpan.textContent = bookName;
        }

        // Mettre à jour la classe active
        const bookItems = document.querySelectorAll('.address-books-item');
        bookItems.forEach(item => {
            item.classList.remove('active');
            if (item.textContent === bookName) {
                item.classList.add('active');
            }
        });

        // Recharger les contacts du carnet sélectionné
        await loadContacts();

    } catch (error) {
        console.error('Erreur lors de la sélection du carnet:', error);
    }
}

// Fonction pour initialiser la modal de contact
function initializeModalHandlers() {
    const modal = document.getElementById('newContactModal');
    if (!modal) {
        console.error('Modal non trouvée');
        return;
    }

    // S'assurer que la modal contient le template
    modal.innerHTML = contactModal;

    const form = document.getElementById('newContactForm');
    const photoInput = document.getElementById('photoInput');
    const cancelBtn = modal.querySelector('.cancel-btn');

    // Gestionnaire pour l'upload de photo
    if (photoInput) {
        photoInput.addEventListener('change', function () {
            handlePhotoPreview(this);
        });
    }

    // Gestionnaire pour le formulaire
    if (form) {
        form.removeEventListener('submit', handleNewContact); // Éviter les doublons
        form.addEventListener('submit', handleNewContact);
    }

    // Gestionnaire pour le bouton annuler
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            modal.classList.remove('open');
        });
    }
}

// Fonction séparée pour gérer le clic sur nouveau carnet
async function handleNewBookClick() {
    const name = prompt('Nom du nouveau carnet:');
    if (name && name.trim()) {
        try {
            await createAddressBook(name);
            console.log('Carnet créé avec succès');
        } catch (error) {
            console.error('Erreur création carnet:', error);
            alert('Erreur lors de la création du carnet');
        }
    }
}

// Fonction pour gérer la création d'un nouveau contact
async function handleNewContact(e) {
    e.preventDefault();
    console.log('Tentative de création de contact...');

    try {
        if (!currentAddressBookId) {
            throw new Error('Aucun carnet d\'adresses sélectionné');
        }

        const formData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            company: document.getElementById('company').value,
            jobTitle: document.getElementById('jobTitle').value,
            addressBookId: currentAddressBookId,
            userId: auth.currentUser.uid,
            createdAt: new Date().toISOString(),
            photoUrl: './assets/image/defaut-contact.png' // Photo par défaut
        };

        console.log('Données du formulaire:', formData);

        // Gérer l'upload de la photo
        const photoInput = document.getElementById('photoInput');
        if (photoInput && photoInput.files.length > 0) {
            try {
                const file = photoInput.files[0];
                const photoRef = ref(storage, `contacts/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
                await uploadBytes(photoRef, file);
                formData.photoUrl = await getDownloadURL(photoRef);
            } catch (photoError) {
                console.error('Erreur upload photo:', photoError);
                // Continuer avec la photo par défaut si l'upload échoue
            }
        }

        // Créer le contact dans Firestore
        const docRef = await addDoc(collection(db, 'contacts'), formData);
        console.log('Contact créé avec ID:', docRef.id);

        // Fermer la modal et recharger les contacts
        const modal = document.getElementById('newContactModal');
        if (modal) {
            modal.classList.remove('open');
        }

        await loadContacts();
        alert('Contact créé avec succès !');

    } catch (error) {
        console.error('Erreur lors de la création du contact:', error);
        alert('Erreur: ' + error.message);
    }
}

// Ajouter du CSS pour le message "Aucun contact"
const style = document.createElement('style');
style.textContent = `
    .no-contacts {
        text-align: center;
        padding: 2rem;
        color: var(--text-color-light);
        font-style: italic;
    }
`;
document.head.appendChild(style);

// Fonction de suppression de contact corrigée
async function deleteContact(contactId) {
    try {
        if (!contactId) {
            throw new Error('ID du contact non défini');
        }

        const contactRef = doc(db, 'contacts', contactId);
        const contactSnap = await getDoc(contactRef);

        if (!contactSnap.exists()) {
            throw new Error('Contact non trouvé');
        }

        const contactData = contactSnap.data();
        const confirmMessage = `Voulez-vous vraiment supprimer le contact ${contactData.firstName} ${contactData.lastName} ?`;

        if (window.confirm(confirmMessage)) {
            await deleteDoc(contactRef);
            await loadContacts();

            // Vider la section des détails
            const detailsSection = document.querySelector('.contact-details');
            if (detailsSection) {
                detailsSection.innerHTML = '';
            }

            console.log('Contact supprimé avec succès');
        }
    } catch (error) {
        console.error('Erreur lors de la suppression du contact:', error);
        alert('Erreur lors de la suppression du contact');
    }
}

// Ajouter la fonction de suppression de carnet
async function deleteAddressBook(bookId) {
    try {
        // Vérifier qu'il y a plus d'un carnet avant la suppression
        const booksQuery = query(
            collection(db, 'addressBooks'),
            where('userId', '==', auth.currentUser.uid)
        );
        const booksSnapshot = await getDocs(booksQuery);

        if (booksSnapshot.size <= 1) {
            throw new Error('Impossible de supprimer le dernier carnet');
        }

        // Obtenir les informations du carnet
        const bookRef = doc(db, 'addressBooks', bookId);
        const bookSnap = await getDoc(bookRef);

        if (!bookSnap.exists()) {
            throw new Error('Carnet non trouvé');
        }

        const bookName = bookSnap.data().name;

        if (confirm(`Voulez-vous vraiment supprimer le carnet "${bookName}" et tous ses contacts ?`)) {
            // Supprimer d'abord tous les contacts du carnet
            const contactsQuery = query(
                collection(db, 'contacts'),
                where('addressBookId', '==', bookId)
            );
            const contactsSnapshot = await getDocs(contactsQuery);

            // Supprimer les contacts
            const deleteContactsPromises = contactsSnapshot.docs.map(doc =>
                deleteDoc(doc.ref)
            );
            await Promise.all(deleteContactsPromises);

            // Supprimer le carnet
            await deleteDoc(bookRef);

            // Réinitialiser le carnet actif si c'était celui-ci
            if (currentAddressBookId === bookId) {
                currentAddressBookId = null;
            }

            // Recharger les carnets
            await loadAddressBooks();

            console.log('Carnet et contacts supprimés avec succès');
        }
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur: ' + error.message);
    }
}

// Fonction pour initialiser tous les gestionnaires d'événements
function initializeEventListeners() {
    // Gestionnaire pour le bouton nouveau contact
    const newContactBtn = document.getElementById('newContactBtn');
    if (newContactBtn) {
        newContactBtn.addEventListener('click', () => {
            const modal = document.getElementById('newContactModal');
            if (modal) {
                modal.classList.add('open');
                initializeModalHandlers(); // Initialiser les gestionnaires de la modal
            }
        });
    }

    // Gestionnaire pour le bouton nouveau carnet
    const newBookBtn = document.querySelector('.new-book-btn');
    if (newBookBtn) {
        newBookBtn.addEventListener('click', async () => {
            const name = prompt('Nom du nouveau carnet:');
            if (name) {
                try {
                    await createAddressBook(name);
                    console.log('Carnet créé avec succès');
                } catch (error) {
                    console.error('Erreur création carnet:', error);
                    alert('Erreur: ' + error.message);
                }
            }
        });
    }

    // Gestionnaire pour le bouton supprimer carnet
    const deleteBookBtn = document.querySelector('.delete-book-btn');
    if (deleteBookBtn) {
        deleteBookBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!currentAddressBookId) {
                alert('Veuillez sélectionner un carnet à supprimer');
                return;
            }

            try {
                const bookRef = doc(db, 'addressBooks', currentAddressBookId);
                const bookSnap = await getDoc(bookRef);

                if (!bookSnap.exists()) {
                    throw new Error('Carnet non trouvé');
                }

                const bookName = bookSnap.data().name;
                await deleteAddressBook(currentAddressBookId, bookName);
            } catch (error) {
                console.error('Erreur lors de la suppression:', error);
                alert('Erreur: ' + error.message);
            }
        });
    }

    // Gestionnaire pour la fermeture des modals
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('open');
        }
    });

    // Gestionnaire pour le formulaire de nouveau contact
    const newContactForm = document.getElementById('newContactForm');
    if (newContactForm) {
        newContactForm.addEventListener('submit', handleNewContact);
    }

    // Trouver l'input et l'icône de recherche
    const searchInput = document.querySelector('.nav-middle input');
    const searchIcon = document.querySelector('.nav-middle .bx-search');

    if (searchInput && searchIcon) {
        // Créer un conteneur pour le groupe de recherche s'il n'existe pas déjà
        const searchContainer = document.createElement('div');
        searchContainer.className = 'search-container';

        // Créer le bouton de recherche
        const searchButton = document.createElement('button');
        searchButton.className = 'search-button';
        searchButton.type = 'button';
        searchButton.innerHTML = '<i class="bx bx-search"></i>';

        // Remplacer l'icône par le bouton
        searchIcon.parentNode.replaceChild(searchButton, searchIcon);

        // Ajouter les gestionnaires d'événements
        searchButton.addEventListener('click', () => {
            console.log('Clic sur le bouton de recherche');
            filterContacts(searchInput.value);
            searchInput.focus();
        });

        searchInput.addEventListener('input', (e) => {
            console.log('Saisie dans l\'input:', e.target.value);
            filterContacts(e.target.value);
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('Touche Entrée pressée');
                filterContacts(searchInput.value);
            }
        });
    }

    initializeImportExport();
}

// Fonction pour filtrer les contacts
function filterContacts(searchTerm) {
    console.log('Début de la recherche avec:', searchTerm);
    searchTerm = searchTerm.toLowerCase().trim();
    const contacts = document.querySelectorAll('.contact-item');
    let hasResults = false;
    let resultCount = 0;

    contacts.forEach(contact => {
        // Récupérer tous les champs de texte possibles
        const contactInfo = contact.querySelector('.contact-info');
        if (!contactInfo) {
            console.log('Structure contact-info non trouvée');
            return;
        }

        // Récupérer le texte de tous les éléments pertinents
        const name = contactInfo.querySelector('h3')?.textContent || '';
        const details = Array.from(contactInfo.querySelectorAll('p'))
            .map(p => p.textContent)
            .join(' ');

        const searchText = `${name} ${details}`.toLowerCase();
        console.log('Texte recherché:', searchText);

        const isVisible = searchText.includes(searchTerm);

        if (isVisible) {
            contact.style.display = 'flex';
            contact.classList.add('search-result');
            hasResults = true;
            resultCount++;
            console.log('Contact trouvé:', name);
        } else {
            contact.style.display = 'none';
            contact.classList.remove('search-result');
        }
    });

    // Mettre à jour le compteur
    const contactsCount = document.querySelector('.contacts-count');
    if (contactsCount) {
        if (searchTerm === '') {
            const totalContacts = contacts.length;
            contactsCount.textContent = `${totalContacts} contact${totalContacts > 1 ? 's' : ''}`;
        } else {
            contactsCount.textContent = `${resultCount} résultat${resultCount > 1 ? 's' : ''}`;
        }
    }

    // Afficher/masquer le message "aucun résultat"
    const contactsList = document.querySelector('.contacts-list');
    const existingMessage = contactsList.querySelector('.no-results');

    if (!hasResults && searchTerm !== '') {
        if (!existingMessage) {
            const message = document.createElement('div');
            message.className = 'no-results';
            message.textContent = 'Aucun contact ne correspond à votre recherche';
            contactsList.appendChild(message);
        }
    } else if (existingMessage) {
        existingMessage.remove();
    }

    console.log(`Recherche terminée: ${resultCount} résultats trouvés`);
}

// Fonction pour mettre à jour le compteur de contacts visibles
function updateVisibleContactsCount() {
    const visibleContacts = document.querySelectorAll('.contact-item[style="display: flex"]');
    const contactsCount = document.querySelector('.contacts-count');

    if (contactsCount) {
        const count = visibleContacts.length;
        contactsCount.textContent = count === 1 ? '1 contact' : `${count} contacts`;
    }
}

// Fonction pour gérer la modification d'un contact
async function handleEditContact(e, contactId) {
    e.preventDefault();
    console.log('Modification du contact:', contactId);

    try {
        if (!contactId) {
            throw new Error('ID du contact non défini');
        }

        const formData = {
            firstName: document.getElementById('editFirstName').value,
            lastName: document.getElementById('editLastName').value,
            email: document.getElementById('editEmail').value,
            phone: document.getElementById('editPhone').value,
            company: document.getElementById('editCompany').value,
            jobTitle: document.getElementById('editJobTitle').value,
            updatedAt: new Date().toISOString()
        };

        // Gérer l'upload de la photo seulement si une nouvelle photo est sélectionnée
        const photoInput = document.getElementById('editPhotoInput');
        if (photoInput && photoInput.files.length > 0) {
            const file = photoInput.files[0];

            // Vérifier le type et la taille du fichier
            if (!file.type.match('image.*')) {
                throw new Error('Le fichier doit être une image');
            }

            if (file.size > 5 * 1024 * 1024) {
                throw new Error('L\'image ne doit pas dépasser 5 Mo');
            }

            // Utiliser le chemin correspondant aux règles de sécurité
            const photoRef = ref(storage, `contacts/${auth.currentUser.uid}/${contactId}`);

            try {
                await uploadBytes(photoRef, file);
                const photoUrl = await getDownloadURL(photoRef);
                formData.photoUrl = photoUrl;
            } catch (photoError) {
                console.error('Erreur upload photo:', photoError);
                throw new Error('Erreur lors de l\'upload de la photo');
            }
        }

        // Mettre à jour le contact dans Firestore
        const contactRef = doc(db, 'contacts', contactId);
        await updateDoc(contactRef, formData);

        // Fermer la modal et recharger les contacts
        const modal = document.getElementById('editContactModal');
        if (modal) {
            modal.classList.remove('open');
        }

        await loadContacts();
        alert('Contact modifié avec succès');

    } catch (error) {
        console.error('Erreur lors de la modification:', error);
        alert('Erreur: ' + error.message);
    }
}

function showLoading() {
    const loaderIcon = document.getElementById('contacts-loader');
    if (loaderIcon) {
        loaderIcon.classList.add('contacts-loading');
    }
}

function hideLoading() {
    const loaderIcon = document.getElementById('contacts-loader');
    if (loaderIcon) {
        loaderIcon.classList.remove('contacts-loading');
    }
}

// Fonctions d'export/import améliorées
function initializeImportExport() {
    const exportBtn = document.getElementById('exportContacts');
    const importBtn = document.getElementById('importContacts');
    const fileInput = document.getElementById('fileInput');

    // Export des contacts
    exportBtn.addEventListener('click', async () => {
        try {
            showLoading();
            const contacts = await getAllContacts();

            // Créer un menu contextuel pour choisir le format
            const format = await showExportFormatDialog();
            if (!format) return;

            if (format === 'csv') {
                exportToCSV(contacts);
            } else {
                exportToJSON(contacts);
            }
        } catch (error) {
            console.error('Erreur lors de l\'export:', error);
            alert('Erreur lors de l\'export: ' + error.message);
        } finally {
            hideLoading();
        }
    });

    // Import des contacts
    importBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
        try {
            const file = e.target.files[0];
            if (!file) return;

            showLoading();
            const fileType = file.name.endsWith('.csv') ? 'csv' : 'json';
            const reader = new FileReader();

            reader.onload = async (event) => {
                try {
                    let contacts;
                    if (fileType === 'csv') {
                        contacts = parseCSV(event.target.result);
                    } else {
                        contacts = JSON.parse(event.target.result);
                    }

                    // Afficher la prévisualisation
                    const shouldImport = await showPreviewDialog(contacts);
                    if (!shouldImport) return;

                    // Import avec gestion des doublons
                    await importContacts(contacts);

                    alert('Import terminé avec succès !');
                    await loadContacts();
                } catch (error) {
                    console.error('Erreur lors de l\'import:', error);
                    alert('Erreur lors de l\'import. Vérifiez le format du fichier.');
                }
            };

            reader.readAsText(file);
        } catch (error) {
            console.error('Erreur lors de l\'import:', error);
        } finally {
            hideLoading();
            fileInput.value = '';
        }
    });
}

// Fonction pour exporter en CSV
function exportToCSV(contacts) {
    const headers = ['Nom', 'Prénom', 'Email', 'Téléphone', 'Société', 'Fonction'];
    const csvContent = [
        headers.join(','),
        ...contacts.map(contact => [
            contact.lastName || '',
            contact.firstName || '',
            contact.email || '',
            contact.phone || '',
            contact.company || '',
            contact.jobTitle || ''
        ].map(field => `"${field}"`).join(','))
    ].join('\n');

    downloadFile(csvContent, `contacts_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
}

// Fonction pour exporter en JSON
function exportToJSON(contacts) {
    const data = JSON.stringify(contacts, null, 2);
    downloadFile(data, `contacts_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
}

// Fonction utilitaire pour télécharger un fichier
function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Fonction pour parser le CSV
function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',');
        const contact = {};
        headers.forEach((header, index) => {
            contact[header] = values[index]?.replace(/"/g, '').trim() || '';
        });
        return contact;
    });
}

// Fonction pour afficher la prévisualisation
async function showPreviewDialog(contacts) {
    return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.className = 'preview-dialog';
        dialog.innerHTML = `
            <div class="preview-content">
                <h2>Prévisualisation des contacts (${contacts.length})</h2>
                <div class="preview-list">
                    ${contacts.slice(0, 5).map(contact => `
                        <div class="preview-item">
                            <strong>${contact.firstName} ${contact.lastName}</strong>
                            <span>${contact.email}</span>
                        </div>
                    `).join('')}
                    ${contacts.length > 5 ? '<div class="preview-more">...et plus</div>' : ''}
                </div>
                <div class="preview-actions">
                    <button class="action-btn cancel">Annuler</button>
                    <button class="action-btn confirm">Importer</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        dialog.querySelector('.cancel').onclick = () => {
            document.body.removeChild(dialog);
            resolve(false);
        };

        dialog.querySelector('.confirm').onclick = () => {
            document.body.removeChild(dialog);
            resolve(true);
        };
    });
}

// Fonction pour choisir le format d'export avec fermeture au clic extérieur
async function showExportFormatDialog() {
    return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.className = 'preview-dialog';
        dialog.innerHTML = `
            <div class="preview-content">
                <div class="modal-header">
                    <h2>Choisir le format d'export</h2>
                    <button class="close-modal">
                        <i class="bx bx-x"></i>
                    </button>
                </div>
                <div class="format-buttons">
                    <button class="action-btn" data-format="csv">CSV</button>
                    <button class="action-btn" data-format="json">JSON</button>
                </div>
            </div>
        `;

        // Fermeture au clic extérieur
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                document.body.removeChild(dialog);
                resolve(null);
            }
        });

        // Fermeture au clic sur le bouton X
        dialog.querySelector('.close-modal').onclick = () => {
            document.body.removeChild(dialog);
            resolve(null);
        };

        document.body.appendChild(dialog);

        dialog.querySelectorAll('[data-format]').forEach(btn => {
            btn.onclick = () => {
                document.body.removeChild(dialog);
                resolve(btn.dataset.format);
            };
        });
    });
}

// Fonction pour importer les contacts avec gestion des doublons
async function importContacts(contacts) {
    const existingContacts = await getAllContacts();

    for (const newContact of contacts) {
        const existingContact = existingContacts.find(
            existing => existing.email === newContact.email
        );

        if (existingContact) {
            // Fusion des données
            const mergedContact = {
                ...existingContact,
                ...newContact,
                updatedAt: new Date().toISOString()
            };
            await updateContact(existingContact.id, mergedContact);
        } else {
            await addContact(newContact);
        }
    }
}

// Fonction helper pour récupérer tous les contacts
async function getAllContacts() {
    // Adapter selon votre structure de données
    const contactsRef = collection(db, 'contacts');
    const querySnapshot = await getDocs(contactsRef);
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}
