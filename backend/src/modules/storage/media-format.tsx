/** Reconoce el formato real de fotos y videos a partir de su contenido. */
import { MediaKind } from '@prisma/client';
import * as fs from 'fs';

/** Formato detectado: extensión, tipo MIME y si es imagen o video. */
export interface MediaFormat {
  extension: string;
  mimeType: string;
  kind: MediaKind;
}

// Formatos admitidos, indexados por extensión.
const FORMATS: Record<string, MediaFormat> = {
  '.jpg': { extension: '.jpg', mimeType: 'image/jpeg', kind: MediaKind.IMAGE },
  '.png': { extension: '.png', mimeType: 'image/png', kind: MediaKind.IMAGE },
  '.webp': { extension: '.webp', mimeType: 'image/webp', kind: MediaKind.IMAGE },
  '.gif': { extension: '.gif', mimeType: 'image/gif', kind: MediaKind.IMAGE },
  '.mp4': { extension: '.mp4', mimeType: 'video/mp4', kind: MediaKind.VIDEO },
  '.mov': { extension: '.mov', mimeType: 'video/quicktime', kind: MediaKind.VIDEO },
  '.webm': { extension: '.webm', mimeType: 'video/webm', kind: MediaKind.VIDEO },
};

/** Fotos de iPhone y similares: comparten contenedor con MP4, pero los navegadores no las muestran. */
const UNSUPPORTED_ISO_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'avif', 'avis'];

/**
 * Identifica el archivo por sus primeros bytes: el nombre y el tipo MIME los elige quien lo sube.
 * Devuelve null si no es una foto o un video que el navegador pueda mostrar.
 */
export function detectMediaFormat(path: string): MediaFormat | null {
  const header = Buffer.alloc(12);
  const descriptor = fs.openSync(path, 'r');
  try {
    fs.readSync(descriptor, header, 0, 12, 0);
  } finally {
    fs.closeSync(descriptor);
  }

  // Compara con la "firma" inicial de cada formato: JPG, PNG, WEBP, GIF y WebM.
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return FORMATS['.jpg'];
  if (header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return FORMATS['.png'];
  if (header.toString('latin1', 0, 4) === 'RIFF' && header.toString('latin1', 8, 12) === 'WEBP') return FORMATS['.webp'];
  if (['GIF87a', 'GIF89a'].includes(header.toString('latin1', 0, 6))) return FORMATS['.gif'];
  if (header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return FORMATS['.webm'];

  // MP4 y MOV comparten estructura: el tipo se distingue en los bytes 4 a 12.
  const atom = header.toString('latin1', 4, 8);
  if (atom === 'ftyp') {
    const brand = header.toString('latin1', 8, 12);
    if (UNSUPPORTED_ISO_BRANDS.includes(brand)) return null;
    return brand.startsWith('qt') ? FORMATS['.mov'] : FORMATS['.mp4'];
  }
  if (['moov', 'mdat', 'wide', 'free'].includes(atom)) return FORMATS['.mov'];
  return null;
}

/** El servidor generó la extensión al guardar el archivo: es confiable, a diferencia de lo que declare el navegador. */
export function mediaFormatFromKey(storageKey: string): MediaFormat | null {
  const match = /\.[a-z0-9]+$/i.exec(storageKey);
  return (match && FORMATS[match[0].toLowerCase()]) || null;
}
