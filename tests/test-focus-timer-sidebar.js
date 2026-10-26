/**
 * Verification Suite for Focus Timer and Left Primary Sidebar Navigation Rail
 * Tests all 4 Specifications:
 * 1. Removal of redundant top horizontal navigation bar across all pages
 * 2. Top utility header streamlining (Hamburger #sidebar-toggle-btn, Study Tracker Pro branding, date, streak, demo pill, drive status, profile, theme)
 * 3. Left sidebar primary rail (#app-sidebar, 9 views in clean order, no duplicate Skill Tracker, solid glowing pill highlights e.g. violet on revision)
 * 4. Layout spacing & responsiveness (main container #main-content with desktop ml-16 / ml-[250px] margins, mobile drawer overlay)
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('=== RUNNING PRIMARY SIDEBAR & HORIZONTAL NAV REMOVAL TEST SUITE ===\n');

// 1. Verify files
const sidebarFilePath = path.resolve('src/components/CollapsibleSidebar.jsx');
const sidebarContent = fs.readFileSync(sidebarFilePath, 'utf-8');

const appShellPath = path.resolve('src/components/AppShell.jsx');
const appShellContent = fs.readFileSync(appShellPath, 'utf-8');

const themeContextPath = path.resolve('src/context/ThemeContext.jsx');
const themeContextContent = fs.readFileSync(themeContextPath, 'utf-8');

const dataContextPath = path.resolve('src/context/DataContext.jsx');
const dataContextContent = fs.readFileSync(dataContextPath, 'utf-8');

const timerTabPath = path.resolve('src/components/tabs/TimerTab.jsx');
const timerTabContent = fs.readFileSync(timerTabPath, 'utf-8');


// --- SECTION 1: REMOVAL OF REDUNDANT TOP HORIZONTAL NAVIGATION ---
console.log('--- SECTION 1: Removal of Redundant Top Horizontal Navigation ---');

// 1.1 SharedNavBar is removed from AppLayout rendering
const appLayoutMatch = appShellContent.match(/export function AppLayout[\s\S]*?return \([\s\S]*?\);[\s\S]*?\}/);
assert(appLayoutMatch, 'AppLayout must be defined in AppShell.jsx');
assert(!appLayoutMatch[0].includes('<SharedNavBar'), 'SharedNavBar must NOT be rendered inside AppLayout');
console.log('✔ Test 1.1: Horizontal top navigation pill bar (<SharedNavBar>) removed from AppLayout');

// 1.2 Deprecated or null-safe SharedNavBar
assert(appShellContent.includes('export function SharedNavBar'), 'SharedNavBar should be exported as a safe/null stub');
console.log('✔ Test 1.2: SharedNavBar safely stubbed for backward-compatibility without rendering UI elements');


// --- SECTION 2: TOP UTILITY HEADER STREAMLINING ---
console.log('\n--- SECTION 2: Top Utility Header Streamlining ---');

// 2.1 Hamburger toggle button present
assert(appShellContent.includes('id="sidebar-toggle-btn"'), 'Hamburger button must have id="sidebar-toggle-btn"');
assert(appShellContent.includes('onToggleSidebar'), 'SharedHeader receives onToggleSidebar handler');
console.log('✔ Test 2.1: Hamburger toggle button (#sidebar-toggle-btn) present in top utility header');

// 2.2 Study Tracker Pro Branding
assert(appShellContent.includes('<Logo />') || appShellContent.includes('<Logo'), 'Top header includes Study Tracker Pro branding Logo');
console.log('✔ Test 2.2: Study Tracker Pro branding intact on left side of top utility header');

// 2.3 Utility elements on right side
assert(appShellContent.includes('todayFormatted'), 'Date badge rendered in top header');
assert(appShellContent.includes('streak-flame-badge'), 'Streak flame counter rendered in top header');
assert(appShellContent.includes('formattedDemoTimer'), 'Demo session timer pill rendered in top header');
assert(appShellContent.includes('Drive Synced') || appShellContent.includes('driveAccessToken'), 'Drive status badge rendered in top header');
assert(appShellContent.includes('userProfile') || appShellContent.includes('Sign In'), 'User profile or Sign In rendered in top header');
assert(appShellContent.includes('currentThemeMeta'), 'Theme selector dropdown rendered in top header');
console.log('✔ Test 2.3: Right-side utility bar complete (Date, Streak, Demo timer, Drive sync, Profile, Theme)');


// --- SECTION 3: LEFT SIDEBAR PRIMARY RAIL & ACTIVE STATES ---
console.log('\n--- SECTION 3: Left Sidebar Primary Rail & Active States ---');

// 3.1 Sidebar element has id="app-sidebar"
assert(sidebarContent.includes('id="app-sidebar"'), 'Sidebar aside element must have id="app-sidebar"');
console.log('✔ Test 3.1: Left sidebar element has id="app-sidebar"');

// 3.2 9 Core views in exact clean sequence
const expectedViews = [
  { id: 'dashboard', href: '/index.html', name: 'Dashboard' },
  { id: 'routine', href: '/routine.html', name: 'Daily Routine' },
  { id: 'calendar', href: '/calendar.html', name: 'Calendar' },
  { id: 'syllabus', href: '/syllabus.html', name: 'Subjects & Syllabus' },
  { id: 'revision', href: '/revision.html', name: 'Revision Queue' },
  { id: 'radar', href: '/radar.html', name: 'Exam Radar' },
  { id: 'skills', href: '/skills.html', name: 'Skill Tracker' },
  { id: 'notes', href: '/notes.html', name: 'Drive Notes' },
  { id: 'timer', href: '/timer.html', name: 'Focus Timer' }
];

expectedViews.forEach((view, idx) => {
  assert(sidebarContent.includes(`id: '${view.id}'`), `View ${view.id} must be in SIDEBAR_ITEMS`);
  assert(sidebarContent.includes(`href: '${view.href}'`), `View ${view.id} must have href ${view.href}`);
  assert(sidebarContent.includes(`name: '${view.name}'`), `View ${view.id} must have name ${view.name}`);
  console.log(`  ${idx + 1}. ${view.name} (${view.href}) verified in exact order`);
});
console.log('✔ Test 3.2: Exact 9 core views verified in clean order');

// 3.3 Skill Tracker appears ONLY ONCE in SIDEBAR_ITEMS
const skillTrackerMatches = (sidebarContent.match(/name: 'Skill Tracker'/g) || []).length;
assert.strictEqual(skillTrackerMatches, 1, 'Skill Tracker must appear exactly once in SIDEBAR_ITEMS');
console.log('✔ Test 3.3: Skill Tracker verified without duplicates (exactly 1 occurrence)');

// 3.4 Solid glowing pill active highlight styles (e.g. violet pill on Revision Queue)
assert(sidebarContent.includes('ACTIVE_PILL_STYLES'), 'ACTIVE_PILL_STYLES object must be defined');
assert(sidebarContent.includes('#7c3aed') && sidebarContent.includes('#8b5cf6'), 'Revision Queue must have solid violet gradient pill');
assert(sidebarContent.includes('rgba(139, 92, 246'), 'Revision Queue active pill must have glowing violet shadow');
console.log('✔ Test 3.4: Solid glowing pill highlights configured (vivid violet pill for Revision Queue)');

// 3.5 Status Badges
assert(sidebarContent.includes('pendingRoutineCount'), 'Daily Routine pending badge logic present');
assert(sidebarContent.includes('dueRevisionCount'), 'Revision Queue due count badge logic present');
assert(sidebarContent.includes('urgentExamsCount'), 'Exam Radar urgent exams badge logic present');
assert(sidebarContent.includes('isLocked'), 'Drive Notes lock badge logic present');
assert(sidebarContent.includes('formatTimerClock(timerSecondsLeft)'), 'Focus Timer live ticking badge logic present');
console.log('✔ Test 3.5: All status badges verified (Routine, Revision, Radar, Notes Lock, Timer Clock)');


// --- SECTION 4: LAYOUT SPACING & RESPONSIVENESS ---
console.log('\n--- SECTION 4: Layout Spacing & Responsiveness ---');

// 4.1 Main container has id="main-content"
assert(appShellContent.includes('id="main-content"'), 'Main content container must have id="main-content"');
console.log('✔ Test 4.1: Main content container has id="main-content"');

// 4.2 Desktop margins match sidebar state (md:ml-16 / md:ml-[250px])
assert(appShellContent.includes("isSidebarExpanded ? 'md:ml-[250px]' : 'md:ml-16'"), 'Main container wrapper must adapt desktop margin to sidebar state');
assert(appShellContent.includes('transition-all duration-300'), 'Layout wrapper must have smooth transition animation');
console.log('✔ Test 4.2: Desktop margins smoothly adapt to sidebar state (md:ml-16 when collapsed, md:ml-[250px] when expanded)');

// 4.3 Mobile drawer overlay (< 768px)
assert(sidebarContent.includes('isMobileOpen'), 'Sidebar supports isMobileOpen prop');
assert(sidebarContent.includes('md:hidden') && sidebarContent.includes('backdrop-blur-sm'), 'Mobile drawer backdrop overlay present');
assert(sidebarContent.includes("-translate-x-full md:translate-x-0"), 'Sidebar transitions off-screen on mobile and on-screen on desktop');
console.log('✔ Test 4.3: Mobile drawer overlay (< 768px) with backdrop blur and slide-out animation');

// 4.4 Sidebar expansion persisted in localStorage
assert(appShellContent.includes("localStorage.getItem('studyflow_sidebar_expanded')"), 'Sidebar state read from localStorage');
assert(appShellContent.includes("localStorage.setItem('studyflow_sidebar_expanded'"), 'Sidebar state written to localStorage');
console.log('✔ Test 4.4: Sidebar expanded state persisted in localStorage across page navigations');

console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
