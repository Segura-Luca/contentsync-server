export type PlatformKey = 'INSTAGRAM' | 'TIKTOK' | 'YOUTUBE';

export interface PlatformLimit {
  maxDurationSeconds: number;
  maxSizeMb: number;
  allowedMimeTypes: string[];
}

/** Ajustes no secretos editables desde la app por ADMIN_GENERAL. */
export interface RuntimeSettings {
  appName: string;
  registrationEnabled: boolean;
  requireClientApproval: boolean;
  defaultTimezone: string;
  otpTtlMinutes: number;
  otpMaxAttempts: number;
  otpResendCooldownSeconds: number;
  clientInviteTtlHours: number;
  publishMaxAttempts: number;
  publishRetryDelaySeconds: number;
  platformLimits: Record<PlatformKey, PlatformLimit>;
}

export const DEFAULT_SETTINGS: RuntimeSettings = {
  appName: 'ContentSync',
  registrationEnabled: true,
  requireClientApproval: true,
  defaultTimezone: 'America/Argentina/Buenos_Aires',
  otpTtlMinutes: 30,
  otpMaxAttempts: 5,
  otpResendCooldownSeconds: 60,
  clientInviteTtlHours: 168,
  publishMaxAttempts: 3,
  publishRetryDelaySeconds: 5,
  platformLimits: {
    INSTAGRAM: { maxDurationSeconds: 90, maxSizeMb: 1024, allowedMimeTypes: ['video/mp4', 'video/quicktime'] },
    TIKTOK: { maxDurationSeconds: 600, maxSizeMb: 500, allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'] },
    YOUTUBE: { maxDurationSeconds: 60, maxSizeMb: 2048, allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'] },
  },
};

export function cloneDefaultSettings(): RuntimeSettings {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}
