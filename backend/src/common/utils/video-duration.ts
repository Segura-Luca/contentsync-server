/** Lee un tramo del archivo; devuelve menos bytes si llega al final. */
export type ByteReader = (offset: number, length: number) => Promise<Buffer>;

const MAX_ATOMS = 256;

/** Recorre los átomos de un MP4/MOV hasta `moov/mvhd`, que puede estar al principio o al final del archivo. */
async function readMp4Duration(read: ByteReader, fileSize: number): Promise<number | null> {
  let offset = 0;
  for (let i = 0; i < MAX_ATOMS && offset + 8 <= fileSize; i++) {
    const header = await read(offset, 16);
    if (header.length < 8) return null;
    let size = header.readUInt32BE(0);
    const type = header.toString('latin1', 4, 8);
    let headerSize = 8;
    if (size === 1) {
      if (header.length < 16) return null;
      size = Number(header.readBigUInt64BE(8));
      headerSize = 16;
    } else if (size === 0) {
      size = fileSize - offset;
    }
    if (size < headerSize) return null;

    if (type === 'moov') {
      const end = Math.min(offset + size, fileSize);
      let child = offset + headerSize;
      for (let j = 0; j < MAX_ATOMS && child + 8 <= end; j++) {
        const childHeader = await read(child, 8);
        if (childHeader.length < 8) return null;
        const childSize = childHeader.readUInt32BE(0);
        if (childHeader.toString('latin1', 4, 8) === 'mvhd') {
          const body = await read(child + 8, 32);
          if (body.length < 32) return null;
          const version = body[0];
          const timescale = version === 1 ? body.readUInt32BE(20) : body.readUInt32BE(12);
          const duration = version === 1 ? Number(body.readBigUInt64BE(24)) : body.readUInt32BE(16);
          return timescale > 0 ? duration / timescale : null;
        }
        if (childSize < 8) return null;
        child += childSize;
      }
      return null;
    }
    offset += size;
  }
  return null;
}

const EBML_SEGMENT = 0x18538067;
const EBML_INFO = 0x1549a966;
const EBML_TIMECODE_SCALE = 0x2ad7b1;
const EBML_DURATION = 0x4489;

function readEbmlId(buf: Buffer, pos: number): { value: number; length: number } | null {
  if (pos >= buf.length || buf[pos] === 0) return null;
  const length = Math.clz32(buf[pos]) - 23;
  if (length > 4 || pos + length > buf.length) return null;
  return { value: buf.readUIntBE(pos, length), length };
}

/** `value` es null cuando el tamaño es desconocido, como en las grabaciones en vivo. */
function readEbmlSize(buf: Buffer, pos: number): { value: number | null; length: number } | null {
  if (pos >= buf.length || buf[pos] === 0) return null;
  const length = Math.clz32(buf[pos]) - 23;
  if (pos + length > buf.length) return null;
  let value = buf[pos] & (0xff >> length);
  let allOnes = value === 0xff >> length;
  for (let i = 1; i < length; i++) {
    value = value * 256 + buf[pos + i];
    if (buf[pos + i] !== 0xff) allOnes = false;
  }
  return { value: allOnes ? null : value, length };
}

/** En WebM, `Segment/Info` va al principio. Las grabaciones de MediaRecorder pueden no declarar duración. */
async function readWebmDuration(read: ByteReader): Promise<number | null> {
  const buf = await read(0, 256 * 1024);
  let pos = 0;
  let end = buf.length;
  let scale = 1000000;
  let duration: number | null = null;
  while (pos < end) {
    const id = readEbmlId(buf, pos);
    if (!id) break;
    const size = readEbmlSize(buf, pos + id.length);
    if (!size) break;
    const data = pos + id.length + size.length;
    if (id.value === EBML_SEGMENT) {
      pos = data;
      continue;
    }
    if (id.value === EBML_INFO) {
      if (size.value !== null) end = Math.min(end, data + size.value);
      pos = data;
      continue;
    }
    if (size.value === null || data + size.value > buf.length) break;
    if (id.value === EBML_TIMECODE_SCALE) scale = buf.readUIntBE(data, size.value);
    if (id.value === EBML_DURATION) {
      duration = size.value === 8 ? buf.readDoubleBE(data) : size.value === 4 ? buf.readFloatBE(data) : null;
    }
    pos = data + size.value;
  }
  return duration !== null && duration > 0 ? (duration * scale) / 1e9 : null;
}

/** Duración real del contenedor, en segundos enteros hacia arriba. Devuelve null si no se puede determinar. */
export async function readVideoDurationSeconds(read: ByteReader, fileSize: number): Promise<number | null> {
  try {
    const head = await read(0, 8);
    if (head.length < 8) return null;
    const isWebm = head.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    const seconds = isWebm ? await readWebmDuration(read) : await readMp4Duration(read, fileSize);
    return seconds !== null && Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
  } catch {
    return null;
  }
}
