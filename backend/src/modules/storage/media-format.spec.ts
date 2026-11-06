/** Pruebas unitarias de la detección de formatos, incluidos archivos disfrazados y fotos HEIC. */
import { MediaKind } from '@prisma/client';
import * as fs from 'fs';
import * as os from 'os';
import { join } from 'path';
import { detectMediaFormat, mediaFormatFromKey } from './media-format';

describe('media-format', () => {
  const path = join(os.tmpdir(), `media-format-spec-${process.pid}.bin`);
  const detect = (bytes: Buffer) => {
    fs.writeFileSync(path, bytes);
    return detectMediaFormat(path);
  };
  const iso = (brand: string) => Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftyp' + brand), Buffer.alloc(16)]);

  afterAll(() => fs.rmSync(path, { force: true }));

  it.each([
    ['JPG', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]), '.jpg', MediaKind.IMAGE],
    ['PNG', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]), '.png', MediaKind.IMAGE],
    ['WEBP', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]), '.webp', MediaKind.IMAGE],
    ['GIF', Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(6)]), '.gif', MediaKind.IMAGE],
    ['WebM', Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(8)]), '.webm', MediaKind.VIDEO],
    ['MP4', iso('isom'), '.mp4', MediaKind.VIDEO],
    ['MOV', iso('qt  '), '.mov', MediaKind.VIDEO],
  ])('reconoce %s por su contenido', (_name, bytes, extension, kind) => {
    expect(detect(bytes as Buffer)).toMatchObject({ extension, kind });
  });

  it('rechaza un archivo disfrazado', () => {
    expect(detect(Buffer.from('<script>alert(1)</script>'))).toBeNull();
  });

  it('rechaza fotos HEIC, que comparten contenedor con MP4 pero el navegador no muestra', () => {
    expect(detect(iso('heic'))).toBeNull();
  });

  it('deduce el formato de la clave guardada', () => {
    expect(mediaFormatFromKey('clients/c1/123_abc.MP4')).toMatchObject({ kind: MediaKind.VIDEO, mimeType: 'video/mp4' });
    expect(mediaFormatFromKey('/uploads/videos/a.jpg')).toMatchObject({ kind: MediaKind.IMAGE });
    expect(mediaFormatFromKey('clients/c1/sin-extension')).toBeNull();
    expect(mediaFormatFromKey('clients/c1/a.exe')).toBeNull();
  });
});
