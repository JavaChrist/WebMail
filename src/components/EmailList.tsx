import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Email {
  id: string;
  messageId: string;
  from: string;
  to: string;
  subject: string;
  content: string;
  timestamp: Date;
  read: boolean;
  starred: boolean;
  folder: string;
  userId: string;
  selected: boolean;
}

interface EmailListProps {
  emails: Email[];
  onSelectionChange: (emailIds: string[], selected: boolean) => void;
}

export default function EmailList({
  emails,
  onSelectionChange,
}: EmailListProps) {
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  const handleSelectAll = (checked: boolean) => {
    const newSelected = new Set<string>();
    if (checked) {
      emails.forEach((email) => newSelected.add(email.id));
    }
    setSelectedEmails(newSelected);
    onSelectionChange(Array.from(newSelected), checked);
  };

  const handleSelectEmail = (emailId: string, checked: boolean) => {
    const newSelected = new Set(selectedEmails);
    if (checked) {
      newSelected.add(emailId);
    } else {
      newSelected.delete(emailId);
    }
    setSelectedEmails(newSelected);
    onSelectionChange([emailId], checked);
  };

  return (
    <div className="w-full">
      <div className="flex items-center p-4 border-b">
        <input
          type="checkbox"
          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          checked={selectedEmails.size === emails.length}
          onChange={(e) => handleSelectAll(e.target.checked)}
        />
        <span className="ml-2 text-sm text-gray-600">
          {selectedEmails.size} sélectionné(s)
        </span>
      </div>

      <div className="divide-y">
        {emails.map((email) => (
          <div
            key={email.id}
            className={`flex items-center p-4 hover:bg-gray-50 ${
              email.read ? "bg-white" : "bg-blue-50"
            }`}
          >
            <input
              type="checkbox"
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              checked={selectedEmails.has(email.id)}
              onChange={(e) => handleSelectEmail(email.id, e.target.checked)}
            />

            <div className="ml-4 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="font-medium text-gray-900">
                    {email.from}
                  </span>
                  {!email.read && (
                    <span className="ml-2 px-2 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded-full">
                      Nouveau
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-500">
                  {format(new Date(email.timestamp), "PPp", { locale: fr })}
                </span>
              </div>
              <div className="mt-1">
                <span className="text-sm font-medium text-gray-900">
                  {email.subject}
                </span>
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                  {email.content.replace(/<[^>]*>/g, "")}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
