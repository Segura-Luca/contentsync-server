/** Valores de fábrica de los ajustes. Se usan mientras no haya un valor guardado en MySQL. */
/** Ajustes no secretos editables desde la app por ADMIN_GENERAL. */
export interface RuntimeSettings {
  appName: string;
  registrationEnabled: boolean;
  defaultTimezone: string;
  otpTtlMinutes: number;
  otpMaxAttempts: number;
  otpResendCooldownSeconds: number;
  clientInviteTtlHours: number;
}

/** Valores por defecto. Tiempos: otpTtlMinutes en minutos, cooldown en segundos e invitaciones en horas (168 = 7 días). */
export const DEFAULT_SETTINGS: RuntimeSettings = {
  appName: 'ContentSync',
  registrationEnabled: true,
  defaultTimezone: 'America/Argentina/Buenos_Aires',
  otpTtlMinutes: 30,
  otpMaxAttempts: 5,
  otpResendCooldownSeconds: 60,
  clientInviteTtlHours: 168,
};

/** Devuelve una copia, para que nadie modifique los valores de fábrica originales. */
export function cloneDefaultSettings(): RuntimeSettings {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}
