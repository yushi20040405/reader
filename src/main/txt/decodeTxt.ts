import iconv from 'iconv-lite'
import { detect } from 'jschardet'

export interface DecodedTxt {
  /** Decoded UTF-8 text. */
  text: string
  /** Encoding that was actually used (for diagnostics). */
  encoding: string
}

function hasBom(buffer: Buffer, bom: number[]): boolean {
  if (buffer.length < bom.length) return false
  for (let i = 0; i < bom.length; i++) {
    if (buffer[i] !== bom[i]) return false
  }
  return true
}

/**
 * Decode a raw TXT buffer into a UTF-8 string.
 *
 * Order of precedence:
 *   1. UTF-8 / UTF-16 byte-order marks (unambiguous).
 *   2. jschardet detection (GBK/GB18030, Big5, Shift-JIS, etc.).
 *   3. UTF-8 fallback when detection fails or the codec is unsupported.
 *
 * This runs in the main process so a 50MB file never blocks the renderer.
 */
export function decodeTxtBuffer(buffer: Buffer): DecodedTxt {
  if (buffer.length === 0) {
    return { text: '', encoding: 'UTF-8' }
  }

  if (hasBom(buffer, [0xef, 0xbb, 0xbf])) {
    return { text: buffer.toString('utf8', 3), encoding: 'UTF-8' }
  }
  if (hasBom(buffer, [0xff, 0xfe])) {
    return { text: iconv.decode(buffer.subarray(2), 'utf16-le'), encoding: 'UTF-16LE' }
  }
  if (hasBom(buffer, [0xfe, 0xff])) {
    return { text: iconv.decode(buffer.subarray(2), 'utf16-be'), encoding: 'UTF-16BE' }
  }

  const detected = detect(buffer)
  const encoding = detected?.encoding
  if (encoding && iconv.encodingExists(encoding)) {
    // ASCII is a subset of UTF-8; a file sampled as pure ASCII may still contain
    // multibyte UTF-8 later, so decode it as UTF-8 to avoid corruption.
    const effective = encoding.toLowerCase() === 'ascii' ? 'utf8' : encoding
    try {
      return { text: iconv.decode(buffer, effective), encoding: effective }
    } catch {
      // Fall through to the UTF-8 fallback below.
    }
  }

  return { text: buffer.toString('utf8'), encoding: 'UTF-8' }
}
