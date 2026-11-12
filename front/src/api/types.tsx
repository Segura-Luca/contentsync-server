/** Tipos de los datos que envía la API. Reflejan las respuestas del backend en NestJS. */

export type Role = 'ADMIN_GENERAL' | 'AGENCIA' | 'CLIENTE';
export type ReviewStatus = 'IN_REVIEW' | 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED';
export type ProductionStatus = 'PENDING' | 'RECORDED' | 'EDITED' | 'UPLOADED';
export type ContentType = 'REEL' | 'CAROUSEL' | 'STORY' | 'POST' | 'VIDEO' | 'OTHER';
export type MediaKind = 'IMAGE' | 'VIDEO';

/** Usuario con la sesión abierta. */
export interface Session {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  agencyId: string | null;
  agencyName: string;
  needsProfileSetup: boolean;
  clientId: string | null;
}

/** Respuesta del servidor al abrir una sesión. */
export interface AuthResponse {
  accessToken: string;
  user: Partial<Session> & { id: string; email: string; role: Role };
}

/** Cliente (marca) de una agencia, ya adaptado para la interfaz. */
export interface Client {
  id: string;
  agencyId: string;
  agencyName: string;
  companyName: string;
  industry: string;
  confirmationStatus: string;
  confirmedAt?: string | null;
  contactFullName: string;
  contactEmail: string;
}

/** Foto o video de un bloque. */
export interface Media {
  storageKey: string;
  url?: string;
  kind: MediaKind;
  description?: string;
  sizeBytes?: number | string;
  originalName?: string;
}

/** Comentario dentro de un bloque. */
export interface BlockComment {
  id: string;
  message: string;
  createdAt: string;
  authorUser?: { fullName?: string } | null;
}

/** Bloque de contenido de un día. */
export interface Block {
  id: string;
  dayOfWeek: number;
  contentType: ContentType;
  blockTitle: string;
  noteColor?: string | null;
  notes?: string | null;
  caption?: string | null;
  plannedTime?: string | null;
  reviewStatus: ReviewStatus;
  productionStatus: ProductionStatus;
  media?: Media[];
  comments?: BlockComment[];
}

/** Semana de lunes a domingo de un cliente. */
export interface Schedule {
  id: string;
  clientId: string;
  title: string;
  status: string;
  weekStartDate: string;
  weekEndDate: string;
  summaryNotes?: string | null;
  confirmedAt?: string | null;
  confirmedByUser?: { fullName?: string } | null;
  items?: Block[];
}

/** Aviso interno. */
export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  referenceId?: string | null;
  createdAt: string;
}

/** Sección (etiqueta con color) del banco de ideas. */
export interface IdeaSection {
  id: string;
  name: string;
  color: string;
}

/** Idea guardada por la agencia. */
export interface Idea {
  id: string;
  sectionId: string;
  clientId?: string | null;
  title: string;
  content: string;
  referenceUrl?: string | null;
  isPinned?: boolean;
  section?: { name?: string; color?: string } | null;
  client?: { companyName?: string } | null;
}

/** Idea que un cliente le propone a su agencia. */
export interface IdeaProposal {
  id: string;
  clientId: string;
  title: string;
  content: string;
  referenceUrl?: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
  client?: { companyName?: string } | null;
}

/** Vinculación que el cliente todavía tiene que confirmar ("Sí, soy yo"). */
export interface PendingConfirmation {
  id: string;
  companyName: string;
  agency?: { name?: string } | null;
  user?: { email?: string } | null;
}

/** Ajustes de la plataforma que edita el administrador. */
export interface PlatformSettings {
  appName: string;
  registrationEnabled: boolean;
  otpTtlMinutes: number;
  otpMaxAttempts: number;
  otpResendCooldownSeconds: number;
  clientInviteTtlHours: number;
}

/** Estado de las integraciones del servidor (solo lectura). */
export interface PlatformIntegrations {
  database: string;
  publicUrl: string;
  storage: string;
  mail: { senderAddress?: string | null; n8n: boolean; httpsRelay: boolean; smtp: boolean };
  login: { google: boolean; facebook: boolean; github: boolean };
}

/** Configuración pública del servidor (/app-config.js). */
export interface PublicConfig {
  appName?: string;
  senderEmail?: string | null;
  registrationEnabled?: boolean;
  uploadMaxMb?: number;
}
