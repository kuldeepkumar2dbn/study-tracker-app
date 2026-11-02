import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('--- STARTING FULL-WIDTH DASHBOARD LAYOUT TEST SUITE ---\n');

const appShellPath = path.resolve(process.cwd(), 'src/components/AppShell.jsx');
const appJsxPath = path.resolve(process.cwd(), 'src/App.jsx');
const dashboardTabPath = path.resolve(process.cwd(), 'src/components/tabs/DashboardTab.jsx');
const collapsibleSidebarPath = path.resolve(process.cwd(), 'src/components/CollapsibleSidebar.jsx');
const styleCssPath = path.resolve(process.cwd(), 'style.css');
const indexCssPath = path.resolve(process.cwd(), 'src/index.css');
const indexHtmlPath = path.resolve(process.cwd(), 'index.html');

const appShellCode = fs.readFileSync(appShellPath, 'utf8');
const appJsxCode = fs.readFileSync(appJsxPath, 'utf8');
const dashboardTabCode = fs.readFileSync(dashboardTabPath, 'utf8');
const sidebarCode = fs.readFileSync(collapsibleSidebarPath, 'utf8');
const styleCss = fs.readFileSync(styleCssPath, 'utf8');
const indexCss = fs.readFileSync(indexCssPath, 'utf8');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// 1. INSPECT WRAPPER HIERARCHY: No restrictive centering or max-width on #main-content
console.log('1. Checking wrapper hierarchy: centering and width restrictions removed...');

// Ensure max-w-7xl and mx-auto are NOT on #main-content
assert(
  !appShellCode.includes('id="main-content" className="flex-1 max-w-7xl') &&
  !appShellCode.includes('id="main-content"\n            className="flex-1 max-w-7xl'),
  'AppShell.jsx should not have max-w-7xl on #main-content'
);

assert(
  !appJsxCode.includes('id="main-content" className="flex-1 max-w-7xl'),
  'App.jsx should not have max-w-7xl on #main-content'
);

// Ensure #main-content has w-full and max-w-none
assert(
  appShellCode.includes('id="main-content"') &&
  appShellCode.includes('max-w-none') &&
  appShellCode.includes('w-full'),
  'AppShell.jsx #main-content must have w-full and max-w-none'
);

assert(
  appJsxCode.includes('id="main-content"') &&
  appJsxCode.includes('max-w-none') &&
  appJsxCode.includes('w-full'),
  'App.jsx #main-content must have w-full and max-w-none'
);

console.log('✓ 1. WRAPPER HIERARCHY: max-w-7xl and mx-auto removed; w-full and max-w-none applied');

// 2. APPLY FULL-WIDTH FLEXBOX: Outer shell, sidebar shrink-0, main flex: 1 1 0% and padding 1.5rem
console.log('2. Checking full-width flexbox styles...');

// Outer shell in AppShell.jsx
assert(
  appShellCode.includes('min-h-screen flex flex-col w-full'),
  'AppShell.jsx outer shell must have min-h-screen, flex, and w-full'
);

// Sidebar has shrink-0
assert(
  sidebarCode.includes('id="app-sidebar"') && sidebarCode.includes('shrink-0'),
  'CollapsibleSidebar.jsx must set #app-sidebar to shrink-0'
);

// #main-content has padding 1.5rem (p-6)
assert(
  appShellCode.includes('id="main-content"') && appShellCode.includes('p-6'),
  'AppShell.jsx #main-content must have padding 1.5rem (p-6)'
);

// CSS rules in style.css and src/index.css
const cssRulePattern = /#main-content,\s*main\s*\{[^}]*flex:\s*1\s+1\s+0%[^}]*width:\s*100%[^}]*padding:\s*1\.5rem/s;
assert(
  cssRulePattern.test(styleCss),
  'style.css must define #main-content, main with flex: 1 1 0%, width: 100%, and padding: 1.5rem'
);
assert(
  cssRulePattern.test(indexCss),
  'src/index.css must define #main-content, main with flex: 1 1 0%, width: 100%, and padding: 1.5rem'
);

// CSS rule for #app-sidebar shrink-0
assert(
  styleCss.includes('#app-sidebar') && styleCss.includes('flex-shrink: 0'),
  'style.css must define #app-sidebar with flex-shrink: 0'
);
assert(
  indexCss.includes('#app-sidebar') && indexCss.includes('flex-shrink: 0'),
  'src/index.css must define #app-sidebar with flex-shrink: 0'
);

