/** Prueba unitaria de la validación de zonas horarias. */
import { isValidTimeZone } from './timezone';

describe('timezone', () => {
  it('detecta zonas inválidas', () => {
    expect(isValidTimeZone('America/Argentina/Buenos_Aires')).toBe(true);
    expect(isValidTimeZone('Marte/Olimpo')).toBe(false);
  });
});
