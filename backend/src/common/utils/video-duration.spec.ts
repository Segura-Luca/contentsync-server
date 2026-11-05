import { readVideoDurationSeconds } from './video-duration';

const atom = (type: string, body: Buffer) => {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(body.length + 8, 0);
  header.write(type, 4, 'latin1');
  return Buffer.concat([header, body]);
};
const mvhd = (timescale: number, duration: number) => {
  const body = Buffer.alloc(100);
  body.writeUInt32BE(timescale, 12);
  body.writeUInt32BE(duration, 16);
  return atom('mvhd', body);
};
const mvhd64 = (timescale: number, duration: number) => {
  const body = Buffer.alloc(112);
  body[0] = 1;
  body.writeUInt32BE(timescale, 20);
  body.writeBigUInt64BE(BigInt(duration), 24);
  return atom('mvhd', body);
};
const reader = (file: Buffer) => async (offset: number, length: number) => file.subarray(offset, offset + length);
const probe = (file: Buffer) => readVideoDurationSeconds(reader(file), file.length);
const ftyp = atom('ftyp', Buffer.from('isom0000'));

const ebml = (id: number[], body: Buffer) => {
  const size = Buffer.alloc(8);
  size.writeUInt32BE(body.length, 4);
  size[0] = 0x01;
  return Buffer.concat([Buffer.from(id), size, body]);
};
const EBML_HEADER = [0x1a, 0x45, 0xdf, 0xa3];
const SEGMENT = [0x18, 0x53, 0x80, 0x67];
const INFO = [0x15, 0x49, 0xa9, 0x66];
const TIMECODE_SCALE = ebml([0x2a, 0xd7, 0xb1], Buffer.from([0x0f, 0x42, 0x40]));

describe('readVideoDurationSeconds', () => {
  it('lee la duración con moov al principio y redondea hacia arriba', async () => {
    const file = Buffer.concat([ftyp, atom('moov', mvhd(1000, 120500)), atom('mdat', Buffer.alloc(32))]);
    await expect(probe(file)).resolves.toBe(121);
  });

  it('lee la duración con moov al final y tras otros átomos', async () => {
    const udta = atom('udta', Buffer.alloc(16));
    const file = Buffer.concat([ftyp, atom('mdat', Buffer.alloc(4096)), atom('moov', Buffer.concat([udta, mvhd(600, 18000)]))]);
    await expect(probe(file)).resolves.toBe(30);
  });

  it('admite mvhd de 64 bits', async () => {
    await expect(probe(Buffer.concat([ftyp, atom('moov', mvhd64(1000, 45000))]))).resolves.toBe(45);
  });

  it('devuelve null si no hay moov o el archivo está dañado', async () => {
    await expect(probe(Buffer.concat([ftyp, Buffer.alloc(64)]))).resolves.toBeNull();
    await expect(probe(Buffer.alloc(4))).resolves.toBeNull();
    await expect(probe(Buffer.concat([ftyp, atom('moov', mvhd(0, 100))]))).resolves.toBeNull();
  });

  it('lee la duración de un WebM', async () => {
    const duration = Buffer.alloc(8);
    duration.writeDoubleBE(61500);
    const info = ebml(INFO, Buffer.concat([TIMECODE_SCALE, ebml([0x44, 0x89], duration)]));
    const file = Buffer.concat([ebml(EBML_HEADER, Buffer.alloc(4)), ebml(SEGMENT, info)]);
    await expect(probe(file)).resolves.toBe(62);
  });

  it('devuelve null en un WebM sin duración declarada', async () => {
    const file = Buffer.concat([ebml(EBML_HEADER, Buffer.alloc(4)), ebml(SEGMENT, ebml(INFO, TIMECODE_SCALE))]);
    await expect(probe(file)).resolves.toBeNull();
  });
});
