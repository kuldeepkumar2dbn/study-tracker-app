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