console.log('✓ 2. FULL-WIDTH FLEXBOX: Outer shell flex/w-full, sidebar shrink-0, main flex: 1 1 0% with padding: 1.5rem');

// 3. ZERO DEAD COLUMN: Main layout wrapper offset matches sidebar width
console.log('3. Checking zero dead column between sidebar and main view...');

assert(
  appShellCode.includes("isSidebarExpanded ? 'md:ml-[250px]' : 'md:ml-16'"),
  'AppShell.jsx main-layout-wrapper must smoothly track sidebar width'
);

// Ensure no redundant oversized offsets like ml-80, ml-96, pl-80, or gap-16
assert(!appShellCode.includes('ml-80'), 'Should not contain ml-80');
assert(!appShellCode.includes('ml-96'), 'Should not contain ml-96');
assert(!appShellCode.includes('pl-80'), 'Should not contain pl-80');
assert(!appShellCode.includes('gap-16'), 'Should not contain gap-16 layout offset');

console.log('✓ 3. ZERO DEAD COLUMN: Main content begins immediately at the sidebar right border without gap');

// 4. GRID ADAPTABILITY: Card rows responsive grid with w-full
console.log('4. Checking KPI card rows grid adaptability & card widths...');

assert(
  dashboardTabCode.includes('w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4') ||
  dashboardTabCode.includes('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full'),
  'DashboardTab.jsx KPI card rows must use w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'
);

// Ensure the 4 key cards are inside the grid
assert(dashboardTabCode.includes('Daily Target'), 'KPI grid contains Daily Target card');
assert(dashboardTabCode.includes('Active Streak'), 'KPI grid contains Active Streak card');
assert(dashboardTabCode.includes('Next Deadline'), 'KPI grid contains Next Deadline card');
assert(dashboardTabCode.includes('Revision Queue'), 'KPI grid contains Revision Queue card');

// Verify all 4 cards have w-full min-w-0 flex flex-col justify-between
const cardMatches = (dashboardTabCode.match(/w-full min-w-0 flex flex-col justify-between/g) || []).length;
assert(
  cardMatches >= 4,
  `All 4 stat metric cards must have 'w-full min-w-0 flex flex-col justify-between', found ${cardMatches}`
);

// Ensure no restrictive individual card widths on stat cards
const kpiGridSection = dashboardTabCode.substring(
  dashboardTabCode.indexOf('KPI Cards Grid'),
  dashboardTabCode.indexOf('Consistency Radar')
);
assert(!kpiGridSection.includes('w-64'), 'KPI cards should not have w-64');
assert(!kpiGridSection.includes('w-72'), 'KPI cards should not have w-72');
assert(!kpiGridSection.includes('max-w-xs'), 'KPI cards should not have max-w-xs');
assert(!kpiGridSection.includes('max-w-sm'), 'KPI cards should not have max-w-sm');

console.log('✓ 4. GRID ADAPTABILITY: All 4 KPI cards stretch proportionally with w-full min-w-0 flex flex-col justify-between in a 4-column row');

// 5. THEME SELECTOR BAR: Evenly distributed 5-column grid across full width
console.log('5. Checking "Select Color Theme" bar layout & button styles...');

assert(
  dashboardTabCode.includes('w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5'),
  'dashboard-theme-switcher must use w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5'
);

assert(
  dashboardTabCode.includes('w-full flex-1 flex items-center justify-center text-center truncate'),
  'Theme pill buttons must have w-full flex-1 flex items-center justify-center text-center truncate'
);

assert(
  dashboardTabCode.includes('<span className="truncate">{t.name}</span>'),
  'Theme pill button labels must have truncate class'
);

const themeSwitcherSection = dashboardTabCode.substring(
  dashboardTabCode.indexOf('Theme Switcher Controller Bar'),
  dashboardTabCode.indexOf('KPI Cards Grid')
);
assert(!themeSwitcherSection.includes('max-w-'), 'Theme switcher must have no width caps');

console.log('✓ 5. THEME SELECTOR: 5-column even distribution with w-full, centered content, and truncate styling');

console.log('\nAll layout gap, 4-column quick-stat card, and theme selector tests passed successfully!\n');

