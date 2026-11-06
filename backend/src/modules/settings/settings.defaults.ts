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

export const DEFAULT_SETTINGS: RuntimeSettings = {
  appName: 'ContentSync',
  registrationEnabled: true,
  defaultTimezone: 'America/Argentina/Buenos_Aires',
  otpTtlMinutes: 30,
  otpMaxAttempts: 5,
  otpResendCooldownSeconds: 60,
  clientInviteTtlHours: 168,
};

export function cloneDefaultSettings(): RuntimeSettings {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}
