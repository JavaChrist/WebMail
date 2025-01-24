document.addEventListener('DOMContentLoaded', () => {
    const appointmentForm = document.getElementById('appointmentForm');
    const appointmentModal = document.getElementById('appointmentModal');
    const appointmentList = document.getElementById('appointmentList');
    const closeModal = document.querySelector('.close');
    const calendarView = document.getElementById('calendarView');
    let currentDate = new Date();

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
        document.querySelectorAll('.appointment-slot').forEach(slot => {
            slot.addEventListener('click', () => {
                appointmentModal.style.display = 'block';
            });
        });

        document.getElementById('prevDay').addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() - 1);
            renderDayView(currentDate);
        });

        document.getElementById('nextDay').addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() + 1);
            renderDayView(currentDate);
        });
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
        
        // En-tête des jours
        weekViewContent += '<div class="week-header">';
        const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
        days.forEach(day => {
            weekViewContent += `<div class="week-day">${day}</div>`;
        });
        weekViewContent += '</div>';
        
        // Grille des heures
        weekViewContent += '<div class="week-grid">';
        for (let hour = 0; hour < 24; hour++) {
            weekViewContent += `<div class="week-row">`;
            weekViewContent += `<div class="hour-label">${hour}:00</div>`;
            for (let day = 0; day < 7; day++) {
                weekViewContent += `<div class="week-cell" data-hour="${hour}" data-day="${day}"></div>`;
            }
            weekViewContent += '</div>';
        }
        weekViewContent += '</div></div>';
        
        calendarView.innerHTML = weekViewContent;

        // Gestionnaires d'événements pour la vue semaine
        document.querySelectorAll('.week-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                appointmentModal.style.display = 'block';
            });
        });

        document.getElementById('prevWeek').addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() - 7);
            renderWeekView(currentDate);
        });

        document.getElementById('nextWeek').addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() + 7);
            renderWeekView(currentDate);
        });
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
        
        // En-tête des jours
        monthViewContent += '<table class="month-view"><thead><tr>';
        ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].forEach(day => {
            monthViewContent += `<th>${day}</th>`;
        });
        monthViewContent += '</tr></thead><tbody>';
        
        // Ajuster le premier jour de la semaine (0 = Dimanche, 1 = Lundi)
        let firstDayOfWeek = firstDay.getDay();
        if (firstDayOfWeek === 0) firstDayOfWeek = 7;
        firstDayOfWeek--;
        
        let date_iter = new Date(firstDay);
        date_iter.setDate(1 - firstDayOfWeek);
        
        // Corps du calendrier
        for (let week = 0; week < 6; week++) {
            monthViewContent += '<tr>';
            for (let day = 0; day < 7; day++) {
                const isCurrentMonth = date_iter.getMonth() === date.getMonth();
                const isToday = date_iter.toDateString() === new Date().toDateString();
                const classes = [
                    'month-cell',
                    isCurrentMonth ? 'current-month' : 'other-month',
                    isToday ? 'today' : ''
                ].filter(Boolean).join(' ');
                
                monthViewContent += `<td class="${classes}" data-date="${date_iter.toISOString()}">${date_iter.getDate()}</td>`;
                date_iter.setDate(date_iter.getDate() + 1);
            }
            monthViewContent += '</tr>';
        }
        
        monthViewContent += '</tbody></table>';
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
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderMonthView(currentDate);
        });
    }

    // Gestionnaires pour les boutons de vue
    document.getElementById('dayViewBtn').addEventListener('click', () => {
        console.log('Vue jour cliquée');
        renderDayView(currentDate);
    });

    document.getElementById('weekViewBtn').addEventListener('click', () => {
        console.log('Vue semaine cliquée');
        renderWeekView(currentDate);
    });

    document.getElementById('monthViewBtn').addEventListener('click', () => {
        console.log('Vue mois cliquée');
        renderMonthView(currentDate);
    });

    // Initialisation par défaut
    renderDayView(currentDate);

    appointmentForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const title = document.getElementById('title').value;
        const date = document.getElementById('date').value;
        const time = document.getElementById('time').value;
        const category = document.getElementById('category').value;

        const [year, month, day] = date.split('-');
        const formattedDate = `${day}-${month}-${year}`;

        const [hour] = time.split(':');
        const targetSlot = document.querySelector(`.appointment-slot[data-hour="${hour}"]`);

        if (targetSlot) {
            targetSlot.textContent = `${title} (${time})`;
            targetSlot.style.backgroundColor = '#81B2B7';
            targetSlot.style.color = '#fff';

            const appointmentItem = document.createElement('li');
            appointmentItem.textContent = `${title} - ${formattedDate} ${time} (${category})`;
            appointmentList.appendChild(appointmentItem);
        }

        appointmentForm.reset();
        appointmentModal.style.display = 'none';
    });

    closeModal.addEventListener('click', () => {
        appointmentModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === appointmentModal) {
            appointmentModal.style.display = 'none';
        }
    });
});
