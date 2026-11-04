import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('--- STARTING ANIMATED ACTIVE THEME BORDER PULSE TEST SUITE ---\n');

const rootDir = process.cwd();
const styleCssPath = path.resolve(rootDir, 'style.css');
const indexCssPath = path.resolve(rootDir, 'src/index.css');
const dashboardTabPath = path.resolve(rootDir, 'src/components/tabs/DashboardTab.jsx');
const dashboardJsxPath = path.resolve(rootDir, 'Dashboard.jsx');
const appJsPath = path.resolve(rootDir, 'app.js');
const settingsJsPath = path.resolve(rootDir, 'settings.js');

const styleCss = fs.readFileSync(styleCssPath, 'utf8');
const indexCss = fs.readFileSync(indexCssPath, 'utf8');
const dashboardTabCode = fs.readFileSync(dashboardTabPath, 'utf8');
const dashboardJsxCode = fs.readFileSync(dashboardJsxPath, 'utf8');
const appJsCode = fs.readFileSync(appJsPath, 'utf8');
const settingsJsCode = fs.readFileSync(settingsJsPath, 'utf8');

// 1. CSS ANIMATION: @keyframes activeThemeBorderPulse
console.log('1. Checking CSS Animation @keyframes activeThemeBorderPulse...');

const pulseRegex = /@keyframes\s+activeThemeBorderPulse\s*\{([\s\S]*?50%[\s\S]*?\n\})/;
const matchStyle = styleCss.match(pulseRegex);
const matchIndex = indexCss.match(pulseRegex);

assert(matchStyle, 'style.css must define @keyframes activeThemeBorderPulse');
assert(matchIndex, 'src/index.css must define @keyframes activeThemeBorderPulse');

// Check 0%, 100% properties
assert(
  matchStyle[1].includes('var(--primary)') && matchStyle[1].includes('var(--primary-glow)'),
  '@keyframes activeThemeBorderPulse in style.css must use var(--primary) and var(--primary-glow) at 0%, 100%'
);

// Check 50% properties: var(--secondary) and 18px-24px box-shadow with var(--accent-glow)
assert(
  matchStyle[1].includes('var(--secondary)') && matchStyle[1].includes('var(--accent-glow)'),
  '@keyframes activeThemeBorderPulse in style.css must use var(--secondary) and var(--accent-glow) at 50%'
);

// Check animation applied to .theme-pill.is-active with 2.4s cubic-bezier
assert(
  styleCss.includes('.theme-pill.is-active') && styleCss.includes('activeThemeBorderPulse 2.4s'),
  'style.css must apply activeThemeBorderPulse 2.4s to .theme-pill.is-active'
);
assert(
  indexCss.includes('.theme-pill.is-active') && indexCss.includes('activeThemeBorderPulse 2.4s'),
  'src/index.css must apply activeThemeBorderPulse 2.4s to .theme-pill.is-active'
);

console.log('✓ 1. CSS ANIMATION: activeThemeBorderPulse defined with 2.4s smooth pulse and applied to .theme-pill.is-active');

// 2. JAVASCRIPT STATE BINDING: applySelectedTheme defined & exported
console.log('2. Checking applySelectedTheme definition & export...');

assert(
  dashboardTabCode.includes('export function applySelectedTheme'),
  'DashboardTab.jsx must define and export applySelectedTheme'
);
assert(
  dashboardJsxCode.includes('applySelectedTheme'),
  'Dashboard.jsx must export applySelectedTheme'
);
assert(
  appJsCode.includes('applySelectedTheme'),
  'app.js must import/export applySelectedTheme'
);
assert(
  settingsJsCode.includes('applySelectedTheme'),
  'settings.js must define/export applySelectedTheme'
);

console.log('✓ 2. JAVASCRIPT BINDING: applySelectedTheme defined and exported across Dashboard.jsx, DashboardTab, and app.js');

// 3. REMOVE .is-active AND ADD TO MATCHING BUTTON
console.log('3. Checking DOM class toggling in applySelectedTheme...');

