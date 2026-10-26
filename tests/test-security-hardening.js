import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Setup Mock DOM Storage & Browser Environment for Node.js
class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
  get length() {
    return Object.keys(this.store).length;
  }
  key(i) {
    return Object.keys(this.store)[i] || null;
  }
}

// Mock FileReader for binary inspection in Node.js
class MockFileReader {
  constructor() {
    this.onloadend = null;
    this.onerror = null;
    this.result = null;
    this.error = null;
  }
  readAsArrayBuffer(blob) {
    setTimeout(async () => {
      try {
        if (blob && typeof blob.arrayBuffer === 'function') {
          this.result = await blob.arrayBuffer();
        } else if (blob && blob.buffer) {
          this.result = blob.buffer;
        } else {
          this.result = new ArrayBuffer(0);
        }
        if (typeof this.onloadend === 'function') this.onloadend();
      } catch (err) {
        this.error = err;
        if (typeof this.onerror === 'function') this.onerror(err);
      }
    }, 5);
  }
}

globalThis.sessionStorage = new MockStorage();
globalThis.localStorage = new MockStorage();
globalThis.FileReader = MockFileReader;
globalThis.document = { cookie: '' };
globalThis.window = {
  location: {
    protocol: 'http:',
    hostname: 'localhost',
    pathname: '/index.html',
    search: '',
    hash: '',
    replace: (url) => { window.location.pathname = url; }
  }
};

// Dynamically import security utilities & auth guard
const securityUtils = await import('../src/utils/security.js');
const authGuard = await import('../auth-guard.js');
const googleDrive = await import('../src/services/googleDrive.js');

console.log('=== RUNNING PRODUCTION SECURITY HARDENING TEST SUITE ===\n');

// -------------------------------------------------------------
// SECTION 1: Token Security & Storage Architecture
// -------------------------------------------------------------
console.log('--- SECTION 1: Token Security & Storage Architecture ---');

{
  // Test 1.1: Ensure OAuth access tokens are stored strictly in sessionStorage, NOT in localStorage
  localStorage.clear();
  sessionStorage.clear();
  document.cookie = '';

  const sampleUser = {
    sub: '10987654321',
    name: 'Jane Student',
    email: 'jane@example.com',
    picture: 'https://lh3.googleusercontent.com/a/sample-photo',
    access_token: 'LEAKED_TOKEN_IN_USER_OBJECT', // simulate dirty user object
    secret_key: 'SUPER_SECRET'
  };

  const sampleToken = 'ya29.a0AfH6SMD_VALID_OAUTH_TOKEN_TEST_XYZ';

  authGuard.saveUserSession(sampleUser, sampleToken, 3600);

  // 1. Verify token is in sessionStorage
  assert.equal(
    sessionStorage.getItem(authGuard.AUTH_KEYS.ACCESS_TOKEN),
    sampleToken,
    'OAuth access token must be saved to sessionStorage'
  );
  assert.equal(
    sessionStorage.getItem(authGuard.AUTH_KEYS.DRIVE_TOKEN),
    sampleToken,
    'Drive token must be saved to sessionStorage'
  );
  assert.ok(
    sessionStorage.getItem(authGuard.AUTH_KEYS.TOKEN_EXPIRY),
    'Token expiry must be saved to sessionStorage'
  );

  // 2. Verify token is strictly NOT in localStorage
  assert.equal(
    localStorage.getItem(authGuard.AUTH_KEYS.ACCESS_TOKEN),
    null,
    'OAuth access token must NEVER be present in long-lived localStorage'
  );
  assert.equal(
    localStorage.getItem(authGuard.AUTH_KEYS.DRIVE_TOKEN),
    null,
    'Drive token must NEVER be present in long-lived localStorage'
  );
  assert.equal(
    localStorage.getItem(authGuard.AUTH_KEYS.TOKEN_EXPIRY),
    null,
    'Token expiry must NEVER be present in long-lived localStorage'
  );

  // 3. Verify only sanitized non-sensitive identity flags are saved to localStorage and cookie
  const savedProfile = JSON.parse(localStorage.getItem(authGuard.AUTH_KEYS.USER_PROFILE));
  assert.equal(savedProfile.name, 'Jane Student');
  assert.equal(savedProfile.email, 'jane@example.com');
  assert.equal(savedProfile.isLoggedIn, true);
  assert.equal(savedProfile.access_token, undefined, 'access_token must not leak into localStorage user profile');
  assert.equal(savedProfile.secret_key, undefined, 'secret_key must not leak into localStorage user profile');

  // Verify cookie contains non-sensitive identity flags only and NO token
  assert.ok(document.cookie.includes('study_session='), 'Cookie study_session must be set');
  assert.ok(!document.cookie.includes(sampleToken), 'Cookie study_session must NEVER contain OAuth token');

  // 4. Verify isTokenValid checks sessionStorage
  assert.equal(authGuard.isTokenValid(), true, 'isTokenValid() should return true when token is in sessionStorage');

  // 5. Verify cleanup of legacy tokens from localStorage if they somehow exist
  localStorage.setItem(authGuard.AUTH_KEYS.ACCESS_TOKEN, 'legacy_garbage_token');
  assert.equal(authGuard.getStoredDriveToken(), sampleToken, 'getStoredDriveToken() reads from sessionStorage');
  assert.equal(
    localStorage.getItem(authGuard.AUTH_KEYS.ACCESS_TOKEN),
    null,
    'Legacy token in localStorage must be purged automatically'
  );

  // 6. Verify clearAuthTokens purges both sessionStorage and localStorage
  authGuard.clearAuthTokens();
  assert.equal(sessionStorage.getItem(authGuard.AUTH_KEYS.ACCESS_TOKEN), null, 'sessionStorage token cleared');
  assert.equal(sessionStorage.getItem(authGuard.AUTH_KEYS.DRIVE_TOKEN), null, 'sessionStorage drive token cleared');
  assert.equal(authGuard.isTokenValid(), false, 'isTokenValid() must return false after clear');

  console.log('✔ Test 1: OAuth Access Tokens strictly isolated in sessionStorage & sanitized identity flags in persistent storage');
}

