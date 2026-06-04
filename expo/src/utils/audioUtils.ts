const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = new Uint8Array(128);
for (let i = 0; i < B64_CHARS.length; i++) B64_LOOKUP[B64_CHARS.charCodeAt(i)] = i;

export function base64ToBytes(b64: string): Uint8Array {
  // Strip all non-base64 characters (newlines, spaces, padding)
  const cleanB64 = b64.replace(/[^A-Za-z0-9+/]/g, '');
  let len = cleanB64.length;

  const byteLen = (len * 3) >> 2;
  const bytes = new Uint8Array(byteLen);
  let p = 0;

  for (let i = 0; i < len; i += 4) {
    const codeA = cleanB64.charCodeAt(i);
    const codeB = i + 1 < len ? cleanB64.charCodeAt(i + 1) : 0;
    const codeC = i + 2 < len ? cleanB64.charCodeAt(i + 2) : 0;
    const codeD = i + 3 < len ? cleanB64.charCodeAt(i + 3) : 0;

    const a = codeA < 128 ? B64_LOOKUP[codeA] : 0;
    const b = codeB < 128 ? B64_LOOKUP[codeB] : 0;
    const c = codeC < 128 ? B64_LOOKUP[codeC] : 0;
    const d = codeD < 128 ? B64_LOOKUP[codeD] : 0;

    bytes[p++] = (a << 2) | (b >> 4);
    if (p < byteLen) bytes[p++] = ((b & 0x0F) << 4) | (c >> 2);
    if (p < byteLen) bytes[p++] = ((c & 0x03) << 6) | d;
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const len = bytes.length;
  const parts: string[] = [];
  const CHUNK = 24000; // must be multiple of 3

  for (let offset = 0; offset < len; offset += CHUNK) {
    let chunk = '';
    const end = Math.min(offset + CHUNK, len);
    for (let i = offset; i < end; i += 3) {
      const a = bytes[i];
      const b = i + 1 < len ? bytes[i + 1] : 0;
      const c = i + 2 < len ? bytes[i + 2] : 0;

      chunk += B64_CHARS[a >> 2];
      chunk += B64_CHARS[((a & 0x03) << 4) | (b >> 4)];
      chunk += (i + 1 < len) ? B64_CHARS[((b & 0x0F) << 2) | (c >> 6)] : '=';
      chunk += (i + 2 < len) ? B64_CHARS[c & 0x3F] : '=';
    }
    parts.push(chunk);
  }
  return parts.join('');
}

export function findAdtsSyncwordIndex(bytes: Uint8Array): number {
  const limit = Math.min(bytes.length - 1, 1000);
  for (let j = 0; j < limit; j++) {
    if (bytes[j] === 0xFF && (bytes[j+1] & 0xF0) === 0xF0) {
      return j;
    }
  }
  return -1;
}

// Reverses an ADTS AAC stream frame-by-frame
export function reverseAdtsBytes(bytes: Uint8Array): Uint8Array | null {
  const startIdx = findAdtsSyncwordIndex(bytes);
  if (startIdx === -1) return null;

  let i = startIdx;
  const frames: Uint8Array[] = [];
  while (i < bytes.length - 7) {
    if (bytes[i] === 0xFF && (bytes[i+1] & 0xF0) === 0xF0) {
      const byte3 = bytes[i + 3];
      const byte4 = bytes[i + 4];
      const byte5 = bytes[i + 5];
      const frameLength = ((byte3 & 0x03) << 11) | (byte4 << 3) | ((byte5 & 0xE0) >> 5);
      if (frameLength > 7 && i + frameLength <= bytes.length) {
        frames.push(bytes.slice(i, i + frameLength));
        i += frameLength;
      } else {
        i++; // Resync
      }
    } else {
      i++;
    }
  }

  if (frames.length > 0) {
    frames.reverse();
    let totalSize = 0;
    for (const f of frames) totalSize += f.length;
    const outputBytes = new Uint8Array(totalSize);
    let offset = 0;
    for (const f of frames) {
      outputBytes.set(f, offset);
      offset += f.length;
    }
    return outputBytes;
  }
  return null;
}
