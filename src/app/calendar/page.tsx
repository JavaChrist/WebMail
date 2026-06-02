"use client";
import MyCalendar from "@/components/Calendar";

export default function CalendarPage() {
  return (
    // Hauteur définie (sous AppTopBar h-14) pour que la grille Mois ne s'effondre pas.
    <div className="h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] flex flex-col">
      <div className="flex-1 min-h-0 p-2 sm:p-4 pb-safe overflow-auto">
        {/* Mois/Agenda s'adaptent à la largeur ; Semaine/Jour défilent
            horizontalement (min-width géré dans calendar.css). */}
        <div className="h-full min-w-0">
          <MyCalendar />
        </div>
      </div>
    </div>
  );
}
