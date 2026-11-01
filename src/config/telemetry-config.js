/**
 * Telemetry & Feedback Configuration (src/config/telemetry-config.js)
 * StudyFlow Zero-Backend Client-Side Telemetry & Feedback Pipeline
 *
 * Implements:
 * 1. TELEMETRY_ENDPOINT: Destination Google Apps Script Web App URL
 * 2. Fallback helper: Ensures operations fail silently without breaking user experience if unconfigured
 */

export const TELEMETRY_URL = "https://script.google.com/macros/s/AKfycbwAlrIyhorIXumHyTSeNSlB5yBXH7AN16T5m-dHzt5YoOnrqL5o_lBXpDzgvN2X6Dml/exec";
export const TELEMETRY_ENDPOINT = TELEMETRY_URL;

if (typeof window !== 'undefined') {
  window.TELEMETRY_URL = TELEMETRY_URL;
  window.TELEMETRY_ENDPOINT = TELEMETRY_ENDPOINT;
}

/**
 * Checks whether the telemetry endpoint has been configured with a valid HTTP(S) URL.
 * Returns false if it is empty or still set to the placeholder string.
 * @param {string} endpoint URL to validate
 * @returns {boolean} True if endpoint is a valid URL
 */
export function isTelemetryConfigured(endpoint = TELEMETRY_URL) {
  if (!endpoint || typeof endpoint !== 'string') return false;
  const trimmed = endpoint.trim();
  if (!trimmed || trimmed === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL" || trimmed === "YOUR_EXEC_URL_HERE") {
    return false;
  }
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

/**
 * Safe fetch helper for background telemetry and feedback dispatches.
 * Fails silently without throwing errors or breaking the user experience.
 *
 * @param {Object} payload JSON data to send
 * @param {string} endpoint Telemetry URL (defaults to TELEMETRY_ENDPOINT)
 * @returns {Promise<{success: boolean, fallback?: boolean, error?: any}>}
 */
export async function safeSendTelemetry(payload, endpoint = TELEMETRY_ENDPOINT) {
  if (!isTelemetryConfigured(endpoint)) {
    // Fails silently without breaking user experience
    return { success: false, fallback: true, reason: 'unconfigured' };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return { success: true, response };
  } catch (err) {
    // Fail silently without breaking user experience
    console.warn('Telemetry request failed silently:', err);
    return { success: false, error: err };
  }
}

export default {
  TELEMETRY_ENDPOINT,
  isTelemetryConfigured,
  safeSendTelemetry
};