// -------------------------------------------------------------
// SECTION 2: Drive Notes File Inspection & Magic Bytes
// -------------------------------------------------------------
console.log('\n--- SECTION 2: Drive Notes File Inspection ---');

{
  // Helper to create a Mock File / Blob with byte headers
  function createMockFile(name, type, headerBytes, extraSize = 100) {
    const totalBytes = new Uint8Array(headerBytes.length + extraSize);
    totalBytes.set(headerBytes, 0);
    return {
      name,
      type,
      size: totalBytes.length,
      slice: (start, end) => ({
        arrayBuffer: async () => totalBytes.buffer.slice(start, end)
      })
    };
  }

  // 2.1: Valid PDF with %PDF magic bytes (0x25, 0x50, 0x44, 0x46)
  const validPdf = createMockFile('lecture-notes.pdf', 'application/pdf', [0x25, 0x50, 0x44, 0x46]);
  await securityUtils.validateFileBinarySignature(validPdf);
  console.log('✔ Test 2.1: Valid PDF with %PDF binary header accepted');

  // 2.2: Fake PDF (Declared .pdf but body is plain text or shell script)
  const fakePdf = createMockFile('trojan.pdf', 'application/pdf', [0x41, 0x42, 0x43, 0x44]);
  await assert.rejects(
    async () => securityUtils.validateFileBinarySignature(fakePdf),
    /does not match PDF binary signature/,
    'Fake PDF with invalid header must be rejected'
  );
  console.log('✔ Test 2.2: Spoofed PDF with invalid binary header rejected');

  // 2.3: Valid PNG with \x89PNG magic bytes (0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
  const validPng = createMockFile('diagram.png', 'image/png', [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  await securityUtils.validateFileBinarySignature(validPng);
  console.log('✔ Test 2.3: Valid PNG with \\x89PNG binary header accepted');

  // 2.4: Spoofed PNG (Declared .png but header is DOS executable MZ)
  const fakePng = createMockFile('payload.png', 'image/png', [0x4D, 0x5A, 0x90, 0x00]);
  await assert.rejects(
    async () => securityUtils.validateFileBinarySignature(fakePng),
    /executable binary header detected|does not match PNG binary signature/,
    'Spoofed PNG with MZ executable header must be rejected'
  );
  console.log('✔ Test 2.4: Spoofed PNG containing executable binary header rejected');

  // 2.5: Valid JPEG with FF D8 FF magic bytes
  const validJpg = createMockFile('whiteboard.jpg', 'image/jpeg', [0xFF, 0xD8, 0xFF, 0xE0]);
  await securityUtils.validateFileBinarySignature(validJpg);
  console.log('✔ Test 2.5: Valid JPG with FF D8 FF binary header accepted');

  // 2.6: Valid DOCX with PK\x03\x04 zip header (0x50, 0x4B, 0x03, 0x04)
  const validDocx = createMockFile('summary.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', [0x50, 0x4B, 0x03, 0x04]);
  await securityUtils.validateFileBinarySignature(validDocx);
  console.log('✔ Test 2.6: Valid DOCX with PK\\x03\\x04 binary header accepted');

  // 2.7: Strict rejection of SVG files
  const svgFile = createMockFile('vector.svg', 'image/svg+xml', [0x3C, 0x73, 0x76, 0x67]);
  await assert.rejects(
    async () => securityUtils.validateFileBinarySignature(svgFile),
    /SVG.*disallowed|blocked for security/i,
    'SVG uploads must be strictly blocked'
  );
  console.log('✔ Test 2.7: SVG uploads strictly blocked');

  // 2.8: Strict rejection of HTML files
  const htmlFile = createMockFile('exploit.html', 'text/html', [0x3C, 0x21, 0x44, 0x4F]);
  await assert.rejects(
    async () => securityUtils.validateFileBinarySignature(htmlFile),
    /HTML.*disallowed|blocked for security/i,
    'HTML uploads must be strictly blocked'
  );
  console.log('✔ Test 2.8: HTML uploads strictly blocked');

  // 2.9: Strict rejection of Executable files (.exe, .sh, .bat)
  const exeFile = createMockFile('malware.exe', 'application/x-msdownload', [0x4D, 0x5A, 0x00, 0x00]);
  await assert.rejects(
    async () => securityUtils.validateFileBinarySignature(exeFile),
    /blocked for security/i,
    'Executable binary uploads must be strictly blocked'
  );
  console.log('✔ Test 2.9: Executable binary files (.exe, .sh, .bat) strictly blocked');

  // 2.10: Service level validation in googleDrive.js
  await googleDrive.validateUploadedFile(validPdf);
  await assert.rejects(
    async () => googleDrive.validateUploadedFile(svgFile),
    /SVG and HTML files are strictly disallowed/
  );
  console.log('✔ Test 2.10: Google Drive upload service enforces binary signature validation');
}

// -------------------------------------------------------------
// SECTION 3: Update vercel.json Verification
// -------------------------------------------------------------
console.log('\n--- SECTION 3: vercel.json Security Headers Verification ---');

{
  const vercelPath = path.resolve('vercel.json');
  assert.ok(fs.existsSync(vercelPath), 'vercel.json must exist');
  const vercelContent = fs.readFileSync(vercelPath, 'utf8');
  const vercelJson = JSON.parse(vercelContent);

  const routeHeaders = vercelJson.headers?.[0]?.headers || [];
  const headerMap = {};
  for (const h of routeHeaders) {
    headerMap[h.key] = h.value;
  }

  // 3.1: Check X-Frame-Options: DENY
  assert.equal(headerMap['X-Frame-Options'], 'DENY', 'X-Frame-Options must be DENY');

  // 3.2: Check X-Content-Type-Options: nosniff
  assert.equal(headerMap['X-Content-Type-Options'], 'nosniff', 'X-Content-Type-Options must be nosniff');

  // 3.3: Check Content-Security-Policy
  const csp = headerMap['Content-Security-Policy'];
  assert.ok(csp, 'Content-Security-Policy must be present');
  assert.ok(csp.includes("default-src 'self'"), 'CSP must include default-src self');
  assert.ok(csp.includes("object-src 'none'"), "CSP must set object-src 'none'");
  assert.ok(csp.includes("base-uri 'self'"), "CSP must set base-uri 'self'");
  assert.ok(csp.includes('accounts.google.com'), 'CSP must permit accounts.google.com for GIS');
  assert.ok(csp.includes('www.googleapis.com'), 'CSP must permit www.googleapis.com for Drive');
  assert.ok(csp.includes('lh3.googleusercontent.com'), 'CSP must permit lh3.googleusercontent.com for avatars');
  assert.ok(!csp.includes('cdn.tailwindcss.com'), 'CSP must not allow untrusted or unused external scripts');

  console.log('✔ Test 3: vercel.json enforces X-Frame-Options: DENY, nosniff, and hardened CSP');
}

// -------------------------------------------------------------
// SECTION 4: DOM XSS Protection Audit
// -------------------------------------------------------------
console.log('\n--- SECTION 4: DOM XSS Protection Audit ---');

{
  // 4.1: getSafeQueryParam with strict whitelist
  window.location.search = '?expired=true&tab=notes&malicious=<script>alert(1)</script>';

  const expiredParam = securityUtils.getSafeQueryParam('expired', ['true', 'false']);
  assert.equal(expiredParam, 'true', 'Strict whitelist correctly accepts allowed value "true"');

  const nonWhitelisted = securityUtils.getSafeQueryParam('tab', ['dashboard', 'routine']);
  assert.equal(nonWhitelisted, null, 'Non-whitelisted parameter value must return null');

  const escapedMalicious = securityUtils.getSafeQueryParam('malicious');
  assert.ok(!escapedMalicious.includes('<script>'), 'Query parameter without whitelist must be entity escaped');
  assert.ok(escapedMalicious.includes('&lt;script&gt;'), 'HTML tags must be escaped safely');

  // 4.2: getSafeHash with strict whitelist
  window.location.hash = '#Algorithms';
  const safeHash = securityUtils.getSafeHash(['All', 'Starred', 'Algorithms', 'Mathematics']);
  assert.equal(safeHash, 'Algorithms', 'Whitelisted hash value safely accepted');

  window.location.hash = '#<img src=x onerror=alert(1)>';
  const safeHashWhitelisted = securityUtils.getSafeHash(['All', 'Starred']);
  assert.equal(safeHashWhitelisted, '', 'Non-whitelisted malicious hash returns empty string');

  const escapedHash = securityUtils.getSafeHash();
  assert.ok(!escapedHash.includes('<img'), 'Raw hash value must be entity escaped');

  console.log('✔ Test 4: URL query parameters and hashes strictly validated and escaped against DOM XSS');
}

console.log('\n=== ALL PRODUCTION SECURITY HARDENING TESTS PASSED SUCCESSFULLY! ===');
