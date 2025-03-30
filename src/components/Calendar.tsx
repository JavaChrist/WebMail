"use client";
import { useState, useEffect } from "react";
import { Calendar, dateFnsLocalizer, Views, View } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Users, CheckSquare, Bell, User, FileText } from "lucide-react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "@/config/firebase";
import "../styles/calendar.css";
import EventModal from "./EventModal";
import { useTheme } from "@/context/ThemeContext";

// Types pour les événements avec priorité
interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  priority: "low" | "medium" | "high";
  category: "meeting" | "task" | "reminder" | "personal" | "other";
  description?: string;
  userId?: string;
}

// 📌 Couleurs des priorités
const priorityColors = {
  low: "#22c55e", // vert
  medium: "#eab308", // jaune
  high: "#ef4444", // rouge
};

// 📌 Icônes et labels des catégories
const categories = {
  meeting: { icon: Users, label: "Réunions" },
  task: { icon: CheckSquare, label: "Tâches" },
  reminder: { icon: Bell, label: "Rappels" },
  personal: { icon: User, label: "Personnel" },
  other: { icon: FileText, label: "Autre" },
} as const;

// 📌 Localisation française
const locales = { fr };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

// 📌 Traduction française complète
const messages = {
  today: "Aujourd'hui",
  previous: "Précédent",
  next: "Suivant",
  month: "Mois",
  week: "Semaine",
  day: "Jour",
  agenda: "Agenda",
  date: "Date",
  time: "Heure",
  event: "Événement",
  allDay: "Toute la journée",
  work_week: "Semaine de travail",
  yesterday: "Hier",
  tomorrow: "Demain",
  noEventsInRange: "Aucun événement dans cette période.",
  showMore: (total: number) => `+ ${total} événement(s) supplémentaire(s)`,
};

// 📌 Formats personnalisés
const formats = {
  timeGutterFormat: (date: Date) => format(date, "HH:mm", { locale: fr }),
  eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) => {
    const startDate = format(start, "EEEE dd MMMM", { locale: fr });
    const endDate = format(end, "EEEE dd MMMM", { locale: fr });
    const startTime = format(start, "HH:mm", { locale: fr });
    const endTime = format(end, "HH:mm", { locale: fr });

    // Si même jour, on n'affiche la date qu'une fois
    if (startDate === endDate) {
      return `${startDate}  |  ${startTime} - ${endTime}`;
    }
    // Sinon on affiche les deux dates
    return `${startDate}  |  ${startTime} - ${endDate}  |  ${endTime}`;
  },
  dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${format(start, "dd MMMM", { locale: fr })} - ${format(end, "dd MMMM", {
      locale: fr,
    })}`,
  dayHeaderFormat: (date: Date) => format(date, "cccc dd MMMM", { locale: fr }),
  dayFormat: (date: Date) => format(date, "cccc dd", { locale: fr }),
  weekdayFormat: (date: Date) => format(date, "EEE dd", { locale: fr }),
  monthHeaderFormat: (date: Date) => format(date, "MMMM yyyy", { locale: fr }),
  // Formats pour l'agenda
  agendaDateFormat: (date: Date) =>
    format(date, "eeee dd MMMM", { locale: fr }),
  agendaTimeFormat: (date: Date) => format(date, "HH:mm", { locale: fr }),
  agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) => {
    const startDate = format(start, "EEEE dd MMMM", { locale: fr });
    const endDate = format(end, "EEEE dd MMMM", { locale: fr });
    const startTime = format(start, "HH:mm", { locale: fr });
    const endTime = format(end, "HH:mm", { locale: fr });

    // Si même jour, on n'affiche la date qu'une fois
    if (startDate === endDate) {
      return `${startDate}  |  ${startTime} - ${endTime}`;
    }
    // Sinon on affiche les deux dates
    return `${startDate}  |  ${startTime} - ${endDate}  |  ${endTime}`;
  },
  // Format pour les en-têtes de section dans l'agenda
  agendaHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${format(start, "dd MMMM yyyy", { locale: fr })} - ${format(
      end,
      "dd MMMM yyyy",
      { locale: fr }
    )}`,
};

