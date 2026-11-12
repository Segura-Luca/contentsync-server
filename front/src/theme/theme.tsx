/** Colores de la app en tema oscuro y claro. Son los mismos que usa la web. */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeName = 'dark' | 'light';

/** Colores con nombre de las etiquetas antiguas. Las nuevas guardan un color hexadecimal. */
type NoteName = 'AMBER' | 'EMERALD' | 'SKY' | 'ROSE' | 'VIOLET' | 'LIME';

const dark = {
  canvas: '#0B0C0E',
  stage: '#111318',
  inspector: '#151820',
  elevated: '#1B1F29',
  hairline: '#232732',
  borderStrong: '#373E4E',
  textPrimary: '#F2F3F5',
  textSecondary: '#9DA4B3',
  textMuted: '#8C94A6',
  signal: '#D4F238',
  onSignal: '#0B0C0E',
  signalSubtleBg: '#20250F',
  signalSubtleFg: '#E0F85E',
  live: '#34D399',
  liveBg: '#0A291F',
  warn: '#FBBF24',
  warnBg: '#2B1D07',
  fault: '#F87171',
  faultBg: '#2D1114',
  scrim: 'rgba(5, 6, 8, 0.78)',
  notes: {
    AMBER: { fg: '#FBBF24', bg: 'rgba(251, 191, 36, 0.10)' },
    EMERALD: { fg: '#34D399', bg: 'rgba(52, 211, 153, 0.10)' },
    SKY: { fg: '#38BDF8', bg: 'rgba(56, 189, 248, 0.10)' },
    ROSE: { fg: '#FB7185', bg: 'rgba(251, 113, 133, 0.10)' },
    VIOLET: { fg: '#A78BFA', bg: 'rgba(167, 139, 250, 0.11)' },
    LIME: { fg: '#D4F238', bg: 'rgba(212, 242, 56, 0.10)' },
  } as Record<NoteName, { fg: string; bg: string }>,
};

const light: typeof dark = {
  canvas: '#F1F4FA',
  stage: '#FFFFFF',
  inspector: '#F6F8FD',
  elevated: '#E9EEF7',
  hairline: '#DDE3EF',
  borderStrong: '#B3BDD0',
  textPrimary: '#1C2436',
  textSecondary: '#46516A',
  textMuted: '#5F6A83',
  signal: '#4F46E5',
  onSignal: '#FFFFFF',
  signalSubtleBg: '#E9E8FE',
  signalSubtleFg: '#3730A3',
  live: '#047857',
  liveBg: '#D6F5E7',
  warn: '#A1560A',
  warnBg: '#FDF0D0',
  fault: '#B42318',
  faultBg: '#FDE6E3',
  scrim: 'rgba(28, 36, 54, 0.45)',
  notes: {
    AMBER: { fg: '#94480A', bg: '#FDF1D3' },
    EMERALD: { fg: '#047857', bg: '#DBF6EA' },
    SKY: { fg: '#0369A1', bg: '#DDF1FD' },
    ROSE: { fg: '#BE123C', bg: '#FFE6EA' },
    VIOLET: { fg: '#6D28D9', bg: '#EEE9FE' },
    LIME: { fg: '#4D7C0F', bg: '#EDF8D2' },
  },
};

export type Colors = typeof dark;

/** Tipografía monoespaciada para fechas, horas y etiquetas. */
export const monoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });

interface ThemeValue {
  name: ThemeName;
  colors: Colors;
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeValue>({ name: 'dark', colors: dark, setTheme: () => {} });
const STORAGE_KEY = 'cs_theme';

/** Guarda el tema elegido y lo recuerda la próxima vez que se abre la app. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState<ThemeName>('dark');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark') setName(saved);
      })
      .catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(
    () => ({
      name,
      colors: name === 'dark' ? dark : light,
      setTheme: (next) => {
        setName(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      },
    }),
    [name],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Devuelve el tema activo. */
export function useTheme() {
  return useContext(ThemeContext);
}

/** Indica si el color es hexadecimal (#RRGGBB). */
export function isHexColor(color: string | null | undefined): color is string {
  return /^#[0-9a-f]{6}$/i.test(color || '');
}

/** Aclara u oscurece un color lo justo para que el texto se lea sobre el fondo del tema. */
function readableColor(hex: string, theme: ThemeName): string {
  const background = theme === 'light' ? [255, 255, 255] : [27, 31, 41];
  const target = theme === 'light' ? 0 : 255;
  const luminance = (rgb: number[]) => {
    const [r, g, b] = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  let rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < 20 && contrast(rgb, background) < 4.5; i++) {
    rgb = rgb.map((v) => v + (target - v) * 0.12);
  }
  return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/** Colores de una etiqueta: texto (fg), fondo (bg) y punto (dot). */
export function noteColors(color: string | null | undefined, colors: Colors, theme: ThemeName) {
  if (isHexColor(color)) {
    return { fg: readableColor(color, theme), bg: color + '26', dot: color };
  }
  const named = colors.notes[(color || 'AMBER') as NoteName] || colors.notes.AMBER;
  return { ...named, dot: named.fg };
}
