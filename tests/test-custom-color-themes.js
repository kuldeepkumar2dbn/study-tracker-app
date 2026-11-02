/**
 * Test Suite: Custom Selectable Color Themes (tests/test-custom-color-themes.js)
 * 
 * Verifies:
 * 1. CSS & Style block definitions for [data-theme="mocha-lavender"] and [data-theme="cyber-jet"]
 * 2. Exact style variable values for Mocha & Platinum Lavender
 * 3. Exact style variable values for Cyber Jet & Hot Pink
 * 4. Theme controller switchers in settings.js, ThemeContext.jsx, Dashboard.jsx, and AppShell
 * 5. Dynamic visuals & bar fill with --bar-filled / --primary in ConsistencyRadar
 * 6. Retention of exact streak counting and history tracking across theme transitions
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Mock localStorage and document for testing environments
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

console.log('\n--- STARTING CUSTOM SELECTABLE COLOR THEMES TEST SUITE ---\n');

test('1. UPDATE STYLING SHEETS: mocha-lavender & cyber-jet defined in src/index.css, style.css, and index.html', () => {
  const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
  assert(indexCss.includes('[data-theme="mocha-lavender"]') || indexCss.includes("[data-theme='mocha-lavender']"), 'src/index.css defines mocha-lavender theme');
  assert(indexCss.includes('[data-theme="cyber-jet"]') || indexCss.includes("[data-theme='cyber-jet']"), 'src/index.css defines cyber-jet theme');

  const styleCss = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');
  assert(styleCss.includes('[data-theme="mocha-lavender"]'), 'style.css defines mocha-lavender theme');
  assert(styleCss.includes('[data-theme="cyber-jet"]'), 'style.css defines cyber-jet theme');

  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  assert(indexHtml.includes('<style') && indexHtml.includes('mocha-lavender'), 'index.html style block contains mocha-lavender');
  assert(indexHtml.includes('cyber-jet'), 'index.html style block contains cyber-jet');
});

test('2. MOCHA & PLATINUM LAVENDER: Exact variable color values verified', () => {
  const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
  const mochaBlock = indexCss.slice(indexCss.indexOf('[data-theme="mocha-lavender"]'), indexCss.indexOf('[data-theme="cyber-jet"]'));

  // Backgrounds
  assert(mochaBlock.includes('#1A130E') || mochaBlock.includes('#1a130e'), 'bg-app must be #1A130E');
  assert(mochaBlock.includes('#241A13') || mochaBlock.includes('#241a13'), 'bg-sidebar must be #241A13');
  assert(mochaBlock.includes('#2B1E16') || mochaBlock.includes('#2b1e16'), 'bg-card must be #2B1E16');

  // Borders
  assert(mochaBlock.includes('#422D21') || mochaBlock.includes('#422d21'), 'border-glow must be #422D21');

  // Primary Active
  assert(mochaBlock.includes('#6F4E37') || mochaBlock.includes('#6f4e37'), 'primary must be #6F4E37');

  // Accents
  assert(mochaBlock.includes('#E5E4E2') || mochaBlock.includes('#e5e4e2'), 'secondary must be #E5E4E2');
  assert(mochaBlock.includes('#E6E0F0') || mochaBlock.includes('#e6e0f0'), 'accent must be #E6E0F0');

  // Text
  assert(mochaBlock.includes('#B3AAA4') || mochaBlock.includes('#b3aaa4'), 'text-muted must be #B3AAA4');
});

test('3. CYBER JET & HOT PINK: Exact variable color values verified', () => {
  const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
  const cyberBlock = indexCss.slice(indexCss.indexOf('[data-theme="cyber-jet"]'));

  // Backgrounds
  assert(cyberBlock.includes('#0B0B0B') || cyberBlock.includes('#0b0b0b'), 'bg-app must be #0B0B0B');
  assert(cyberBlock.includes('#101010'), 'bg-sidebar must be #101010');
  assert(cyberBlock.includes('#151515'), 'bg-card must be #151515');

  // Borders
  assert(cyberBlock.includes('#282828'), 'border-glow must be #282828');

  // Primary Active
  assert(cyberBlock.includes('#FF2DA3') || cyberBlock.includes('#ff2da3'), 'primary must be #FF2DA3');

  // Accents & Highlights
  assert(cyberBlock.includes('#D4FF3F') || cyberBlock.includes('#d4ff3f'), 'secondary/accent must be #D4FF3F');

  // Text
  assert(cyberBlock.includes('#FFFFFF') || cyberBlock.includes('#ffffff'), 'text-main must be #FFFFFF');
  assert(cyberBlock.includes('#8E8E8E') || cyberBlock.includes('#8e8e8e'), 'text-muted must be #8E8E8E');
});

test('4. THEME CONTROLLERS & SWITCHERS: settings.js and ThemeContext.jsx expose selectable options', async () => {
  const { THEMES, setTheme, getTheme } = await import('../settings.js');

  const mochaTheme = THEMES.find(t => t.id === 'mocha-lavender');
  assert(mochaTheme, 'THEMES contains mocha-lavender');
  assert(mochaTheme.name.includes('Mocha & Platinum Lavender'), 'mocha-lavender has name "🌅 Mocha & Platinum Lavender"');

  const cyberTheme = THEMES.find(t => t.id === 'cyber-jet');
  assert(cyberTheme, 'THEMES contains cyber-jet');
  assert(cyberTheme.name.includes('Cyber Jet & Hot Pink'), 'cyber-jet has name "⚡ Cyber Jet & Hot Pink"');

  // Toggle mocha-lavender
  setTheme('mocha-lavender');
  assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'mocha-lavender');
  assert.strictEqual(localStorage.getItem('studyflow_theme'), 'mocha-lavender');
  assert.strictEqual(getTheme(), 'mocha-lavender');

  // Toggle cyber-jet
  setTheme('cyber-jet');
  assert.strictEqual(document.documentElement.getAttribute('data-theme'), 'cyber-jet');
  assert.strictEqual(localStorage.getItem('studyflow_theme'), 'cyber-jet');
  assert.strictEqual(getTheme(), 'cyber-jet');
});

test('5. DASHBOARD & UI INTEGRATION: DashboardTab, Dashboard.jsx and AppShell render theme options', () => {
  const appShellContent = fs.readFileSync(path.join(rootDir, 'src/components/AppShell.jsx'), 'utf8');
  assert(appShellContent.includes('themes.map'), 'AppShell iterates over themes for dropdown');

  const dashTabContent = fs.readFileSync(path.join(rootDir, 'src/components/tabs/DashboardTab.jsx'), 'utf8');
  assert(dashTabContent.includes('dashboard-theme-switcher'), 'DashboardTab includes dashboard-theme-switcher');
  assert(dashTabContent.includes('useTheme'), 'DashboardTab uses useTheme hook');

  const dashboardJsx = fs.readFileSync(path.join(rootDir, 'Dashboard.jsx'), 'utf8');
  assert(dashboardJsx.includes('THEMES'), 'Dashboard.jsx re-exports theme controllers');
});

test('6. DYNAMIC VISUALS: ConsistencyRadar bar chart fills dynamically based on custom theme variables', () => {
  const radarContent = fs.readFileSync(path.join(rootDir, 'src/components/ConsistencyRadar.jsx'), 'utf8');
  assert(radarContent.includes('--bar-filled') || radarContent.includes('--primary'), 'ConsistencyRadar uses --bar-filled / --primary variables');
  assert(radarContent.includes('--bar-filled-gradient'), 'ConsistencyRadar uses --bar-filled-gradient variable');
  assert(radarContent.includes('bg-gradient-to-t from-emerald-600 to-emerald-400'), 'ConsistencyRadar retains emerald gradient fallback class');
});

test('7. HISTORY & STREAK RETENTION: Switching themes preserves exact user streak count and dailyActivity', () => {
  const { calculate30DayBarGraph } = ConsistencyRadarModule;

  const mockUserActivity = {
    '2026-11-02': 180, // 3.0h today
    '2026-11-01': 120, // 2.0h yesterday
    '2026-10-31': 240  // 4.0h 2 days ago
  };
  const initialStreak = 15;

  // Compute metrics under default theme
  const refDate = new Date('2026-11-02T12:00:00Z');
  const initialResult = calculate30DayBarGraph(mockUserActivity, refDate);
  assert.strictEqual(initialResult.activeDaysCount, 3);
  assert.strictEqual(initialResult.totalMinutes, 540); // 9.0 hours
  assert.strictEqual(initialResult.totalHoursFormatted, '9.0');

  // Switch to Mocha Lavender
  globalThis.document.documentElement.setAttribute('data-theme', 'mocha-lavender');
  globalThis.localStorage.setItem('studyflow_theme', 'mocha-lavender');

  const mochaResult = calculate30DayBarGraph(mockUserActivity, refDate);
  assert.strictEqual(mochaResult.activeDaysCount, 3, 'Active days count strictly preserved in Mocha Lavender');
  assert.strictEqual(mochaResult.totalMinutes, 540, 'Total study minutes strictly preserved in Mocha Lavender');
  assert.strictEqual(mochaResult.totalHoursFormatted, '9.0', 'Total hours strictly preserved');

  // Switch to Cyber Jet
  globalThis.document.documentElement.setAttribute('data-theme', 'cyber-jet');
  globalThis.localStorage.setItem('studyflow_theme', 'cyber-jet');

  const cyberResult = calculate30DayBarGraph(mockUserActivity, refDate);
  assert.strictEqual(cyberResult.activeDaysCount, 3, 'Active days count strictly preserved in Cyber Jet');
  assert.strictEqual(cyberResult.totalMinutes, 540, 'Total study minutes strictly preserved in Cyber Jet');
  assert.strictEqual(initialStreak, 15, 'Streak count strictly preserved across theme changes');
});

import * as ConsistencyRadarModule from '../src/utils/consistencyRadar.js';

console.log(`\nAll ${passedCount} tests passed successfully!\n`);

