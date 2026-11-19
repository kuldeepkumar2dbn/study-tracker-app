import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('=== RUNNING FIXED SIDEBAR & MOBILE TWA LAYOUT TEST SUITE ===\n');

const rootDir = process.cwd();
const styleCss = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');
const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const appShell = fs.readFileSync(path.join(rootDir, 'src/components/AppShell.jsx'), 'utf8');
const collapsibleSidebar = fs.readFileSync(path.join(rootDir, 'src/components/CollapsibleSidebar.jsx'), 'utf8');
const leaderboardTab = fs.readFileSync(path.join(rootDir, 'src/components/tabs/LeaderboardTab.jsx'), 'utf8');
const sidebarMod = await import(`file://${path.join(rootDir, 'sidebar.js').replace(/\\/g, '/')}`);

// --------------------------------------------------------------------------
// SECTION 1: Pinned Sidebar & Single Scroll Container Architecture
// --------------------------------------------------------------------------
console.log('--- SECTION 1: Pinned Sidebar & Scroll Container Architecture ---');

// 1.1 Outer app container (.app-shell) locked at 100dvh with overflow: hidden
assert(
  appShell.includes('className="app-shell') &&
  (appShell.includes("100dvh") || appShell.includes("overflow-hidden")),
  'AppShell.jsx outer container must have .app-shell, 100dvh, and overflow-hidden'
);

assert(
  styleCss.includes('.app-shell') && styleCss.includes('100dvh') && styleCss.includes('overflow: hidden'),
  'style.css must enforce .app-shell with height: 100dvh and overflow: hidden'
);

assert(
  indexCss.includes('.app-shell') && indexCss.includes('100dvh') && indexCss.includes('overflow: hidden'),
  'src/index.css must enforce .app-shell with height: 100dvh and overflow: hidden'
);

assert(
  indexHtml.includes('.app-shell') && indexHtml.includes('100dvh') && indexHtml.includes('overflow: hidden'),
  'index.html must define .app-shell with height: 100dvh and overflow: hidden'
);
console.log('✔ Test 1.1: Outer app container (.app-shell) locked at height: 100dvh and overflow: hidden');

// 1.2 Pinned Left Sidebar (aside / .app-sidebar / #app-sidebar)
assert(
  collapsibleSidebar.includes('id="app-sidebar"') &&
  collapsibleSidebar.includes('app-sidebar') &&
  collapsibleSidebar.includes('100dvh'),
  'CollapsibleSidebar.jsx must set #app-sidebar with class app-sidebar and 100dvh'
);

assert(
  styleCss.includes('.app-sidebar') &&
  styleCss.includes('position: sticky') &&
  styleCss.includes('top: 0'),
  'style.css must pin .app-sidebar with position: sticky and top: 0'
);

assert(
  indexCss.includes('.app-sidebar') &&
  indexCss.includes('position: sticky') &&
  indexCss.includes('top: 0'),
  'src/index.css must pin .app-sidebar with position: sticky and top: 0'
);
console.log('✔ Test 1.2: Left sidebar (aside / .app-sidebar) pinned at height: 100dvh and sticky top: 0');

// 1.3 Right-side main content container (.app-scroll-area) scrolls vertically
assert(
  appShell.includes('app-scroll-area') &&
  appShell.includes('overflow-y-auto') &&
  appShell.includes('overflow-x-hidden'),
  'AppShell.jsx main-layout-wrapper must have .app-scroll-area, overflow-y-auto, and overflow-x-hidden'
);

assert(
  styleCss.includes('.app-scroll-area') &&
  styleCss.includes('overflow-y: auto') &&
  styleCss.includes('overflow-x: hidden'),
  'style.css must define .app-scroll-area with overflow-y: auto and overflow-x: hidden'
);

assert(
  indexCss.includes('.app-scroll-area') &&
  indexCss.includes('overflow-y: auto') &&
  indexCss.includes('overflow-x: hidden'),
  'src/index.css must define .app-scroll-area with overflow-y: auto and overflow-x: hidden'
);

// Sticky navbar inside .app-scroll-area
assert(
  appShell.includes('sticky top-0 z-40') && appShell.includes('<SharedHeader'),
  'Top navbar (SharedHeader) must be sticky top-0 inside the scroll area'
);
console.log('✔ Test 1.3: Right-side container (.app-scroll-area) scrolls vertically with sticky top navbar');

// --------------------------------------------------------------------------
// SECTION 2: Slide-Over Mobile Sidebar Drawer & Backdrop (< 768px)
// --------------------------------------------------------------------------
console.log('\n--- SECTION 2: Slide-Over Mobile Sidebar Drawer & Backdrop (< 768px) ---');

// 2.1 Off-canvas transform on screens < 768px
assert(
  styleCss.includes('transform: translateX(-100%)') &&
  styleCss.includes('@media (max-width: 767.98px)'),
  'style.css must hide sidebar off-canvas with transform: translateX(-100%) on < 768px'
);

assert(
  indexCss.includes('transform: translateX(-100%)') &&
  indexCss.includes('@media (max-width: 767.98px)'),
  'src/index.css must hide sidebar off-canvas with transform: translateX(-100%) on < 768px'
);

assert(
  collapsibleSidebar.includes('id="sidebar-backdrop"') &&
  collapsibleSidebar.includes('sidebar-backdrop'),
  'CollapsibleSidebar.jsx must render #sidebar-backdrop with .sidebar-backdrop class'
);

