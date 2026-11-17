/**
 * Test Suite: UI Declutter & Minimalist Organization Refactor
 * tests/test-ui-declutter-refactor.js
 *
 * Verifies:
 * 1. Streamlined Top Header (Logo + Sidebar Toggle on left; Sync Status Pill, Tools Popover, Theme Dropdown, @username Profile Pill on right)
 * 2. Sidebar organized into 3 clean groups (DAILY FLOW, EXAM PREP, GROWTH & SYNC) with subtle micro-headers & minimal 🔒 icons
 * 3. Decluttered Dashboard (standalone Theme bar removed; collapsible 1-line AI Study Coach & Burnout Diagnostics; space-y-6 rhythm)
 * 4. Mock Logbook Sub-Tabs (📊 Overview & History vs. ➕ Log New Mock Test) and zero sample mock seed data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
}

console.log('\n=== RUNNING UI DECLUTTER & ORGANIZATION REFACTOR TEST SUITE ===\n');

// -------------------------------------------------------------
// SECTION 1: Streamlined Top Header & Profile Theme / Sign Out
// -------------------------------------------------------------
console.log('--- SECTION 1: Streamlined Top Header ---');

const appShell = fs.readFileSync(path.join(rootDir, 'src', 'components', 'AppShell.jsx'), 'utf8');
assert(appShell.includes('id="sidebar-toggle-btn"') && appShell.includes('<Logo />'), 'Header left must keep Sidebar Toggle and Logo');
assert(appShell.includes('id="header-sync-status-pill"') && appShell.includes('🟢 Synced'), 'Header right must render Compact Sync Status Pill (🟢 Synced)');
assert(appShell.includes('id="header-tools-popover-btn"') && appShell.includes('id="header-tools-popover-menu"'), 'Header must consolidate Reminders and Quick Links into Tools ▾ popover');
assert(appShell.includes('id="notification-reminder-toggle"') && appShell.includes('id="header-quick-links-btn"'), 'Tools popover must contain Reminders and Quick Links');
assert(appShell.includes('id="header-theme-dropdown-btn"'), 'Header right must render Theme Dropdown Selector');
assert(appShell.includes('id="header-profile-pill"') && appShell.includes('data-target-view="profile"'), 'Header right must render @username Profile Pill opening #view-profile');
assert(!appShell.includes('streak-flame-badge'), 'Standalone top-header streak badge must be removed for header decluttering');

const profileTab = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'ProfileTab.jsx'), 'utf8');
assert(profileTab.includes('id="profile-theme-switcher"'), 'My Profile must include Color Theme Selector');
assert(profileTab.includes('id="profile-signout-btn"'), 'My Profile must house Sign Out button');
console.log('✔ Test 1.1: Streamlined Top Header (Sync Pill, Tools ▾ Popover, Theme Dropdown, @username Pill) and Profile Theme/Sign Out verified');

// -------------------------------------------------------------
// SECTION 2: 3 Clean Sidebar Groups & Minimal 🔒 Icons
// -------------------------------------------------------------
console.log('\n--- SECTION 2: 3 Clean Sidebar Groups & Minimal 🔒 Icons ---');

const sidebarMod = await import(`file://${path.join(rootDir, 'sidebar.js').replace(/\\/g, '/')}`);
assert(Array.isArray(sidebarMod.SIDEBAR_GROUPS) && sidebarMod.SIDEBAR_GROUPS.length === 3, 'sidebar.js must export exactly 3 SIDEBAR_GROUPS');

const [g1, g2, g3] = sidebarMod.SIDEBAR_GROUPS;
assert(g1.label === 'DAILY FLOW', 'Group 1 must be DAILY FLOW');
assert(g1.items.map((i) => i.id).join(',') === 'dashboard,timer,routine,calendar', 'DAILY FLOW items must be Dashboard, Focus Timer, Daily Routine, Calendar');

assert(g2.label === 'EXAM PREP', 'Group 2 must be EXAM PREP');
assert(g2.items.map((i) => i.id).join(',') === 'syllabus,revision,mock-logbook,radar', 'EXAM PREP items must be Subjects & Syllabus, Revision Queue, Mock Logbook, Exam Radar');

assert(g3.label === 'GROWTH & SYNC', 'Group 3 must be GROWTH & SYNC');
assert(g3.items.map((i) => i.id).join(',') === 'skills,leaderboard,notes,profile', 'GROWTH & SYNC items must be Skill Tracker, Leaderboard, Drive Notes, My Profile');

const collapsibleSidebar = fs.readFileSync(path.join(rootDir, 'src', 'components', 'CollapsibleSidebar.jsx'), 'utf8');
assert(collapsibleSidebar.includes('text-[10px]') && collapsibleSidebar.includes('uppercase') && collapsibleSidebar.includes('tracking-wider') && collapsibleSidebar.includes('opacity-50'), 'Sidebar micro-headers must use subtle low-contrast typography');
assert(collapsibleSidebar.includes('🔒') && !collapsibleSidebar.includes('>Locked<'), 'Bulky orange LOCKED badges must be replaced with minimal 🔒 icon');
console.log('✔ Test 2.1: 3 Sidebar Groups (DAILY FLOW, EXAM PREP, GROWTH & SYNC) and minimal 🔒 icons verified');

// -------------------------------------------------------------
// SECTION 3: Decluttered Dashboard & Collapsible AI Study Coach
// -------------------------------------------------------------
console.log('\n--- SECTION 3: Decluttered Dashboard & Collapsible AI Study Coach ---');

const dashboardTab = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'DashboardTab.jsx'), 'utf8');
assert(!dashboardTab.includes('id="dashboard-theme-switcher"'), 'Standalone 6-button Select Color Theme bar must be removed from Dashboard canvas');
assert(dashboardTab.includes('id="ai-coach-diagnostics-card"'), 'Dashboard must include AI Study Coach & Burnout Diagnostics card');
assert(dashboardTab.includes('useState(false)') && dashboardTab.includes('Expand Diagnostics ▾'), 'AI Study Coach must default to collapsed 1-line insight bar with Expand Diagnostics ▾ button');
assert(dashboardTab.includes('space-y-6'), 'Dashboard must keep airy space-y-6 vertical rhythm');
console.log('✔ Test 3.1: Dashboard decluttering and collapsible 1-line AI Study Coach verified');

// -------------------------------------------------------------
// SECTION 4: Mock Logbook Sub-Tabs & Zero Sample Data
// -------------------------------------------------------------
console.log('\n--- SECTION 4: Mock Logbook Sub-Tabs & Zero Sample Data ---');

const mockTab = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'MockLogbookTab.jsx'), 'utf8');
assert(mockTab.includes('id="mock-logbook-subtabs"'), 'MockLogbookTab must render sub-tab toggle bar');
assert(mockTab.includes('id="mock-subtab-overview"') && mockTab.includes('📊 Overview &amp; History'), 'Must render 📊 Overview & History sub-tab');
assert(mockTab.includes('id="mock-subtab-log"') && mockTab.includes('➕ Log New Mock Test'), 'Must render ➕ Log New Mock Test sub-tab');
assert(!mockTab.includes('mock-sample-1') && !mockTab.includes('GATE Full Length Mock #01'), 'MockLogbookTab must not seed hardcoded sample mock test');
console.log('✔ Test 4.1: Mock Logbook sub-tabs (Overview & History / Log New Mock Test) and zero sample data verified');

console.log('\n=== ALL UI DECLUTTER & ORGANIZATION TESTS PASSED SUCCESSFULLY! ===\n');

