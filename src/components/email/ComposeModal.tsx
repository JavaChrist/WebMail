"use client";

import { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import { X, Paperclip, Trash2 } from "lucide-react";
import { Dialog as HeadlessDialog } from "@headlessui/react";
import { useTheme } from "@/context/ThemeContext";
import { Editor } from "@tinymce/tinymce-react";
import * as Toast from "@radix-ui/react-toast";

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (email: {
    to: string;
    subject: string;
    content: string;
    attachments?: File[];
    accountId?: string;
  }) => Promise<void>;
  initialData?: {
    to: string;
    subject: string;
    content: string;
  } | null;
  accountId?: string;
}

interface Attachment {
  file: File;
  size: number;
}

export default function ComposeModal({
  isOpen,
  onClose,
  onSend,
  initialData,
  accountId,
}: ComposeModalProps) {
  const { isDarkMode } = useTheme();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("error");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [signature, setSignature] = useState("");
  const [signatureImage, setSignatureImage] = useState<File | null>(null);
  const [signatureImagePreview, setSignatureImagePreview] =
    useState<string>("");

  const defaultSignature = `
<table style="font-family: Arial, sans-serif; color: #333333; border-top: 1px solid #dddddd; padding-top: 10px; margin-top: 20px;">
  <tr>
    <td style="vertical-align: top; padding-right: 15px;">
      <img src="${window.location.origin}/Avatar.png" alt="Grohens Christian" style="width: 100px; height: auto; border-radius: 10px;">
    </td>
    <td style="vertical-align: top;">
      <div style="font-size: 16px; font-weight: bold; margin-bottom: 4px;">Grohens Christian</div>
      <div style="font-size: 14px; margin-bottom: 4px;">Développeur web <span style="color: #666666;">Freelance</span></div>
      <div style="font-size: 14px; color: #666666; margin-bottom: 4px;">Expert Technique</div>
      <div style="font-size: 14px; color: #666666; margin-bottom: 4px;">5, rue Maurice Fonvieille</div>
      <div style="font-size: 14px; color: #666666; margin-bottom: 8px;">31120 Portet sur Garonne</div>
      <div style="font-size: 14px; margin-bottom: 4px;">09 52 62 31 71</div>
      <div style="margin-bottom: 8px;"><a href="http://www.javachrist.fr" style="color: #0066cc; text-decoration: none;">www.javachrist.fr</a></div>
      <div style="display: flex; gap: 10px;">
        <a href="https://github.com/javachrist" style="text-decoration: none;"><img src="${window.location.origin}/github-icon.svg" alt="GitHub" style="width: 24px; height: 24px; filter: invert(20%);"></a>
        <a href="https://linkedin.com/in/christian-grohens" style="text-decoration: none;"><img src="${window.location.origin}/linkedin-icon.svg" alt="LinkedIn" style="width: 24px; height: 24px; filter: invert(20%);"></a>
        <a href="https://twitter.com/javachrist" style="text-decoration: none;"><img src="${window.location.origin}/twitter-icon.svg" alt="Twitter" style="width: 24px; height: 24px; filter: invert(20%);"></a>
      </div>
    </td>
  </tr>
</table>`;

  useEffect(() => {
    if (initialData) {
      setTo(initialData.to);
      setSubject(initialData.subject);
      setContent(initialData.content);
    } else {
      setTo("");
      setSubject("");
      setContent("");
    }
    setAttachments([]);
    setSignature("");
    setSignatureImage(null);
    setSignatureImagePreview("");
  }, [initialData]);

  const handleSignatureImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSignatureImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignatureImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSending(true);

    try {
      if (!accountId) {
        setToastMessage("Veuillez configurer un compte email");
        setToastType("error");
        setShowToast(true);
        return;
      }

      // Ajouter la signature au contenu
      const finalContent = `${content}\n\n${defaultSignature}`;

      await onSend({
        to,
        subject,
        content: finalContent,
        attachments,
        accountId,
      });

      setToastMessage("Email envoyé avec succès");
      setToastType("success");
      setShowToast(true);
      resetForm();
      setTimeout(onClose, 3000);
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'email:", error);
      setToastMessage(
        error instanceof Error
          ? error.message
          : "Erreur lors de l'envoi de l'email"
      );
      setToastType("error");
      setShowToast(true);
    } finally {
      setIsSending(false);
    }
  };

  const resetForm = () => {
    setTo("");
    setSubject("");
    setContent("");
    setAttachments([]);
    setSignature("");
    setSignatureImage(null);
    setSignatureImagePreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    const maxSize = 25 * 1024 * 1024; // 25 MB

    if (totalSize > maxSize) {
      setToastMessage(
        "La taille totale des pièces jointes ne doit pas dépasser 25 MB"
      );
      setToastType("error");
      setShowToast(true);
      return;
    }

    setAttachments([...attachments, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  return (
    <>
      <HeadlessDialog open={isOpen} onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <HeadlessDialog.Panel
            className={`w-full max-w-5xl ${
              isDarkMode ? "bg-gray-900" : "bg-white"
            } rounded-lg shadow-xl`}
          >
            <div
              className={`flex justify-between items-center p-4 border-b ${
                isDarkMode ? "border-gray-700" : "border-gray-200"
              }`}
            >
              <HeadlessDialog.Title
                className={`text-xl font-semibold ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                Nouveau message
              </HeadlessDialog.Title>
              <button
                onClick={onClose}
                className={`${
                  isDarkMode
                    ? "text-gray-400 hover:text-white"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4">
              <div className="space-y-4">
                <div>
                  <label
                    className={`block text-sm font-medium ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    } mb-1`}
                  >
                    À
                  </label>
                  <input
                    type="email"
                    value={to}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setTo(e.target.value)
                    }
                    className={`w-full ${
                      isDarkMode
                        ? "bg-gray-800 text-white border-gray-700"
                        : "bg-white text-gray-900 border-gray-300"
                    } border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    placeholder="destinataire@example.com"
                    required
                  />
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    } mb-1`}
                  >
                    Objet
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setSubject(e.target.value)
                    }
                    className={`w-full ${
                      isDarkMode
                        ? "bg-gray-800 text-white border-gray-700"
                        : "bg-white text-gray-900 border-gray-300"
                    } border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    placeholder="Objet du message"
                    required
                  />
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    } mb-1`}
                  >
                    Message
                  </label>
                  <Editor
                    apiKey="70b33lmeqg4gkor74cmflrnzyabu1cn9ft6mrs8dttbjvm3z"
                    value={content}
                    onEditorChange={(content: string) => setContent(content)}
                    init={{
                      height: 300,
                      menubar: true,
                      skin: isDarkMode ? "oxide-dark" : "oxide",
                      content_css: isDarkMode ? "dark" : "default",
                      plugins: [
                        "advlist",
                        "autolink",
                        "lists",
                        "link",
                        "image",
                        "charmap",
                        "preview",
                        "anchor",
                        "searchreplace",
                        "visualblocks",
                        "code",
                        "fullscreen",
                        "insertdatetime",
                        "media",
                        "table",
                        "help",
                        "wordcount",
                      ],
                      toolbar:
                        "undo redo | formatselect | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | help",
                      content_style:
                        "body { font-family:Helvetica,Arial,sans-serif; font-size:14px }",
                      promotion: false,
                      branding: false,
                      icons: "default",
                    }}
                  />
                </div>

                {/* Signature */}
                <div className="space-y-2">
                  <label
                    className={`block text-sm font-medium ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Signature
                  </label>
                  <textarea
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="Votre signature..."
                    className={`w-full p-2 rounded-lg ${
                      isDarkMode
                        ? "bg-gray-800 text-white"
                        : "bg-white text-gray-900"
                    } border ${
                      isDarkMode ? "border-gray-700" : "border-gray-300"
                    } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    rows={3}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSignatureImageChange}
                      className="hidden"
                      id="signature-image"
                    />
                    <label
                      htmlFor="signature-image"
                      className={`px-4 py-2 rounded-lg cursor-pointer ${
                        isDarkMode
                          ? "bg-gray-800 hover:bg-gray-700"
                          : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      Ajouter une image
                    </label>
                    {signatureImage && (
                      <button
                        type="button"
                        onClick={() => {
                          setSignatureImage(null);
                          setSignatureImagePreview("");
                        }}
                        className="text-red-500 hover:text-red-600"
                      >
                        Supprimer l'image
                      </button>
                    )}
                  </div>
                  {signatureImagePreview && (
                    <div className="mt-2">
                      <img
                        src={signatureImagePreview}
                        alt="Aperçu de la signature"
                        className="max-h-20 object-contain"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    } mb-1`}
                  >
                    Pièces jointes
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      multiple
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`px-3 py-2 ${
                        isDarkMode
                          ? "bg-blue-600 text-white"
                          : "bg-blue-500 text-white"
                      } rounded-lg hover:bg-${
                        isDarkMode ? "blue-700" : "blue-600"
                      } transition-colors flex items-center space-x-2`}
                    >
                      <Paperclip size={16} />
                      <span>Ajouter des pièces jointes</span>
                    </button>
                  </div>

                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {attachments.map((file: File, index: number) => (
                        <div
                          key={index}
                          className={`flex items-center justify-between ${
                            isDarkMode ? "bg-gray-800" : "bg-gray-200"
                          } p-2 rounded-lg`}
                        >
                          <span
                            className={`text-sm ${
                              isDarkMode ? "text-gray-300" : "text-gray-700"
                            } truncate`}
                          >
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className={`${
                              isDarkMode
                                ? "text-gray-400 hover:text-red-500"
                                : "text-gray-500 hover:text-red-500"
                            }`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className={`px-4 py-2 ${
                      isDarkMode
                        ? "text-gray-300 hover:text-white"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSending}
                    className={`px-4 py-2 ${
                      isDarkMode
                        ? "bg-blue-600 text-white"
                        : "bg-blue-500 text-white"
                    } rounded-lg hover:bg-${
                      isDarkMode ? "blue-700" : "blue-600"
                    } transition-colors disabled:opacity-50`}
                  >
                    {isSending ? "Envoi en cours..." : "Envoyer"}
                  </button>
                </div>
              </div>
            </form>
          </HeadlessDialog.Panel>
        </div>
      </HeadlessDialog>

      {showToast && (
        <Toast.Provider>
          <Toast.Root
            className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${
              toastType === "success" ? "bg-green-500" : "bg-red-500"
            } text-white`}
          >
            <Toast.Title className="font-medium">{toastMessage}</Toast.Title>
          </Toast.Root>
        </Toast.Provider>
      )}
    </>
  );
}
