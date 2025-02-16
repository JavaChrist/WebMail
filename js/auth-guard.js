import { auth } from '../firebase-config.js';

export async function protectRoute() {
    return new Promise((resolve, reject) => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            const currentPath = window.location.pathname;
            console.log('État auth:', user ? 'connecté' : 'non connecté');
            console.log('Page:', currentPath);

            if (!user && !currentPath.includes('login.html')) {
                console.log('Non authentifié - redirection vers login');
                window.location.replace('/login.html');
                unsubscribe();
                reject(new Error('Non authentifié'));
            } else if (user && currentPath.includes('login.html')) {
                console.log('Déjà authentifié - redirection vers index');
                window.location.replace('/index.html');
                unsubscribe();
                resolve();
            } else {
                console.log('État correct - pas de redirection nécessaire');
                unsubscribe();
                resolve();
            }
        });

        // Timeout de sécurité
        setTimeout(() => {
            unsubscribe();
            reject(new Error('Timeout de vérification'));
        }, 5000);
    });
} 