export default function MyCalendar() {
  const { isDarkMode } = useTheme();
  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(new Date());
  const [selectedCategories, setSelectedCategories] = useState<
    Set<keyof typeof categories>
  >(new Set(Object.keys(categories) as (keyof typeof categories)[]));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [selectedSlot, setSelectedSlot] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

  // Charger les événements depuis Firebase au montage du composant
  useEffect(() => {
    const loadEvents = async () => {
      if (!auth.currentUser) return;

      try {
        const eventsRef = collection(db, "events");
        const q = query(eventsRef, where("userId", "==", auth.currentUser.uid));
        const querySnapshot = await getDocs(q);

        // Si aucun événement n'existe, créons un événement de test
        if (querySnapshot.empty) {
          const testEvent = {
            title: "Réunion d'équipe",
            start: Timestamp.fromDate(new Date()),
            end: Timestamp.fromDate(new Date(Date.now() + 3600000)), // +1 heure
            priority: "medium",
            category: "meeting",
            userId: auth.currentUser.uid,
            description:
              "Première réunion d'équipe - Discussion des objectifs et planification des projets à venir.",
          };

          try {
            await addDoc(collection(db, "events"), testEvent);
            console.log("Événement de test créé avec succès");
          } catch (error) {
            console.error(
              "Erreur lors de la création de l'événement de test:",
              error
            );
          }
        }

        const loadedEvents = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            start: data.start.toDate(),
            end: data.end.toDate(),
          } as CalendarEvent;
        });

        setEvents(loadedEvents);
      } catch (error) {
        console.error("Erreur lors du chargement des événements:", error);
      }
    };

    loadEvents();
  }, []);

  const handleSelect = ({ start, end }: { start: Date; end: Date }) => {
    setSelectedEvent(null);
    setSelectedSlot({ start, end });
    setIsModalOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSelectedSlot(null);
    setIsModalOpen(true);
  };

  const handleSaveEvent = async (eventData: CalendarEvent) => {
    if (!auth.currentUser) return;

    try {
      const eventToSave = {
        ...eventData,
        userId: auth.currentUser.uid,
        start: Timestamp.fromDate(new Date(eventData.start)),
        end: Timestamp.fromDate(new Date(eventData.end)),
        description: eventData.description || "",
      };

      if (eventData.id) {
        // Modification d'un événement existant
        const eventRef = doc(db, "events", eventData.id);
        await updateDoc(eventRef, eventToSave);

        setEvents(
          events.map((event) =>
            event.id === eventData.id
              ? {
                  ...eventToSave,
                  id: eventData.id,
                  start: eventToSave.start.toDate(),
                  end: eventToSave.end.toDate(),
                }
              : event
          )
        );
      } else {
        // Ajout d'un nouvel événement
        const docRef = await addDoc(collection(db, "events"), eventToSave);
        const newEvent = {
          ...eventToSave,
          id: docRef.id,
          start: eventToSave.start.toDate(),
          end: eventToSave.end.toDate(),
        };

        setEvents((prevEvents) => [...prevEvents, newEvent]);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de l'événement:", error);
    }
  };

  const handleDeleteEvent = async (eventToDelete: CalendarEvent) => {
    if (!auth.currentUser) return;

    try {
      await deleteDoc(doc(db, "events", eventToDelete.id));
      setEvents(events.filter((event) => event.id !== eventToDelete.id));
    } catch (error) {
      console.error("Erreur lors de la suppression de l'événement:", error);
    }
  };

  // Fonction pour styliser les événements selon leur priorité
  const eventPropGetter = (event: CalendarEvent) => ({
    className: "event-item",
    style: {
      backgroundColor: priorityColors[event.priority],
      borderLeft: `6px solid ${priorityColors[event.priority]}`,
      borderRadius: "4px",
      color: "white",
      padding: "2px 4px",
      fontSize: "0.875rem",
      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
      transition: "all 0.2s ease-in-out",
      cursor: "pointer",
      zIndex: 1,
    },
  });

  // Composant personnalisé pour l'affichage des événements
  const components = {
    event: ({ event, title }: { event: CalendarEvent; title: string }) => {
      const Icon = categories[event.category].icon;
      return (
        <div className="flex items-center gap-1 h-full w-full pl-1 event-content">
          <Icon size={14} className="flex-shrink-0" />
          <span className="truncate">{title}</span>
        </div>
      );
    },
    // Ajout du composant pour l'agenda
    agenda: {
      event: ({ event }: { event: CalendarEvent }) => {
        const Icon = categories[event.category].icon;
        return (
          <div
            className="flex items-center gap-2 py-1 px-2 rounded event-item"
            style={{
              backgroundColor: priorityColors[event.priority],
              borderLeft: `6px solid ${priorityColors[event.priority]}`,
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
              transition: "all 0.2s ease-in-out",
              cursor: "pointer",
            }}
          >
            <Icon size={14} className="flex-shrink-0" />
            <span className="truncate">{event.title}</span>
          </div>
        );
      },
    },
  };

  // Filtrer les événements par catégorie
  const filteredEvents = events.filter((event) =>
    selectedCategories.has(event.category)
  );

  const toggleCategory = (category: keyof typeof categories) => {
    const newCategories = new Set(selectedCategories);
    if (newCategories.has(category)) {
      newCategories.delete(category);
    } else {
      newCategories.add(category);
    }
    setSelectedCategories(newCategories);
  };

  const handleViewChange = (newView: View) => {
    setView(newView);
    // Si on passe en vue agenda, on s'assure d'être sur la semaine en cours
    if (newView === Views.AGENDA) {
      setDate(new Date());
    }
  };

  return (
    <div className="h-full">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: "100%" }}
        view={view}
        onView={setView}
        date={date}
        onNavigate={setDate}
        messages={messages}
        formats={formats}
        selectable
        onSelectSlot={handleSelect}
        onSelectEvent={handleEventClick}
        eventPropGetter={eventPropGetter}
        components={{
          event: CustomEvent,
        }}
        className={`${isDarkMode ? "dark" : ""}`}
      />
      {isModalOpen && (
        <EventModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedEvent(null);
            setSelectedSlot(null);
          }}
          event={selectedEvent}
          slot={selectedSlot}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
        />
      )}
    </div>
  );
}
