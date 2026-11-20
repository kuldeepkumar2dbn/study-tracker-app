import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('=== RUNNING MOBILE BOTTOM WORKSPACE NAV & SPACIOUS LAYOUT TEST SUITE ===\n');

const rootDir = process.cwd();
const styleCss = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');
const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const appShell = fs.readFileSync(path.join(rootDir, 'src/components/AppShell.jsx'), 'utf8');
const subjectsTab = fs.readFileSync(path.join(rootDir, 'src/components/tabs/SubjectsTab.jsx'), 'utf8');
const dailyRoutine = fs.readFileSync(path.join(rootDir, 'src/components/DailyRoutine.jsx'), 'utf8');

// --------------------------------------------------------------------------
// SECTION 1: Fixed Mobile Bottom Workspace Navigation Bar (< 768px)
// --------------------------------------------------------------------------
console.log('--- SECTION 1: Fixed Mobile Bottom Workspace Navigation Bar ---');

// 1.1 Element ID and Fixed Bottom Positioning (style.css & src/index.css)
assert(
  styleCss.includes('#mobile-bottom-nav') &&
  styleCss.includes('position: fixed') &&
  styleCss.includes('bottom: 0') &&
  styleCss.includes('62px') &&
  styleCss.includes('z-index: 42') &&
  styleCss.includes('safe-area-inset-bottom'),
  'style.css must define #mobile-bottom-nav pinned at bottom with height 62px, z-index 42, and safe-area-inset-bottom'
);

assert(
  indexCss.includes('#mobile-bottom-nav') &&
  indexCss.includes('position: fixed') &&
  indexCss.includes('bottom: 0') &&
  indexCss.includes('62px') &&
  indexCss.includes('z-index: 42') &&
  indexCss.includes('safe-area-inset-bottom'),
  'src/index.css must define #mobile-bottom-nav pinned at bottom with height 62px, z-index 42, and safe-area-inset-bottom'
);

assert(
  indexHtml.includes('#mobile-bottom-nav') &&
  indexHtml.includes('position: fixed') &&
  indexHtml.includes('62px') &&
  indexHtml.includes('z-index: 42'),
  'index.html head styles must define #mobile-bottom-nav pinned at bottom with height 62px and z-index 42'
);
console.log('✔ Test 1.1: #mobile-bottom-nav fixed bottom positioning (height: 62px, z-index: 42, safe-area-inset-bottom) verified');

// 1.2 Hidden on Desktop (>= 769px)
assert(
  (styleCss.includes('min-width: 769px') && styleCss.includes('display: none !important')) ||
  (styleCss.includes('@media (min-width: 769px)') && styleCss.includes('#mobile-bottom-nav')),
  'style.css must hide #mobile-bottom-nav on desktop (>= 769px)'
);

assert(
  indexCss.includes('min-width: 769px') && indexCss.includes('display: none !important'),
  'src/index.css must hide #mobile-bottom-nav on desktop (>= 769px)'
);

assert(
  indexHtml.includes('min-width: 769px') && indexHtml.includes('display: none !important'),
  'index.html must hide #mobile-bottom-nav on desktop (>= 769px)'
);
console.log('✔ Test 1.2: #mobile-bottom-nav hidden on desktop (>= 769px) verified');

// 1.3 5 Clean Icon + Label Tabs Present in index.html & AppShell.jsx
const requiredTabs = [
  { label: 'Home', view: 'dashboard' },
  { label: 'Routine', view: 'routine' },
  { label: 'Syllabus', view: 'syllabus' },
  { label: 'Mocks', view: 'mock-logbook' }
];

requiredTabs.forEach(tab => {
  assert(
    indexHtml.includes(`data-target-view="${tab.view}"`) && indexHtml.includes(tab.label),
    `index.html must include bottom nav tab for ${tab.label} with data-target-view="${tab.view}"`
  );
  assert(
    appShell.includes(`id: '${tab.view}'`) && appShell.includes(tab.label),
    `AppShell.jsx MobileBottomNav must include tab for ${tab.label} with id: '${tab.view}'`
  );
});

// Tab 5: More drawer button
assert(
  indexHtml.includes('id="mobile-bottom-nav-more-btn"') || indexHtml.includes('data-mobile-action="open-sidebar"'),
  'index.html must include More tab button with id="mobile-bottom-nav-more-btn" or data-mobile-action="open-sidebar"'
);
assert(
  appShell.includes('mobile-bottom-nav-more-btn') && appShell.includes('More'),
  'AppShell.jsx MobileBottomNav must include More tab button'
);
console.log('✔ Test 1.3: 5 clean tabs (Home, Routine, Syllabus, Mocks, More) present in HTML and React layout');

// 1.4 Mobile Scroll Area Clearance (padding-bottom: 84px)
assert(
  styleCss.includes('padding-bottom: 84px !important') &&
  (styleCss.includes('.app-scroll-area') || styleCss.includes('#main-layout-wrapper')),
  'style.css must enforce padding-bottom: 84px !important on .app-scroll-area / #main-layout-wrapper on mobile'
);

