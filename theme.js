// Gestion du thème clair/sombre
function initializeTheme() {
    // Vérifier le thème enregistré ou utiliser la préférence système
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const defaultTheme = savedTheme || (prefersDark ? 'dark' : 'light');

    // Appliquer le thème initial
    document.documentElement.setAttribute('data-theme', defaultTheme);

    // Créer le bouton de thème
    const themeBtn = document.createElement('li');
    themeBtn.innerHTML = `
        <a href="#" class="theme-toggle">
            <i class="bx ${defaultTheme === 'dark' ? 'bx-sun' : 'bx-moon'} icon"></i>
        </a>
    `;

    // Insérer le bouton dans le menu (avant le bouton de déconnexion)
    const menuRight = document.querySelector('.menu-right');
    if (menuRight) {
        const logoutBtn = menuRight.querySelector('.bx-log-out')?.closest('li');
        if (logoutBtn) {
            menuRight.insertBefore(themeBtn, logoutBtn);
        } else {
            menuRight.appendChild(themeBtn);
        }
    }

    // Gestionnaire de changement de thème
    themeBtn.querySelector('.theme-toggle').addEventListener('click', (e) => {
        e.preventDefault();
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        // Mettre à jour l'icône
        const themeIcon = themeBtn.querySelector('i');
        themeIcon.className = `bx ${newTheme === 'dark' ? 'bx-sun' : 'bx-moon'} icon`;

        // Appliquer le nouveau thème
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
}

// Initialiser le thème au chargement
document.addEventListener('DOMContentLoaded', initializeTheme); 