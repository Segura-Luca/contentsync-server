/** Constantes y funciones de formato que comparten las pantallas. */
import { ContentType, ProductionStatus, ReviewStatus } from '../api/types';

/** Tipos de contenido de un bloque y su nombre visible. */
export const CONTENT_TYPES: { code: ContentType; label: string }[] = [
  { code: 'REEL', label: 'Reel' },
  { code: 'CAROUSEL', label: 'Carrusel' },
  { code: 'STORY', label: 'Historia' },
  { code: 'POST', label: 'Publicación' },
  { code: 'VIDEO', label: 'Video' },
  { code: 'OTHER', label: 'Otro' },
];

/** Etapas de producción de un bloque y su nombre visible. */
export const PRODUCTION_STATUSES: { code: ProductionStatus; label: string }[] = [
  { code: 'PENDING', label: 'Pendiente' },
  { code: 'RECORDED', label: 'Grabado' },
  { code: 'EDITED', label: 'Editado' },
  { code: 'UPLOADED', label: 'Subido' },
];

/** Días de la semana: las columnas del cronograma. */
export const WEEKDAYS = [
  { num: 1, code: 'LUN', full: 'Lunes' },
  { num: 2, code: 'MAR', full: 'Martes' },
  { num: 3, code: 'MIÉ', full: 'Miércoles' },
  { num: 4, code: 'JUE', full: 'Jueves' },
  { num: 5, code: 'VIE', full: 'Viernes' },
  { num: 6, code: 'SÁB', full: 'Sábado' },
  { num: 7, code: 'DOM', full: 'Domingo' },
];

/** Cada bloque admite hasta esta cantidad de fotos y videos. */
export const MAX_MEDIA_PER_BLOCK = 20;

/** Colores que se proponen al crear una sección. Dos secciones no pueden compartirlo. */
export const SECTION_PALETTE = ['#38BDF8', '#F97316', '#A855F7', '#22C55E', '#EC4899', '#EAB308', '#14B8A6', '#EF4444', '#6366F1', '#84CC16'];

/** Contraseña segura: de 8 a 64 caracteres, con mayúscula, minúscula, número y símbolo. */
export const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,64}$/;

/** Correo con formato válido. */
export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Nombre visible de un estado de producción. */
export function productionLabel(code?: string | null) {
  return PRODUCTION_STATUSES.find((p) => p.code === code)?.label || 'Pendiente';
}

/** Nombre visible de un tipo de contenido. */
export function contentTypeLabel(code?: string | null) {
  return CONTENT_TYPES.find((t) => t.code === code)?.label || 'Contenido';
}

/** Texto y tono de la etiqueta según el estado de revisión. */
export function workflowMeta(status: ReviewStatus | string): { label: string; tone: 'live' | 'warn' | 'fault' | 'review' } {
  switch (status) {
    case 'APPROVED':
      return { label: 'APROBADO', tone: 'live' };
    case 'CHANGES_REQUESTED':
      return { label: 'CAMBIOS PEDIDOS', tone: 'warn' };
    case 'REJECTED':
      return { label: 'RECHAZADO', tone: 'fault' };
    default:
      return { label: 'EN REVISIÓN', tone: 'review' };
  }
}

/** Devuelve el lunes de la semana de una fecha, en formato AAAA-MM-DD. */
export function getMondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Suma días a una fecha AAAA-MM-DD. */
export function addDaysIso(iso: string, days: number): string {
  const base = new Date(iso.slice(0, 10) + 'T12:00:00Z');
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Formatea una fecha corta, como "05 Oct". */
export function fmtShortDate(iso: string | null | undefined, plusDays = 0): string {
  if (!iso) return '';
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + plusDays);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}`;
}

/** Formatea fecha y hora, como "05 Oct, 18:30". */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Completa con https:// los enlaces escritos sin protocolo: el servidor solo acepta http o https. */
export function normalizeUrl(url: string): string {
  const value = url.trim();
  return !value || /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

/** Une palabras en singular o plural: "1 foto", "3 fotos". */
export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}