assert(
  indexCss.includes('padding-bottom: 84px !important') &&
  (indexCss.includes('.app-scroll-area') || indexCss.includes('#main-layout-wrapper')),
  'src/index.css must enforce padding-bottom: 84px !important on .app-scroll-area / #main-layout-wrapper on mobile'
);

assert(
  indexHtml.includes('padding-bottom: 84px !important') &&
  (indexHtml.includes('.app-scroll-area') || indexHtml.includes('#main-layout-wrapper')),
  'index.html must enforce padding-bottom: 84px !important on .app-scroll-area on mobile'
);
console.log('✔ Test 1.4: Mobile scroll area clearance (padding-bottom: 84px) verified');

// --------------------------------------------------------------------------
// SECTION 2: Active Navigation State Sync (router.js)
// --------------------------------------------------------------------------
console.log('\n--- SECTION 2: Active Navigation State Sync ---');

function createMockElement(id, targetView, initialClasses = []) {
  const classList = new Set(initialClasses);
  classList.add = function(...c) { c.forEach(x => Set.prototype.add.call(this, x)); };
  classList.remove = function(...c) { c.forEach(x => Set.prototype.delete.call(this, x)); };
  classList.contains = function(c) { return Set.prototype.has.call(this, c); };

  const attrs = {};
  if (targetView) attrs['data-target-view'] = targetView;

  return {
    id,
    classList,
    getAttribute(k) { return attrs[k] || null; },
    setAttribute(k, v) { attrs[k] = v; },
    removeAttribute(k) { delete attrs[k]; }
  };
}

const mockViews = [
  createMockElement('view-dashboard', null, ['app-view', 'active-view']),
  createMockElement('view-routine', null, ['app-view']),
  createMockElement('view-syllabus', null, ['app-view']),
  createMockElement('view-mock-logbook', null, ['app-view'])
];

const mockTabs = [
  createMockElement('tab-home', 'dashboard', ['mobile-bottom-tab', 'active', 'is-active']),
  createMockElement('tab-routine', 'routine', ['mobile-bottom-tab']),
  createMockElement('tab-syllabus', 'syllabus', ['mobile-bottom-tab']),
  createMockElement('tab-mocks', 'mock-logbook', ['mobile-bottom-tab'])
];

const mockDocument = {
  readyState: 'complete',
  addEventListener() {},
  removeEventListener() {},
  querySelectorAll(sel) {
    if (sel === '.app-view') return mockViews;
    if (sel === '[data-target-view]') return mockTabs;
    return [];
  },
  getElementById(id) {
    return mockViews.find(v => v.id === id) || mockTabs.find(t => t.id === id) || null;
  },
  querySelector(sel) {
    if (sel.startsWith('#')) return this.getElementById(sel.slice(1));
    return null;
  }
};

global.document = mockDocument;
global.window = {
  location: { hash: '#dashboard' },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {}
};

const routerMod = await import(`file://${path.join(rootDir, 'router.js').replace(/\\/g, '/')}`);

// Test switch to routine
routerMod.switchView('routine', false);
const tabRoutine = mockTabs.find(t => t.id === 'tab-routine');
const tabHome = mockTabs.find(t => t.id === 'tab-home');

assert(
  tabRoutine.classList.contains('active') && tabRoutine.classList.contains('is-active'),
  'router.js switchView must add .active and .is-active to matching bottom nav tab'
);
assert(
  !tabHome.classList.contains('active') && !tabHome.classList.contains('is-active'),
  'router.js switchView must remove .active and .is-active from non-matching bottom nav tab'
);

// Test switch to syllabus
routerMod.switchView('syllabus', false);
const tabSyllabus = mockTabs.find(t => t.id === 'tab-syllabus');
assert(
  tabSyllabus.classList.contains('active') && tabSyllabus.classList.contains('is-active'),
  'router.js switchView must add .active to syllabus tab'
);
assert(
  !tabRoutine.classList.contains('active'),
  'router.js switchView must remove .active from routine tab'
);

console.log('✔ Test 2.1: router.js switchView automatically syncs .active, .is-active, and aria-current on bottom nav');

// --------------------------------------------------------------------------
// SECTION 3: Spacious Mobile Layout for Content Views (< 768px)
// --------------------------------------------------------------------------
console.log('\n--- SECTION 3: Spacious Mobile Layout for Content Views ---');

// 3.1 Single-column full-width cards on mobile
assert(
  styleCss.includes('#view-syllabus .grid') &&
  styleCss.includes('grid-template-columns: 1fr !important') &&
  (styleCss.includes('0.875rem') || styleCss.includes('gap-3.5')),
  'style.css must convert #view-syllabus grids into single-column (1fr) with gap-3.5 on mobile'
);

assert(
  styleCss.includes('#view-routine .grid') &&
  styleCss.includes('grid-template-columns: 1fr !important'),
  'style.css must convert #view-routine grids into single-column (1fr) on mobile'
);

