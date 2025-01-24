document.addEventListener('DOMContentLoaded', () => {
    const appointmentForm = document.getElementById('appointmentForm');
    const appointmentModal = document.getElementById('appointmentModal');
    const appointmentList = document.getElementById('appointmentList');
    const closeModal = document.querySelector('.close');
    const calendarView = document.getElementById('calendarView');
    let currentDate = new Date();

    // Au début du fichier, ajoutons une variable pour stocker les rendez-vous
    let appointments = JSON.parse(localStorage.getItem('appointments')) || [];

    // Fonction pour sauvegarder les rendez-vous dans le localStorage
    function saveAppointments() {
        localStorage.setItem('appointments', JSON.stringify(appointments));
    }

    // Fonction pour charger et afficher les rendez-vous existants
    function loadAppointments() {
        const appointmentList = document.getElementById('appointmentList');
        appointmentList.innerHTML = ''; // Nettoie la liste

        // Trier les rendez-vous par date et heure
        appointments.sort((a, b) => {
            const dateA = new Date(a.date + 'T' + a.time);
            const dateB = new Date(b.date + 'T' + b.time);
            return dateA - dateB;
        });

        // Afficher dans la liste des rendez-vous
        appointments.forEach((appointment, index) => {
            // Formatage de la date
            const [year, month, day] = appointment.date.split('-');
            const formattedDate = `${day}/${month}/${year}`;

            const appointmentItem = document.createElement('li');
            appointmentItem.className = 'appointment-item';
            appointmentItem.innerHTML = `
                <span class="appointment-text">${appointment.title} - ${formattedDate} ${appointment.time} (${appointment.category})</span>
                <button class="delete-button" data-index="${index}">
                    <i class="bx bx-trash"></i>
                </button>
            `;
            appointmentList.appendChild(appointmentItem);
        });

        // Afficher dans la vue jour
        const daySlots = document.querySelectorAll('.appointment-slot');
        daySlots.forEach(slot => {
            slot.textContent = '';
            slot.style.backgroundColor = '';
            slot.style.color = '';
        });

        // Utiliser la date sélectionnée pour la vue jour
        const selectedDateStr = currentDate.toISOString().split('T')[0];
        const dayAppointments = appointments.filter(app => app.date === selectedDateStr);

        dayAppointments.forEach(appointment => {
            const [hour] = appointment.time.split(':');
            const targetSlot = document.querySelector(`.appointment-slot[data-hour="${hour}"]`);
            if (targetSlot) {
                targetSlot.textContent = `${appointment.title} (${appointment.time})`;
                targetSlot.style.backgroundColor = '#81B2B7';
                targetSlot.style.color = '#fff';
            }
        });

        // Afficher dans la vue semaine
        const weekSlots = document.querySelectorAll('.week-grid .appointment-slot');
        weekSlots.forEach(slot => {
            slot.textContent = '';
            slot.style.backgroundColor = '';
            slot.style.color = '';

            const day = parseInt(slot.dataset.day);
            const hour = parseInt(slot.dataset.hour);

            // Calculer la date pour ce slot
            const slotDate = new Date(currentDate);
            slotDate.setDate(slotDate.getDate() - slotDate.getDay() + day);
            const slotDateStr = slotDate.toISOString().split('T')[0];

            const appointment = appointments.find(app =>
                app.date === slotDateStr &&
                parseInt(app.time.split(':')[0]) === hour
            );

            if (appointment) {
                slot.textContent = `${appointment.title} (${appointment.time})`;
                slot.style.backgroundColor = '#81B2B7';
                slot.style.color = '#fff';
            }
        });

        // Afficher dans la vue mois
        const monthCells = document.querySelectorAll('.month-cell');
        monthCells.forEach(cell => {
            const cellDate = new Date(cell.dataset.date);
            // S'assurer que la date est au format YYYY-MM-DD
            const cellDateStr = cellDate.toISOString().split('T')[0];

            const appointmentsContainer = cell.querySelector('.day-appointments');
            if (appointmentsContainer) {
                appointmentsContainer.innerHTML = '';

                const cellAppointments = appointments.filter(app => app.date === cellDateStr);

                cellAppointments.sort((a, b) => a.time.localeCompare(b.time));

                cellAppointments.forEach(appointment => {
                    const appointmentDiv = document.createElement('div');
                    appointmentDiv.className = 'month-appointment';
                    appointmentDiv.textContent = `${appointment.time} ${appointment.title}`;
                    appointmentDiv.style.backgroundColor = '#81B2B7';
                    appointmentDiv.style.color = '#fff';
                    appointmentDiv.style.padding = '2px';
                    appointmentDiv.style.margin = '1px';
                    appointmentDiv.style.borderRadius = '3px';
                    appointmentDiv.style.fontSize = '0.8em';
                    appointmentsContainer.appendChild(appointmentDiv);
                });
            }
        });

        // Ajouter les gestionnaires d'événements pour la suppression
        document.querySelectorAll('.delete-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = e.currentTarget.dataset.index;
                deleteAppointment(index);
            });
        });
    }

    // Fonction pour la vue Jour
    function renderDayView(date) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = date.toLocaleDateString('fr-FR', options);

        let dayViewContent = `<div class="date-navigation">`;
        dayViewContent += '<button id="prevDay">&larr;</button>';
        dayViewContent += `<h2>${formattedDate}</h2>`;
        dayViewContent += '<button id="nextDay">&rarr;</button>';
        dayViewContent += '</div>';
        dayViewContent += '<div class="day-view">';
        dayViewContent += '<div class="hours-column"><ul>';
        for (let hour = 0; hour < 24; hour++) {
            dayViewContent += `<li>${hour}:00</li>`;
        }
        dayViewContent += '</ul></div>';
        dayViewContent += '<div class="appointments-column"><ul>';
        for (let hour = 0; hour < 24; hour++) {
            dayViewContent += `<li class="appointment-slot" data-hour="${hour}"></li>`;
        }
        dayViewContent += '</ul></div>';
        dayViewContent += '</div>';
        calendarView.innerHTML = dayViewContent;

        // Gestionnaires d'événements pour la vue jour
        document.getElementById('prevDay').addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() - 1);
            renderDayView(currentDate);
            loadAppointments(); // S'assurer que les rendez-vous sont chargés
            setupDateClickHandlers();
        });

        document.getElementById('nextDay').addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() + 1);
            renderDayView(currentDate);
            loadAppointments(); // S'assurer que les rendez-vous sont chargés
            setupDateClickHandlers();
        });

        setupDateClickHandlers();
    }

    // Fonction pour la vue Semaine
    function renderWeekView(date) {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay() + 1);

        let weekViewContent = '<div class="date-navigation">';
        weekViewContent += '<button id="prevWeek">&larr;</button>';
        weekViewContent += `<h2>Semaine du ${startOfWeek.toLocaleDateString('fr-FR')}</h2>`;
        weekViewContent += '<button id="nextWeek">&rarr;</button>';
        weekViewContent += '</div>';

        weekViewContent += '<div class="week-view">';

        // Conteneur principal pour les jours
        weekViewContent += '<div class="days-container">';

        // En-tête des jours avec espace vide pour aligner avec la colonne des heures
        weekViewContent += '<div class="week-header">';
        weekViewContent += '<div class="header-spacer"></div>'; // Espace pour aligner avec la colonne des heures
        const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
        days.forEach((day, index) => {
            const currentDay = new Date(startOfWeek);
            currentDay.setDate(startOfWeek.getDate() + index);
            const isCurrentDay = currentDay.toDateString() === new Date().toDateString();
            weekViewContent += `
                <div class="day-header ${isCurrentDay ? 'current-day' : ''}">
                    <span class="weekday">${day}</span>
                    <span class="date">${currentDay.getDate()}</span>
                </div>`;
        });
        weekViewContent += '</div>';

        // Conteneur pour la grille horaire
        weekViewContent += '<div class="time-grid-container">';

        // Colonne des heures (à gauche)
        weekViewContent += '<div class="time-column">';
        for (let hour = 0; hour < 24; hour++) {
            weekViewContent += `<div class="hour-cell">${hour}:00</div>`;
        }
        weekViewContent += '</div>';

        // Grille des jours
        weekViewContent += '<div class="week-grid">';
        for (let day = 0; day < 7; day++) {
            const currentDay = new Date(startOfWeek);
            currentDay.setDate(startOfWeek.getDate() + day);
            const isCurrentDay = currentDay.toDateString() === new Date().toDateString();
            weekViewContent += `<div class="day-column ${isCurrentDay ? 'current-day' : ''}">`;
            for (let hour = 0; hour < 24; hour++) {
                weekViewContent += `<div class="appointment-slot" data-hour="${hour}" data-day="${day}"></div>`;
            }
            weekViewContent += '</div>';
        }
        weekViewContent += '</div>';

        weekViewContent += '</div>'; // Fin time-grid-container
        weekViewContent += '</div>'; // Fin days-container
        weekViewContent += '</div>'; // Fin week-view

        calendarView.innerHTML = weekViewContent;

        // Gestionnaires d'événements pour la vue semaine
        document.querySelectorAll('.appointment-slot').forEach(slot => {
            slot.addEventListener('click', () => {
                appointmentModal.style.display = 'block';
            });
        });

        document.getElementById('prevWeek').addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() - 7);
            renderWeekView(currentDate);
            loadAppointments(); // S'assurer que les rendez-vous sont chargés
            setupDateClickHandlers();
        });

        document.getElementById('nextWeek').addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() + 7);
            renderWeekView(currentDate);
            loadAppointments(); // S'assurer que les rendez-vous sont chargés
            setupDateClickHandlers();
        });

        setupDateClickHandlers();
    }

    // Fonction pour la vue Mois
    function renderMonthView(date) {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        let monthViewContent = '<div class="date-navigation">';
        monthViewContent += '<button id="prevMonth">&larr;</button>';
        monthViewContent += `<h2>${date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })}</h2>`;
        monthViewContent += '<button id="nextMonth">&rarr;</button>';
        monthViewContent += '</div>';

        monthViewContent += '<div class="month-view">';
        monthViewContent += '<div class="month-grid">';

        // En-tête des jours
        ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].forEach(day => {
            monthViewContent += `<div class="weekday-header">${day}</div>`;
        });

        // Ajuster le premier jour de la semaine (0 = Dimanche, 1 = Lundi)
        let firstDayOfWeek = firstDay.getDay();
        if (firstDayOfWeek === 0) firstDayOfWeek = 7;
        firstDayOfWeek--;

        let date_iter = new Date(firstDay);
        date_iter.setDate(1 - firstDayOfWeek);

        // Corps du calendrier
        while (date_iter <= lastDay || date_iter.getDay() !== 1) {
            const isCurrentMonth = date_iter.getMonth() === date.getMonth();
            const isToday = date_iter.toDateString() === new Date().toDateString();
            const classes = [
                'month-cell',
                isCurrentMonth ? 'current-month' : 'other-month',
                isToday ? 'today' : ''
            ].filter(Boolean).join(' ');

            const cellDate = new Date(date_iter);
            monthViewContent += `
                <div class="${classes}" data-date="${cellDate.toISOString().split('T')[0]}">
                    <div class="day-number">${date_iter.getDate()}</div>
                    <div class="day-appointments"></div>
                </div>`;

            date_iter.setDate(date_iter.getDate() + 1);
        }

        monthViewContent += '</div>'; // Fin month-grid
        monthViewContent += '</div>'; // Fin month-view

        calendarView.innerHTML = monthViewContent;

        // Gestionnaires d'événements pour la vue mois
        document.querySelectorAll('.month-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                appointmentModal.style.display = 'block';
            });
        });

        document.getElementById('prevMonth').addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderMonthView(currentDate);
            loadAppointments(); // S'assurer que les rendez-vous sont chargés
            setupDateClickHandlers();
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderMonthView(currentDate);
            loadAppointments(); // S'assurer que les rendez-vous sont chargés
            setupDateClickHandlers();
        });

        setupDateClickHandlers();
    }

    // Ajout du champ de rappel dans le formulaire de rendez-vous
    function addReminderField() {
        const reminderField = `
            <label for="reminder">Rappel:</label>
            <select id="reminder" name="reminder">
                <option value="">Pas de rappel</option>
                <optgroup label="Minutes">
                    <option value="15m">15 minutes avant</option>
                    <option value="30m">30 minutes avant</option>
                    <option value="45m">45 minutes avant</option>
                </optgroup>
                <optgroup label="Heures">
                    <option value="1h">1 heure avant</option>
                    <option value="2h">2 heures avant</option>
                    <option value="4h">4 heures avant</option>
                    <option value="6h">6 heures avant</option>
                    <option value="8h">8 heures avant</option>
                    <option value="12h">12 heures avant</option>
                </optgroup>
                <optgroup label="Jours">
                    <option value="1d">1 jour avant</option>
                    <option value="2d">2 jours avant</option>
                    <option value="3d">3 jours avant</option>
                    <option value="4d">4 jours avant</option>
                    <option value="5d">5 jours avant</option>
                    <option value="6d">6 jours avant</option>
                </optgroup>
                <optgroup label="Semaines">
                    <option value="1w">1 semaine avant</option>
                    <option value="2w">2 semaines avant</option>
                    <option value="3w">3 semaines avant</option>
                    <option value="4w">4 semaines avant</option>
                </optgroup>
            </select>
        `;

        const form = document.getElementById('appointmentForm');
        const submitButton = form.querySelector('button[type="submit"]');
        form.insertBefore(document.createRange().createContextualFragment(reminderField), submitButton);
    }

    // Fonction pour calculer la date de rappel
    function calculateReminderTime(appointmentDate, appointmentTime, reminderValue) {
        const dateTime = new Date(appointmentDate + 'T' + appointmentTime);
        const [value, unit] = [reminderValue.slice(0, -1), reminderValue.slice(-1)];

        switch (unit) {
            case 'm':
                dateTime.setMinutes(dateTime.getMinutes() - parseInt(value));
                break;
            case 'h':
                dateTime.setHours(dateTime.getHours() - parseInt(value));
                break;
            case 'd':
                dateTime.setDate(dateTime.getDate() - parseInt(value));
                break;
            case 'w':
                dateTime.setDate(dateTime.getDate() - (parseInt(value) * 7));
                break;
        }

        return dateTime;
    }

    // Fonction pour vérifier les rappels
    function checkReminders() {
        const now = new Date();
        appointments.forEach(appointment => {
            if (appointment.reminder && !appointment.reminderShown) {
                const reminderTime = new Date(appointment.reminderTime);
                if (now >= reminderTime) {
                    showNotification(appointment);
                    appointment.reminderShown = true;
                    saveAppointments();
                }
            }
        });
    }

    // Fonction pour afficher la notification
    function showNotification(appointment) {
        if ("Notification" in window) {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    const [year, month, day] = appointment.date.split('-');
                    const formattedDate = `${day}/${month}/${year}`;
                    new Notification("Rappel de rendez-vous", {
                        body: `${appointment.title} - ${formattedDate} ${appointment.time}`,
                        icon: "/path/to/icon.png" // Ajoutez le chemin vers une icône si vous en avez une
                    });
                }
            });
        }
    }

    // Fonction pour générer les occurrences répétées
    function generateRepeatedAppointments(baseAppointment) {
        const repeatedAppointments = [];
        const startDate = new Date(baseAppointment.date);
        const endDate = new Date(baseAppointment.repeatEnd);

        let currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            // Créer une copie du rendez-vous de base
            const appointment = {
                ...baseAppointment,
                date: currentDate.toISOString().split('T')[0],
                isRepeated: true,
                originalDate: baseAppointment.date
            };

            repeatedAppointments.push(appointment);

            // Calculer la prochaine date selon le type de répétition
            switch (baseAppointment.repeat) {
                case 'daily':
                    currentDate.setDate(currentDate.getDate() + 1);
                    break;
                case 'weekly':
                    currentDate.setDate(currentDate.getDate() + 7);
                    break;
                case 'biweekly':
                    currentDate.setDate(currentDate.getDate() + 14);
                    break;
                case 'monthly':
                    const currentDay = currentDate.getDate();
                    currentDate.setMonth(currentDate.getMonth() + 1);
                    // Gérer le cas des fins de mois
                    if (currentDate.getDate() !== currentDay) {
                        currentDate.setDate(0); // Dernier jour du mois précédent
                    }
                    break;
                case 'yearly':
                    currentDate.setFullYear(currentDate.getFullYear() + 1);
                    break;
            }
            currentDate = new Date(currentDate); // Créer une nouvelle instance de date
        }

        return repeatedAppointments;
    }

    // Modifier le gestionnaire du formulaire
    appointmentForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const title = document.getElementById('title').value;
        const date = document.getElementById('date').value;
        const time = document.getElementById('time').value;
        const category = document.getElementById('category').value;
        const reminder = document.getElementById('reminder').value;
        const repeat = document.getElementById('repeat').value;
        const repeatEnd = document.getElementById('repeatEnd').value;

        // Vérifier que la date de fin est postérieure à la date de début
        if (repeat && repeatEnd && new Date(repeatEnd) < new Date(date)) {
            alert('La date de fin de répétition doit être postérieure à la date de début');
            return;
        }

        const newAppointment = {
            title,
            date,
            time,
            category,
            reminder,
            repeat,
            repeatEnd,
            reminderShown: false
        };

        if (reminder) {
            newAppointment.reminderTime = calculateReminderTime(date, time, reminder).toISOString();
        }

        // Récupérer les rendez-vous existants
        appointments = JSON.parse(localStorage.getItem('appointments')) || [];

        // Gérer les répétitions
        if (repeat && repeatEnd) {
            const repeatedAppointments = generateRepeatedAppointments(newAppointment);
            appointments = appointments.concat(repeatedAppointments);
        } else {
            appointments.push(newAppointment);
        }

        // Sauvegarder et recharger
        saveAppointments();
        loadAppointments();

        // Réinitialiser le formulaire et fermer le modal
        appointmentForm.reset();
        appointmentModal.style.display = 'none';
    });

    // Ajouter l'écouteur d'événements pour afficher/masquer la date de fin de répétition
    document.getElementById('repeat').addEventListener('change', (e) => {
        const repeatEndContainer = document.getElementById('repeatEndContainer');
        if (e.target.value) {
            repeatEndContainer.style.display = 'block';
            document.getElementById('repeatEnd').required = true;
        } else {
            repeatEndContainer.style.display = 'none';
            document.getElementById('repeatEnd').required = false;
        }
    });

    // Modifier la fonction de suppression pour gérer les rendez-vous répétés
    function deleteAppointment(index) {
        const appointment = appointments[index];

        if (appointment.isRepeated) {
            if (confirm('Voulez-vous supprimer toutes les occurrences de ce rendez-vous répété ?')) {
                // Supprimer toutes les occurrences
                appointments = appointments.filter(app =>
                    !(app.isRepeated && app.originalDate === appointment.originalDate)
                );
            } else {
                // Supprimer uniquement cette occurrence
                appointments.splice(index, 1);
            }
        } else {
            appointments.splice(index, 1);
        }

        saveAppointments();
        loadAppointments();
    }

    // Ajouter des gestionnaires pour ouvrir le modal avec la date pré-remplie
    function setupDateClickHandlers() {
        // Pour la vue jour
        document.querySelectorAll('.appointment-slot').forEach(slot => {
            slot.addEventListener('click', () => {
                const dateStr = currentDate.toISOString().split('T')[0];
                document.getElementById('date').value = dateStr;
                document.getElementById('time').value = `${slot.dataset.hour}:00`;
                appointmentModal.style.display = 'block';
            });
        });

        // Pour la vue mois
        document.querySelectorAll('.month-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                const cellDate = new Date(cell.dataset.date);
                const dateStr = cellDate.toISOString().split('T')[0];
                document.getElementById('date').value = dateStr;
                appointmentModal.style.display = 'block';
            });
        });
    }

    // Gestionnaires pour les changements de vue
    document.getElementById('dayViewBtn').addEventListener('click', () => {
        appointments = JSON.parse(localStorage.getItem('appointments')) || []; // Recharger les rendez-vous depuis le localStorage
        renderDayView(currentDate);
        loadAppointments(); // Ajout de loadAppointments après le rendu
    });

    document.getElementById('weekViewBtn').addEventListener('click', () => {
        appointments = JSON.parse(localStorage.getItem('appointments')) || []; // Recharger les rendez-vous depuis le localStorage
        renderWeekView(currentDate);
        loadAppointments(); // Ajout de loadAppointments après le rendu
    });

    document.getElementById('monthViewBtn').addEventListener('click', () => {
        appointments = JSON.parse(localStorage.getItem('appointments')) || []; // Recharger les rendez-vous depuis le localStorage
        renderMonthView(currentDate);
        loadAppointments(); // Ajout de loadAppointments après le rendu
    });

    // Initialisation
    addReminderField();
    appointments = JSON.parse(localStorage.getItem('appointments')) || [];
    renderDayView(currentDate);
    loadAppointments();
    setupDateClickHandlers();

    // Vérifier les rappels toutes les minutes
    setInterval(checkReminders, 60000);

    // Gestionnaires pour la fermeture du modal
    const closeAppointmentModal = document.querySelector('#appointmentModal .close');

    // Fermeture avec le X
    closeAppointmentModal.addEventListener('click', () => {
        appointmentModal.style.display = 'none';
        document.getElementById('appointmentForm').reset(); // Reset le formulaire à la fermeture
    });

    // Fermeture en cliquant en dehors du modal
    window.addEventListener('click', (event) => {
        if (event.target === appointmentModal) {
            appointmentModal.style.display = 'none';
            document.getElementById('appointmentForm').reset(); // Reset le formulaire à la fermeture
        }
    });

    // Empêcher la fermeture quand on clique dans le modal
    appointmentModal.querySelector('.modal-content').addEventListener('click', (event) => {
        event.stopPropagation();
    });
});