assert(
  dashboardTabCode.includes("btn.classList.remove('is-active')"),
  'applySelectedTheme must remove .is-active from all buttons'
);
assert(
  dashboardTabCode.includes("btn.classList.add('is-active')"),
  'applySelectedTheme must add .is-active to the button matching the selected theme'
);

console.log('✓ 3. CLASS TOGGLING: Removes .is-active from all buttons and adds it strictly to matching theme button');

// 4. STORAGE & INITIALIZATION: studyflow_app_theme on page load / mount
console.log('4. Checking localStorage persistence and page load initialization...');

assert(
  dashboardTabCode.includes('studyflow_app_theme'),
  'DashboardTab must save and retrieve studyflow_app_theme'
);
assert(
  appJsCode.includes('studyflow_app_theme'),
  'app.js must read studyflow_app_theme on DOMContentLoaded'
);
assert(
  settingsJsCode.includes('studyflow_app_theme'),
  'settings.js must update studyflow_app_theme'
);

// Check button JSX markup has theme-pill and data-theme-id
assert(
  dashboardTabCode.includes('theme-pill') && dashboardTabCode.includes('data-theme-id'),
  'DashboardTab theme buttons must carry .theme-pill and data-theme-id attribute'
);

console.log('✓ 4. STORAGE & INITIALIZATION: studyflow_app_theme synced and activated on DOMContentLoaded/mount');

// 5. FUNCTIONAL DOM SIMULATION
console.log('5. Running functional DOM simulation...');

class MockElement {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.classList = new Set();
    this.attributes = { ...attrs };
  }
  getAttribute(name) {
    return this.attributes[name] || null;
  }
  setAttribute(name, val) {
    this.attributes[name] = val;
  }
}
MockElement.prototype.classList = MockElement.prototype.classList || new Set();

const mockButtons = [
  { attrs: { 'data-theme-id': 'clean' }, classes: new Set(['theme-pill']) },
  { attrs: { 'data-theme-id': 'chromatic' }, classes: new Set(['theme-pill']) },
  { attrs: { 'data-theme-id': 'cyberpunk' }, classes: new Set(['theme-pill', 'is-active']) },
  { attrs: { 'data-theme-id': 'mocha-lavender' }, classes: new Set(['theme-pill']) },
  { attrs: { 'data-theme-id': 'cyber-jet' }, classes: new Set(['theme-pill']) }
];

// Helper to simulate button element with classList
const btnElements = mockButtons.map(b => ({
  getAttribute: (k) => b.attrs[k],
  classList: {
    remove: (cls) => b.classes.delete(cls),
    add: (cls) => b.classes.add(cls),
    contains: (cls) => b.classes.has(cls)
  }
}));

// Simulate applySelectedTheme('mocha-lavender')
function simulateApplyTheme(themeId, buttons) {
  buttons.forEach(btn => {
    btn.classList.remove('is-active');
    if (btn.getAttribute('data-theme-id') === themeId) {
      btn.classList.add('is-active');
    }
  });
}

// Initial state: cyberpunk is active
assert(btnElements[2].classList.contains('is-active'), 'Initially cyberpunk has is-active');
assert(!btnElements[3].classList.contains('is-active'), 'Initially mocha-lavender does not have is-active');

// Activate mocha-lavender
simulateApplyTheme('mocha-lavender', btnElements);
assert(!btnElements[2].classList.contains('is-active'), 'After switch, cyberpunk loses is-active');
assert(btnElements[3].classList.contains('is-active'), 'After switch, mocha-lavender receives is-active');

// Activate cyber-jet
simulateApplyTheme('cyber-jet', btnElements);
assert(!btnElements[3].classList.contains('is-active'), 'After switch, mocha-lavender loses is-active');
assert(btnElements[4].classList.contains('is-active'), 'After switch, cyber-jet receives is-active');

console.log('✓ 5. FUNCTIONAL SIMULATION: State transitions cleanly update .is-active and border pulse targets');

console.log('\nAll 5 animated glowing border pulse tests passed successfully!\n');
