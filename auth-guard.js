import { auth } from './firebase-config.js';

function protectRoute() {
    return new Promise((resolve, reject) => {
        auth.onAuthStateChanged(user => {
            if (!user && !window.location.pathname.includes('login.html')) {
                window.location.href = 'login.html';
                reject('Non authentifié');
            } else {
                resolve(user);
            }
        });
    });
}

// Exporter la fonction
export { protectRoute }; 