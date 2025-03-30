"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Users,
  CheckSquare,
  Bell,
  User,
  FileText,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  X,
  Calendar,
} from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  priority: "low" | "medium" | "high";
  category: "meeting" | "task" | "reminder" | "personal" | "other";
  description?: string;
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
  selectedEvent?: CalendarEvent;
  selectedSlot?: { start: Date; end: Date };
}

const categories = {
  meeting: { icon: Users, label: "Réunion" },
  task: { icon: CheckSquare, label: "Tâche" },
  reminder: { icon: Bell, label: "Rappel" },
  personal: { icon: User, label: "Personnel" },
  other: { icon: FileText, label: "Autre" },
} as const;

const priorities = {
  low: { icon: CheckCircle, label: "Basse", color: "bg-green-600" },
  medium: { icon: AlertCircle, label: "Moyenne", color: "bg-yellow-600" },
  high: { icon: AlertTriangle, label: "Haute", color: "bg-red-600" },
} as const;

export default function EventModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  selectedEvent,
  selectedSlot,
}: EventModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [category, setCategory] = useState<
    "meeting" | "task" | "reminder" | "personal" | "other"
  >("meeting");
  const [start, setStart] = useState<Date>(new Date());
  const [end, setEnd] = useState<Date>(new Date());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (selectedEvent) {
      setTitle(selectedEvent.title);
      setDescription(selectedEvent.description || "");
      setPriority(selectedEvent.priority);
      setCategory(selectedEvent.category);
      setStart(new Date(selectedEvent.start));
      setEnd(new Date(selectedEvent.end));
    } else if (selectedSlot) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setCategory("meeting");
      setStart(new Date(selectedSlot.start));
      setEnd(new Date(selectedSlot.end));
    }
  }, [selectedEvent, selectedSlot]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const eventData: CalendarEvent = {
      id: selectedEvent?.id || "",
      title,
      description,
      start,
      end,
      priority,
      category,
    };
    onSave(eventData);
    onClose();
  };

  const handleDelete = () => {
    if (selectedEvent) {
      onDelete(selectedEvent);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 p-4 md:p-6 rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg md:text-xl font-bold text-white">
            {selectedEvent ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Titre
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Date et heure de début
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={format(start, "yyyy-MM-dd'T'HH:mm")}
                  onChange={(e) => setStart(new Date(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none opacity-0 absolute inset-0 cursor-pointer"
                  required
                />
                <div className="px-3 py-2 bg-gray-700 text-white rounded-md flex items-center justify-between">
                  <span>{format(start, "dd/MM HH:mm")}</span>
                  <Calendar size={18} className="text-gray-400" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Date et heure de fin
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={format(end, "yyyy-MM-dd'T'HH:mm")}
                  onChange={(e) => setEnd(new Date(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none opacity-0 absolute inset-0 cursor-pointer"
                  required
                />
                <div className="px-3 py-2 bg-gray-700 text-white rounded-md flex items-center justify-between">
                  <span>{format(end, "dd/MM HH:mm")}</span>
                  <Calendar size={18} className="text-gray-400" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Catégorie
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(categories).map(
                ([key, { icon: Icon, label }]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key as typeof category)}
                    className={`p-2 sm:p-3 rounded-lg flex items-center gap-2 transition-colors ${
                      category === key
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    <Icon size={18} className="sm:w-5 sm:h-5" />
                    <span className="text-sm sm:text-base">{label}</span>
                  </button>
                )
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Priorité
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(priorities).map(
                ([key, { icon: Icon, label, color }]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPriority(key as typeof priority)}
                    className={`flex-1 p-2 sm:p-3 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                      priority === key
                        ? `${color} hover:opacity-90`
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    <Icon size={18} className="sm:w-5 sm:h-5" />
                    <span className="text-sm sm:text-base">{label}</span>
                  </button>
                )
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-end mt-6">
            {selectedEvent && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Supprimer
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {selectedEvent ? "Mettre à jour" : "Créer"}
            </button>
          </div>
        </form>

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 p-4 md:p-6 rounded-lg w-full max-w-md">
              <h3 className="text-lg md:text-xl font-bold text-white mb-4">
                Confirmer la suppression
              </h3>
              <p className="text-gray-300 mb-6">
                Êtes-vous sûr de vouloir supprimer cet événement ?
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
