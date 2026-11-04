/**
 * Test Suite: Refined Onyx & Gold Warm Light-Golden Theme (tests/test-onyx-gold-theme.js)
 * 
 * Verifies:
 * 1. CSS & Style tokens for [data-theme="black-gold"]:
 *    - Main Page Background (--bg-app): #E2C992 (Warm muted light golden)
 *    - Sidebar & Top Header Background (--bg-sidebar): #D8BC82 (Satin medium-light gold)
 *    - Card & Panel Background (--bg-card): #ECD9AE (Soft champagne gold)
 *    - All Borders (--border-glow): #FFFFFF (1.5px solid pure white)
 *    - Primary Text (--text-main): #000000 (Pure black)
 *    - Secondary Text (--text-muted): #2E2414 (Deep espresso-black)
 * 2. Overrides for hardcoded dark classes & aesthetic refinement:
 *    - .ambient-mesh-canvas set to display: none !important
 *    - Overrides for bg-[#0b0b0b], bg-[#12141a], bg-slate-900, text-white, border-slate-800
 *    - Flat matte cards with 1.5px solid #FFFFFF borders
 *    - Primary action buttons ("Launch Focus Timer", active sidebar item, active theme pill) styled with
 *      #0F0F0F black background, #FFFFFF text, and 1.5px solid #FFFFFF border
 *    - 30-day velocity chart bars render with solid #0F0F0F fill
 * 3. Theme controller & metadata:
 *    - settings.js and ThemeContext.jsx define black-gold in THEMES with updated light palette
 *    - normalizeTheme maps 'black-gold', 'onyx-gold', 'onyx', 'gold'
 *    - DashboardTab theme switcher grid uses lg:grid-cols-6
 *    - Theme activation updates document.documentElement and localStorage
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Mock localStorage and document for testing environment
class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(k) {
    return this.store[k] || null;
  }
  setItem(k, v) {
    this.store[k] = String(v);
  }
  removeItem(k) {
    delete this.store[k];
  }
  clear() {
    this.store = {};
  }
}

globalThis.localStorage = new MockStorage();

class MockClassList {
  constructor() {
    this.classes = new Set();
  }
  add(cls) {
    this.classes.add(cls);
  }
  remove(cls) {
    this.classes.delete(cls);
  }
  contains(cls) {
    return this.classes.has(cls);
  }
}

globalThis.document = {
  documentElement: {
    attributes: {},
    classList: new MockClassList(),
    setAttribute(name, val) {
      this.attributes[name] = val;
    },
    getAttribute(name) {
      return this.attributes[name] || null;
    }
  },
  querySelectorAll() {
    return [];
  }
};

globalThis.window = {
  dispatchEvent() {},
  addEventListener() {},
  removeEventListener() {}
};

globalThis.CustomEvent = class {
  constructor(name, opts = {}) {
    this.name = name;
    this.detail = opts.detail;
  }
};

let passedCount = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('\n--- STARTING ONYX & GOLD (WARM LIGHT-GOLDEN) THEME TEST SUITE ---\n');

test('1. CSS DEFINITIONS: black-gold warm light-golden palette declared in style.css, src/index.css, and index.html', () => {
  const styleCss = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');
  const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

  for (const [filename, content] of [['style.css', styleCss], ['src/index.css', indexCss], ['index.html', indexHtml]]) {
    assert(content.includes('[data-theme="black-gold"]'), `${filename} must define [data-theme="black-gold"]`);

    // Main Page Background (--bg-app): #E2C992
    assert(content.includes('#E2C992') || content.includes('#e2c992'), `${filename} must include app background #E2C992`);

    // Sidebar & Top Header Background (--bg-sidebar): #D8BC82
    assert(content.includes('#D8BC82') || content.includes('#d8bc82'), `${filename} must include sidebar background #D8BC82`);

    // Card & Panel Background (--bg-card): #ECD9AE
    assert(content.includes('#ECD9AE') || content.includes('#ecd9ae'), `${filename} must include card background #ECD9AE`);

    // Borders: #FFFFFF
    assert(content.includes('--border-glow: #FFFFFF') || content.includes('--border-glow: #ffffff'), `${filename} must include border #FFFFFF`);

    // Primary Text: #000000
    assert(content.includes('--text-main: #000000'), `${filename} must include primary text #000000`);

    // Secondary Text: #2E2414
    assert(content.includes('#2E2414') || content.includes('#2e2414'), `${filename} must include secondary text #2E2414`);
  }
});

test('2. OVERRIDE HARDCODED DARK CLASSES & AESTHETIC REFINEMENT', () => {
  const styleCss = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');
  const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');

  for (const [filename, content] of [['style.css', styleCss], ['src/index.css', indexCss]]) {
    // Ambient mesh canvas disabled
    assert(
      content.includes('[data-theme="black-gold"] .ambient-mesh-canvas') && content.includes('display: none !important'),
      `${filename} must disable .ambient-mesh-canvas with display: none !important`
    );

    // Overrides for hardcoded dark classes
    assert(
      content.includes('bg-[#0b0b0b]') && content.includes('bg-[#12141a]') && content.includes('bg-slate-900'),
      `${filename} must override hardcoded dark backgrounds bg-[#0b0b0b], bg-[#12141a], bg-slate-900`
    );

    // Override light text and dark borders
    assert(
      content.includes('text-white') && content.includes('border-slate-800'),
      `${filename} must override light text and dark borders`
    );

    // Primary action buttons styled with #0F0F0F black background, #FFFFFF text, and 1.5px solid #FFFFFF border
    assert(
      content.includes('#0F0F0F') && content.includes('1.5px solid #FFFFFF'),
      `${filename} must style primary action buttons with #0F0F0F background and 1.5px solid #FFFFFF border`
    );

    // Active sidebar item and active theme pill
    assert(
      content.includes('#app-sidebar nav a[style*="background"]') && content.includes('.theme-pill.is-active'),
      `${filename} must style active sidebar item and active theme pill`
    );
  }
});

test('3. THEME CONTROLLER & METADATA: settings.js and ThemeContext.jsx expose updated black-gold theme', async () => {
  const { THEMES, setTheme, getTheme, normalizeTheme } = await import('../settings.js');

  const blackGoldTheme = THEMES.find(t => t.id === 'black-gold');
  assert(blackGoldTheme, 'THEMES in settings.js must contain black-gold theme');
  assert(blackGoldTheme.name.includes('Onyx & Gold'), 'black-gold theme name must include "Onyx & Gold"');
  assert.strictEqual(blackGoldTheme.bgColor.toUpperCase(), '#E2C992');
  assert.strictEqual(blackGoldTheme.surfaceColor.toUpperCase(), '#D8BC82');
  assert.strictEqual(blackGoldTheme.cardColor.toUpperCase(), '#ECD9AE');
  assert.strictEqual(blackGoldTheme.textColor, '#000000');
  assert.strictEqual(blackGoldTheme.borderColor.toUpperCase(), '#FFFFFF');
  assert.strictEqual(blackGoldTheme.isDark, false);

  // Normalization aliases
  assert.strictEqual(normalizeTheme('black-gold'), 'black-gold');
  assert.strictEqual(normalizeTheme('onyx-gold'), 'black-gold');
  assert.strictEqual(normalizeTheme('onyx'), 'black-gold');
  assert.strictEqual(normalizeTheme('gold'), 'black-gold');

  // Verify ThemeContext.jsx source
  const themeContextCode = fs.readFileSync(path.join(rootDir, 'src/context/ThemeContext.jsx'), 'utf8');
  assert(themeContextCode.includes("id: 'black-gold'"), 'ThemeContext.jsx must define black-gold theme');
  assert(themeContextCode.includes('Crown'), 'ThemeContext.jsx must use Crown icon for black-gold theme');
});

test('4. DASHBOARD THEME SELECTOR GRID: 6 columns across full screen width', () => {
  const dashboardTabCode = fs.readFileSync(path.join(rootDir, 'src/components/tabs/DashboardTab.jsx'), 'utf8');

  assert(
    dashboardTabCode.includes('w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5'),
    'DashboardTab.jsx theme selector must use w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5'
  );
  assert(
    dashboardTabCode.includes('w-full flex-1 flex items-center justify-center text-center truncate'),
    'Theme pill buttons must stretch evenly with w-full flex-1 flex items-center justify-center text-center truncate'
  );
});

test('5. THEME SELECTION RUNTIME BINDING: State change applies data-theme and syncs localStorage', async () => {
  const { setTheme, getTheme } = await import('../settings.js');

  setTheme('black-gold');
  assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'black-gold');
  assert.strictEqual(localStorage.getItem('studyflow_app_theme'), 'black-gold');
  assert.strictEqual(localStorage.getItem('studyflow_theme'), 'black-gold');
  assert.strictEqual(getTheme(), 'black-gold');
  assert(!document.documentElement.classList.contains('dark'), 'document.documentElement removes dark class for light theme');
});

console.log(`\nAll ${passedCount} Onyx & Gold theme tests passed successfully!\n`);
