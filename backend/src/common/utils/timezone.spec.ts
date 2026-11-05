import { formatWallClockTime, isValidTimeZone, wallClockToUtc } from './timezone';

describe('timezone', () => {
  it('convierte hora local a UTC en una zona sin cambio de horario', () => {
    const utc = wallClockToUtc(2026, 10, 9, 18, 0, 'America/Argentina/Buenos_Aires');
    expect(utc.toISOString()).toBe('2026-11-09T21:00:00.000Z');
  });

  it('contempla el horario de verano', () => {
    expect(wallClockToUtc(2026, 0, 15, 12, 0, 'America/New_York').toISOString()).toBe('2026-01-15T17:00:00.000Z');
    expect(wallClockToUtc(2026, 6, 15, 12, 0, 'America/New_York').toISOString()).toBe('2026-07-15T16:00:00.000Z');
  });

  it('muestra la hora en la zona pedida', () => {
    expect(formatWallClockTime(new Date('2026-11-09T21:00:00Z'), 'America/Argentina/Buenos_Aires')).toBe('18:00');
  });

  it('detecta zonas inválidas', () => {
    expect(isValidTimeZone('America/Argentina/Buenos_Aires')).toBe(true);
    expect(isValidTimeZone('Marte/Olimpo')).toBe(false);
  });
});
