/**
 * Security & Sanitization Utilities (security.js)
 *
 * Provides:
 * - HTML entity escaping for textContent safety
 * - Safe URL validation preventing javascript: or data: XSS vectors
 * - Card and item sanitization for tasks, routine slots, exams, and notes
 */

/**
 * Escapes HTML entities in a string to guarantee safe rendering
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates and sanitizes URLs before rendering inside <a href="...">
 * Blocks javascript:, data:, vbscript: and other malicious URI schemes.
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();

  // Allow standard relative paths
  if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('#')) {
    return trimmed;
  }

  // Allow only http, https, and mailto protocols
  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
      return trimmed;
    }
  } catch (e) {
    // If URL parsing fails, check regex for safety
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
  }

  // Disallowed protocol (e.g. javascript:, data:)
  return '#';
}

/**
 * Sanitizes routine slot items
 */
export function sanitizeRoutineSlot(slot) {
  if (!slot) return slot;
  return {
    ...slot,
    title: String(slot.title || '').trim(),
    timeRange: String(slot.timeRange || '').trim(),
    category: String(slot.category || 'Core Study').trim()
  };
}

/**
 * Sanitizes exam and assignment items
 */
export function sanitizeExam(exam) {
  if (!exam) return exam;
  return {
    ...exam,
    title: String(exam.title || '').trim(),
    subject: String(exam.subject || '').trim(),
    room: String(exam.room || '').trim(),
    notes: String(exam.notes || '').trim(),
    submissionLink: sanitizeUrl(exam.submissionLink)
  };
}

/**
 * Reads binary header bytes from a File/Blob using FileReader and Uint8Array
 * @param {Blob|File} file
 * @param {number} byteCount Number of initial bytes to inspect (default 8)
 * @returns {Promise<Uint8Array>}
 */
export function readBinaryHeader(file, byteCount = 8) {
  return new Promise((resolve, reject) => {
    if (!file || typeof file.slice !== 'function') {
      return reject(new Error('Invalid file provided for binary header inspection.'));
    }
    const slice = file.slice(0, byteCount);

    if (typeof FileReader !== 'undefined') {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.error) {
          reject(new Error(`Failed to read file header: ${reader.error.message}`));
        } else {
          resolve(new Uint8Array(reader.result));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file header.'));
      reader.readAsArrayBuffer(slice);
    } else if (typeof slice.arrayBuffer === 'function') {
      slice.arrayBuffer()
        .then(buffer => resolve(new Uint8Array(buffer)))
        .catch(err => reject(err));
    } else {
      reject(new Error('FileReader is not supported in this runtime environment.'));
    }
  });
}

/**
 * Validates binary magic-byte signatures for files uploaded to Drive Notes.
 * Enforces signatures for PDF (%PDF), PNG, JPG, and DOCX (PK\x03\x04).
 * Rejects files if binary headers do not match their declared extensions.
 * Disallows all SVG, HTML, and executable binary uploads.
 *
 * @param {File|Blob} file
 * @returns {Promise<boolean>} Resolves true if valid, throws Error if invalid
 */