assert(
  indexCss.includes('#view-syllabus .grid') &&
  indexCss.includes('grid-template-columns: 1fr !important'),
  'src/index.css must convert #view-syllabus grids into single-column (1fr) on mobile'
);
console.log('✔ Test 3.1: Single-column full-width cards (grid-template-columns: 1fr !important; gap: 0.875rem) verified');

// 3.2 Generous Internal Padding (p-4 = 1rem) on cards
assert(
  styleCss.includes('#view-syllabus .glass-panel') && styleCss.includes('padding: 1rem !important'),
  'style.css must provide generous internal padding (1rem / p-4) on mobile content cards'
);

assert(
  indexCss.includes('#view-syllabus .glass-panel') && indexCss.includes('padding: 1rem !important'),
  'src/index.css must provide generous internal padding (1rem / p-4) on mobile content cards'
);
console.log('✔ Test 3.2: Generous internal padding (p-4 / 1rem !important) on content view cards verified');

// 3.3 Chapter Action Row on Single Clean Row Without Text Wrapping
assert(
  subjectsTab.includes('chapter-action-row'),
  'SubjectsTab.jsx must apply chapter-action-row class on chapter controls container'
);

assert(
  styleCss.includes('.chapter-action-row') &&
  styleCss.includes('flex-wrap: nowrap !important') &&
  styleCss.includes('overflow-x: auto !important'),
  'style.css must enforce single-row nowrap with horizontal scroll for .chapter-action-row'
);

assert(
  indexCss.includes('.chapter-action-row') &&
  indexCss.includes('flex-wrap: nowrap !important'),
  'src/index.css must enforce single-row nowrap with horizontal scroll for .chapter-action-row'
);

assert(
  styleCss.includes('.chapter-action-row button') &&
  styleCss.includes('white-space: nowrap !important'),
  'style.css must prevent button text wrapping inside .chapter-action-row'
);
console.log('✔ Test 3.3: Chapter action buttons (.chapter-action-row) aligned on a single clean row without text wrapping verified');

// 3.4 Thumb-Friendly Daily Routine Time-Block Tap Targets (min-h-[44px])
assert(
  dailyRoutine.includes('min-h-[44px]'),
  'DailyRoutine.jsx must apply min-h-[44px] on routine items and completion tap targets'
);

assert(
  styleCss.includes('.routine-block-item') &&
  styleCss.includes('min-height: 44px !important'),
  'style.css must enforce min-height: 44px !important on .routine-block-item and routine slots'
);

assert(
  indexCss.includes('.routine-block-item') &&
  indexCss.includes('min-height: 44px !important'),
  'src/index.css must enforce min-height: 44px !important on .routine-block-item and routine slots'
);
console.log('✔ Test 3.4: Thumb-friendly Daily Routine tap targets (min-h-[44px]) verified');

// --------------------------------------------------------------------------
// SECTION 4: Theme Variable Integration & Onyx & Gold Adaptation
// --------------------------------------------------------------------------
console.log('\n--- SECTION 4: Theme Variables & Onyx & Gold Theme ---');

// 4.1 CSS Theme Variables in Bottom Nav & Mobile Cards
assert(
  styleCss.includes('var(--bg-sidebar)') &&
  styleCss.includes('var(--border-glow)') &&
  styleCss.includes('var(--primary)'),
  'style.css bottom nav must use CSS theme variables var(--bg-sidebar), var(--border-glow), var(--primary)'
);

assert(
  indexCss.includes('var(--bg-sidebar)') &&
  indexCss.includes('var(--border-glow)') &&
  indexCss.includes('var(--primary)'),
  'src/index.css bottom nav must use CSS theme variables var(--bg-sidebar), var(--border-glow), var(--primary)'
);

// 4.2 Onyx & Gold Theme Customizations
assert(
  styleCss.includes('[data-theme="black-gold"] #mobile-bottom-nav') &&
  styleCss.includes('#D8BC82') &&
  styleCss.includes('#FFFFFF'),
  'style.css must style Onyx & Gold mobile bottom nav with #D8BC82 background and #FFFFFF pure white border'
);

assert(
  indexCss.includes('[data-theme="black-gold"] #mobile-bottom-nav') &&
  indexCss.includes('#D8BC82'),
  'src/index.css must style Onyx & Gold mobile bottom nav with #D8BC82 background'
);

assert(
  indexHtml.includes('[data-theme="black-gold"] #mobile-bottom-nav') &&
  indexHtml.includes('#D8BC82'),
  'index.html head styles must style Onyx & Gold mobile bottom nav with #D8BC82 background'
);
console.log('✔ Test 4.1 & 4.2: CSS theme variables and Onyx & Gold (#D8BC82 & #FFFFFF) adaptation verified');

console.log('\n🎉 ALL MOBILE BOTTOM WORKSPACE NAV & SPACIOUS LAYOUT TESTS PASSED SUCCESSFULLY!\n');
