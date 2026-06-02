export type FolderType =
  | "inbox"
  | "drafts"
  | "sent"
  | "archive"
  | "spam"
  | "trash"
  | "custom";

export interface MailAddress {
  email: string;
  name?: string;
}

export interface MailAttachment {
  filename: string;
  contentType?: string;
  size?: number;
  url?: string;
  /** Index de la pièce jointe dans le message (identifiant stable pour la récupération IMAP). */
  index?: number;
}

export interface SignatureSocial {
  /** github | linkedin | twitter | facebook | instagram | website | custom */
  type: string;
  url: string;
  /** Icône personnalisée (image) ; sinon un badge texte est rendu. */
  iconUrl?: string;
}

export interface SignatureData {
  imageUrl?: string;
  name?: string;
  titles?: string[];
  address?: string;
  phone?: string;
  website?: { label?: string; url?: string };
  socials?: SignatureSocial[];
  accentColor?: string;
}

export interface MailAccount {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  signature?: string;
  /** Données structurées de la signature (pour ré-édition via le constructeur). */
  signatureData?: SignatureData | null;
  password: string;
  imapServer: string;
  imapPort: number;
  imapSecure: boolean;
  smtpServer: string;
  smtpPort: number;
  smtpSecure: boolean;
  color?: string;
  icon?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt?: Date | null;
  quotaUsedMb?: number | null;
  quotaTotalMb?: number | null;
  quotaCheckedAt?: Date | null;
  /** Adresses expéditrices bloquées (futurs e-mails dirigés vers le spam). */
  blockedSenders?: string[];
}

export interface MailFolder {
  id: string;
  userId: string;
  accountId: string;
  parentFolderId: string | null;
  name: string;
  folderType: FolderType;
  systemFolder: boolean;
  sortOrder: number;
  imapPath?: string;
  unreadCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MailMessage {
  id: string;
  userId: string;
  accountId: string;
  folderIds: string[];
  primaryFolderId: string;
  messageId: string;
  imapUid?: number;
  from: MailAddress;
  to: MailAddress[];
  cc?: MailAddress[];
  bcc?: MailAddress[];
  subject: string;
  snippet?: string;
  contentHtml?: string;
  contentText?: string;
  timestamp: Date;
  read: boolean;
  starred: boolean;
  hasAttachments: boolean;
  attachments?: MailAttachment[];
  flags?: string[];
  /** Message en cours de rédaction stocké dans le dossier Brouillons. */
  isDraft?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MailFolderNode extends MailFolder {
  children: MailFolderNode[];
  depth: number;
}

export type CreateMailAccountInput = Omit<
  MailAccount,
  "id" | "createdAt" | "updatedAt" | "sortOrder" | "isActive" | "lastSyncAt"
> & {
  sortOrder?: number;
  isActive?: boolean;
};

export type UpdateMailAccountInput = Partial<
  Omit<MailAccount, "id" | "userId" | "createdAt" | "updatedAt">
>;

export interface CreateMailFolderInput {
  userId: string;
  accountId: string;
  name: string;
  parentFolderId?: string | null;
  folderType?: FolderType;
  systemFolder?: boolean;
  sortOrder?: number;
  imapPath?: string;
}

export interface UpdateMailFolderInput {
  name?: string;
  parentFolderId?: string | null;
  sortOrder?: number;
  unreadCount?: number;
}

export interface ComposeDraft {
  accountId: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  /** Id du document brouillon en cours d'édition (pour mise à jour/suppression). */
  draftMessageId?: string;
}

export interface SendMailPayload {
  userId: string;
  accountId: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  content: string;
}