export async function validateFileBinarySignature(file) {
  if (!file) {
    throw new Error('No file provided for inspection.');
  }

  const name = String(file.name || '').trim();
  const lowerName = name.toLowerCase();
  const mimeType = String(file.type || '').toLowerCase();

  // 1. Disallow all SVG, HTML, and script extensions
  const BLOCKED_EXTENSIONS = [
    '.svg', '.html', '.htm', '.xhtml', '.shtml',
    '.exe', '.bat', '.cmd', '.sh', '.js', '.mjs', '.cjs', '.vbs', '.ps1',
    '.com', '.scr', '.msi', '.jar', '.apk', '.bin', '.app', '.dmg', '.php',
    '.py', '.dll', '.so', '.dylib', '.cgi', '.pl'
  ];

  for (const ext of BLOCKED_EXTENSIONS) {
    if (lowerName.endsWith(ext)) {
      throw new Error(`Upload rejected: "${ext}" files are blocked for security.`);
    }
  }

  // 2. Disallow SVG and HTML MIME types
  if (
    mimeType === 'image/svg+xml' ||
    mimeType.includes('html') ||
    mimeType.includes('javascript') ||
    mimeType.includes('ecmascript') ||
    mimeType === 'application/x-msdownload' ||
    mimeType === 'application/x-executable'
  ) {
    throw new Error('Upload rejected: SVG, HTML, and executable MIME types are prohibited.');
  }

  // 3. Inspect binary magic bytes using FileReader and Uint8Array
  const header = await readBinaryHeader(file, 8);
  if (!header || header.length < 3) {
    throw new Error('Upload rejected: File is empty or could not be read.');
  }

  // Check for executable signatures in binary header
  // DOS MZ header (0x4D, 0x5A)
  if (header[0] === 0x4D && header[1] === 0x5A) {
    throw new Error('Upload rejected: DOS/PE executable binary header detected.');
  }
  // ELF header (0x7F, 'E', 'L', 'F' -> 0x7F, 0x45, 0x4C, 0x46)
  if (header[0] === 0x7F && header[1] === 0x45 && header[2] === 0x4C && header[3] === 0x46) {
    throw new Error('Upload rejected: ELF executable binary header detected.');
  }
  // Shell script shebang '#!' (0x23, 0x21)
  if (header[0] === 0x23 && header[1] === 0x21) {
    throw new Error('Upload rejected: Shell script signature detected.');
  }

  // 4. Validate signatures for declared extensions
  // PDF: %PDF (0x25, 0x50, 0x44, 0x46)
  if (lowerName.endsWith('.pdf')) {
    const isPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
    if (!isPdf) {
      throw new Error('Security Error: Declared .pdf file does not match PDF binary signature (%PDF). Upload rejected.');
    }
    return true;
  }

  // PNG: \x89PNG (0x89, 0x50, 0x4E, 0x47)
  if (lowerName.endsWith('.png')) {
    const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
    if (!isPng) {
      throw new Error('Security Error: Declared .png file does not match PNG binary signature. Upload rejected.');
    }
    return true;
  }

  // JPG / JPEG: FF D8 FF
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
    const isJpg = header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF;
    if (!isJpg) {
      throw new Error('Security Error: Declared JPG/JPEG file does not match JPEG binary signature. Upload rejected.');
    }
    return true;
  }

  // DOCX: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
  if (lowerName.endsWith('.docx')) {
    const isDocx = header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04;
    if (!isDocx) {
      throw new Error('Security Error: Declared .docx file does not match DOCX OpenXML signature (PK\\x03\\x04). Upload rejected.');
    }
    return true;
  }

  // TXT: plain text - ensure no hidden HTML/SVG tags
  if (lowerName.endsWith('.txt')) {
    const textHeader = new TextDecoder('utf-8', { fatal: false }).decode(header).toLowerCase();
    if (
      textHeader.includes('<html') || 
      textHeader.includes('<!doc') || 
      textHeader.includes('<svg') || 
      textHeader.includes('<?xml') ||
      textHeader.includes('<script')
    ) {
      throw new Error('Security Error: Text file contains disallowed HTML/SVG markup.');
    }
    return true;
  }

  throw new Error(`Security Error: Unsupported file format "${name}". Allowed formats: PDF, PNG, JPG, and DOCX.`);
}

/**
 * Safely extracts a query parameter from URL using strict string matching.
 * Returns textContent or matched value, never rendered as innerHTML.
 *
 * @param {string} paramName
 * @param {string[]|null} allowedValues Whitelist of allowed values
 * @returns {string|null}
 */
export function getSafeQueryParam(paramName, allowedValues = null) {
  if (typeof window === 'undefined' || !window.location || !paramName) return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get(paramName);
    if (value === null) return null;
    if (Array.isArray(allowedValues)) {
      return allowedValues.includes(value) ? value : null;
    }
    return escapeHtml(value);
  } catch {
    return null;
  }
}

/**
 * Safely extracts and validates location hash (e.g. #tabs).
 * Strips leading '#' and matches against whitelist or escapes.
 *
 * @param {string[]|null} allowedValues Whitelist of allowed hash values
 * @returns {string}
 */
export function getSafeHash(allowedValues = null) {
  if (typeof window === 'undefined' || !window.location) return '';
  try {
    const rawHash = (window.location.hash || '').replace(/^#/, '').trim();
    if (!rawHash) return '';
    if (Array.isArray(allowedValues)) {
      return allowedValues.includes(rawHash) ? rawHash : '';
    }
    return escapeHtml(rawHash);
  } catch {
    return '';
  }
}