// 2.2 sidebar.js mobile drawer controller functions
assert(typeof sidebarMod.openMobileSidebar === 'function', 'sidebar.js must export openMobileSidebar()');
assert(typeof sidebarMod.closeMobileSidebar === 'function', 'sidebar.js must export closeMobileSidebar()');
assert(typeof sidebarMod.toggleMobileSidebar === 'function', 'sidebar.js must export toggleMobileSidebar()');
assert(typeof sidebarMod.isMobileSidebarOpen === 'function', 'sidebar.js must export isMobileSidebarOpen()');
assert(typeof sidebarMod.setupMobileSidebar === 'function', 'sidebar.js must export setupMobileSidebar()');

// 2.3 Verify runtime drawer toggle and auto-close
const mockSidebar = {
  classList: new Set(),
  style: {},
  setAttribute(k, v) { this[k] = v; },
  getAttribute(k) { return this[k]; }
};
mockSidebar.classList.add = function(...c) { c.forEach(x => Set.prototype.add.call(this, x)); };
mockSidebar.classList.remove = function(...c) { c.forEach(x => Set.prototype.delete.call(this, x)); };
mockSidebar.classList.contains = function(c) { return Set.prototype.has.call(this, c); };

const mockBackdrop = {
  classList: new Set(),
  style: {},
  setAttribute(k, v) { this[k] = v; }
};
mockBackdrop.classList.add = function(...c) { c.forEach(x => Set.prototype.add.call(this, x)); };
mockBackdrop.classList.remove = function(...c) { c.forEach(x => Set.prototype.delete.call(this, x)); };
mockBackdrop.classList.contains = function(c) { return Set.prototype.has.call(this, c); };

const mockDoc = {
  querySelector(sel) {
    if (sel.includes('app-sidebar')) return mockSidebar;
    if (sel.includes('sidebar-backdrop')) return mockBackdrop;
    return null;
  }
};

sidebarMod.openMobileSidebar(mockDoc);
assert(mockSidebar.classList.contains('mobile-open'), 'openMobileSidebar must add mobile-open class to sidebar');
assert(mockSidebar.style.transform === 'translateX(0)', 'openMobileSidebar must translate sidebar into view');
assert(mockBackdrop.style.display === 'block', 'openMobileSidebar must display backdrop');

sidebarMod.closeMobileSidebar(mockDoc);
assert(!mockSidebar.classList.contains('mobile-open'), 'closeMobileSidebar must remove mobile-open class');
assert(mockBackdrop.style.display === 'none', 'closeMobileSidebar must hide backdrop');
console.log('✔ Test 2.1: Slide-over mobile drawer off-canvas positioning, backdrop, and toggle controller verified');

// --------------------------------------------------------------------------
// SECTION 3: Clean Mobile Top Header (Single Row, No Wrapping)
// --------------------------------------------------------------------------
console.log('\n--- SECTION 3: Clean Mobile Top Header ---');

assert(
  appShell.includes('h-14') && appShell.includes('px-3') && appShell.includes('flex items-center justify-between gap-2'),
  'SharedHeader must format as single horizontal row with h-14, px-3, and gap-2'
);

assert(
  appShell.includes('id="sidebar-toggle-btn"') && appShell.includes('<Logo'),
  'Left header section must house Hamburger Toggle and Logo'
);

assert(
  appShell.includes('max-w-[90px]') && appShell.includes('truncate'),
  'Profile pill label must cap at max-w-[90px] on narrow screens to prevent wrapping'
);
console.log('✔ Test 3.1: Mobile top header layout (single horizontal row, compact controls, truncate max-w-[90px]) verified');

// --------------------------------------------------------------------------
// SECTION 4: Responsive Mobile Grids, Tables & Onyx & Gold Compatibility
// --------------------------------------------------------------------------
console.log('\n--- SECTION 4: Responsive Mobile Grids & Tables ---');

// 4.1 Leaderboard Top 3 Podium vertical stacking on mobile
assert(
  leaderboardTab.includes('grid-cols-1 md:grid-cols-3'),
  'LeaderboardTop 3 Podium must stack vertically on mobile (grid-cols-1 md:grid-cols-3)'
);

// 4.2 Table horizontal scroll protection
assert(
  leaderboardTab.includes('overflow-x-auto') && leaderboardTab.includes('w-full'),
  'Leaderboard table container must enforce w-full overflow-x-auto'
);

assert(
  styleCss.includes('.overflow-x-auto') && styleCss.includes('-webkit-overflow-scrolling: touch'),
  'style.css must include smooth touch horizontal scrolling for tables'
);

// 4.3 Onyx & Gold Drawer adaptation
assert(
  styleCss.includes('[data-theme="black-gold"] .app-sidebar') &&
  styleCss.includes('[data-theme="black-gold"] .sidebar-backdrop'),
  'style.css must include dedicated high-contrast Onyx & Gold rules for mobile drawer and backdrop'
);

assert(
  indexCss.includes('[data-theme="black-gold"] .app-sidebar') &&
  indexCss.includes('[data-theme="black-gold"] .sidebar-backdrop'),
  'src/index.css must include dedicated high-contrast Onyx & Gold rules for mobile drawer and backdrop'
);
console.log('✔ Test 4.1: Responsive grids, table overflow protection, and Onyx & Gold theme adaptation verified');

console.log('\n🎉 ALL FIXED SIDEBAR & MOBILE TWA LAYOUT TESTS PASSED SUCCESSFULLY!\n');
