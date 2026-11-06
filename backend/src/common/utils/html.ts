/** Utilidad para insertar texto de usuarios en plantillas HTML sin riesgo de inyección de código. */
/** Caracteres con significado especial en HTML y su versión segura. */
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapa texto de usuario antes de interpolarlo en plantillas HTML de correo. */
export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}
