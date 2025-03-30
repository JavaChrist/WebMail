"use client";
import MyCalendar from "@/components/Calendar";

export default function CalendarPage() {
  return (
    <div className="min-h-screen h-full flex flex-col">
      <div className="flex-1 p-2 sm:p-6 overflow-x-auto">
        <div className="min-w-[800px] sm:min-w-full h-full">
          <MyCalendar />
        </div>
      </div>
    </div>
  );
}
