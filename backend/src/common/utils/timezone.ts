/** Utilidad de zonas horarias. */
/** Indica si el nombre es una zona horaria real: Intl lanza un error si no la conoce. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}
