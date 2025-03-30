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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-white">
          {selectedEvent ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Titre
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded-md"
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
              className="w-full px-3 py-2 bg-gray-700 text-white rounded-md"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Date et heure de début
              </label>
              <input
                type="datetime-local"
                value={format(start, "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => setStart(new Date(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Date et heure de fin
              </label>
              <input
                type="datetime-local"
                value={format(end, "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => setEnd(new Date(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-md"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Catégorie</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(categories).map(
                ([key, { icon: Icon, label }]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key as typeof category)}
                    className={`p-3 rounded-lg flex items-center gap-2 transition-colors ${
                      category === key
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    <Icon size={20} />
                    <span>{label}</span>
                  </button>
                )
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Priorité</label>
            <div className="flex gap-2">
              {Object.entries(priorities).map(
                ([key, { icon: Icon, label, color }]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPriority(key as typeof priority)}
                    className={`flex-1 px-4 py-2 rounded-md flex items-center justify-center gap-2 transition-colors ${
                      priority === key ? color : "bg-gray-600"
                    }`}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </button>
                )
              )}
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <div>
              {selectedEvent && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Supprimer
                </button>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                {selectedEvent ? "Modifier" : "Enregistrer"}
              </button>
            </div>
          </div>
        </form>

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-medium mb-4">
                Confirmer la suppression
              </h3>
              <p>Êtes-vous sûr de vouloir supprimer cet événement ?</p>
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
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
