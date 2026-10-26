/**
 * Test Suite: Admin Portal Integration & Role-Based Access Control
 * Validates:
 * 1. ROLE_CONFIG & AdminAuth configuration in admin-config.js
 * 2. Left sidebar dedicated #sidebar-admin-link visibility logic
 * 3. admin.html existence in root and public/ with access gate
 * 4. Header bar title, Super Admin glowing purple badge, and ← Back to Workspace link
 * 5. Presence of all 5 modules (Template Studio, Announcement, Bug Triage, Kill Switches, Ban & Access)
 * 6. Global inclusion of <script src="admin-config.js"></script> across all HTML files
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Starting Admin Portal Integration & Role-Based Access Control Tests...\n');

let passedTests = 0;
let totalTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    Error: ${err.message}`);
  }
}

// 1. Mock LocalStorage and SessionStorage
const storageStore = new Map();
globalThis.localStorage = {
  getItem: (key) => storageStore.get(key) || null,
  setItem: (key, val) => storageStore.set(key, String(val)),
  removeItem: (key) => storageStore.delete(key),
  clear: () => storageStore.clear()
};

globalThis.sessionStorage = {
  getItem: (key) => storageStore.get('sess_' + key) || null,
  setItem: (key, val) => storageStore.set('sess_' + key, String(val)),
  removeItem: (key) => storageStore.delete('sess_' + key),
  clear: () => storageStore.clear()
};

// Import admin-config.js
const { ROLE_CONFIG, AdminAuth } = await import('../admin-config.js');

// 1. Check ROLE_CONFIG
it('ROLE_CONFIG contains kuldeepkumarncc2dbn@gmail.com in superAdmins', () => {
  assert(
    ROLE_CONFIG.superAdmins.map(e => e.toLowerCase()).includes('kuldeepkumarncc2dbn@gmail.com'),
    'kuldeepkumarncc2dbn@gmail.com must be in ROLE_CONFIG.superAdmins'
  );
});

it('ROLE_CONFIG contains friend_email@gmail.com in editors', () => {
  assert(
    ROLE_CONFIG.editors.map(e => e.toLowerCase()).includes('friend_email@gmail.com'),
    'friend_email@gmail.com must be in ROLE_CONFIG.editors'
  );
});

it('ROLE_CONFIG contains bannedUsers array', () => {
  assert(Array.isArray(ROLE_CONFIG.bannedUsers), 'bannedUsers must be an array');
});

// 2. Check AdminAuth methods
it('AdminAuth.getUserEmail() retrieves email from study_user_profile', () => {
  localStorage.setItem('study_user_profile', JSON.stringify({ email: 'Student1@example.com' }));
  assert.equal(AdminAuth.getUserEmail(), 'student1@example.com');
});

it('AdminAuth.getRole() returns "super_admin" for kuldeepkumarncc2dbn@gmail.com', () => {
  localStorage.setItem('study_user_profile', JSON.stringify({ email: 'kuldeepkumarncc2dbn@gmail.com' }));
  assert.equal(AdminAuth.getRole(), 'super_admin');
  assert.equal(AdminAuth.canAccessAdmin(), true);
  assert.equal(AdminAuth.isSuperAdmin(), true);
});

it('AdminAuth.getRole() returns "editor" for friend_email@gmail.com', () => {
  localStorage.setItem('study_user_profile', JSON.stringify({ email: 'friend_email@gmail.com' }));
  assert.equal(AdminAuth.getRole(), 'editor');
  assert.equal(AdminAuth.canAccessAdmin(), true);
  assert.equal(AdminAuth.isSuperAdmin(), false);
});

it('AdminAuth.getRole() returns "student" for regular students', () => {
  localStorage.setItem('study_user_profile', JSON.stringify({ email: 'regular.student@uni.edu' }));
  assert.equal(AdminAuth.getRole(), 'student');
  assert.equal(AdminAuth.canAccessAdmin(), false);
  assert.equal(AdminAuth.isSuperAdmin(), false);
});

it('AdminAuth.getRole() returns "guest" when no user is logged in', () => {
  localStorage.clear();
  assert.equal(AdminAuth.getRole(), 'guest');
  assert.equal(AdminAuth.canAccessAdmin(), false);
  assert.equal(AdminAuth.isSuperAdmin(), false);
});

// 3. Sidebar Integration
it('CollapsibleSidebar.jsx has dedicated #sidebar-admin-link at bottom with Shield icon and Admin Portal label', () => {
  const sidebarContent = fs.readFileSync(path.join(process.cwd(), 'src/components/CollapsibleSidebar.jsx'), 'utf-8');
  assert(sidebarContent.includes('id="sidebar-admin-link"'), 'Must have element with id="sidebar-admin-link"');
  assert(sidebarContent.includes('ShieldCheck'), 'Must have Shield icon');
  assert(sidebarContent.includes('Admin Portal'), 'Must have "Admin Portal" label');
  assert(sidebarContent.includes('admin.html'), 'Must link to admin.html');
  assert(sidebarContent.includes('display: hasAdminAccess ?'), 'Must hide when hasAdminAccess is false');
});

// 4. admin.html existence & structure
it('admin.html exists in root and in public/ directory', () => {
  assert(fs.existsSync(path.join(process.cwd(), 'admin.html')), 'Root admin.html must exist');
  assert(fs.existsSync(path.join(process.cwd(), 'public/admin.html')), 'public/admin.html must exist');
});

it('admin.html has immediate access gate redirecting to index.html with alert', () => {
  const rootAdmin = fs.readFileSync(path.join(process.cwd(), 'admin.html'), 'utf-8');
  const publicAdmin = fs.readFileSync(path.join(process.cwd(), 'public/admin.html'), 'utf-8');
  for (const content of [rootAdmin, publicAdmin]) {
    assert(content.includes('AdminAuth.canAccessAdmin()'), 'Must check AdminAuth.canAccessAdmin()');
    assert(content.includes('Access Denied: Administrator permissions required.'), 'Must include alert text');
    assert(content.includes('index.html?access_denied=admin') || content.includes('index.html'), 'Must redirect to index.html');
  }
});

it('AdminPortal.jsx header has "Study Tracker Pro — Admin Control Center", glowing purple Super Admin badge, and ← Back to Workspace', () => {
  const portalContent = fs.readFileSync(path.join(process.cwd(), 'src/components/AdminPortal.jsx'), 'utf-8');
  assert(portalContent.includes('Study Tracker Pro — Admin Control Center'), 'Must have exact header title');
  assert(portalContent.includes('bg-purple-600/20 text-purple-300'), 'Super Admin badge must be styled in glowing purple pill');
  assert(portalContent.includes('← Back to Workspace'), 'Must have "← Back to Workspace" link button');
});

it('AdminPortal.jsx implements all 5 core admin modules', () => {
  const portalContent = fs.readFileSync(path.join(process.cwd(), 'src/components/AdminPortal.jsx'), 'utf-8');
  // Module 1: Template Studio
  assert(portalContent.includes('Template Studio'), 'Module 1: Template Studio present');
  assert(portalContent.includes('handleAutoGenerateSubtopics'), 'Module 1: Skill roadmaps generator present');
  // Module 2: Global Announcement
  assert(portalContent.includes('Global Announcement'), 'Module 2: Global Announcement present');
  assert(portalContent.includes('platform_announcement'), 'Module 2: saves to platform_announcement');
  // Module 3: Bug Triage
  assert(portalContent.includes('Feedback & Bug Drawer'), 'Module 3: Bug Triage table present');
  assert(portalContent.includes('updateBugStatus'), 'Module 3: one-click status toggles present');
  // Module 4: Emergency Kill Switches
  assert(portalContent.includes('Emergency Controls'), 'Module 4: Emergency Kill Switches present');
  assert(portalContent.includes('Google Drive Sync Module') || portalContent.includes('driveSync'), 'Module 4: Drive sync switch present');
  assert(portalContent.includes('demoMode'), 'Module 4: Demo mode switch present');
  // Module 5: Ban list & Collaborators
  assert(portalContent.includes('Ban List Manager') || portalContent.includes('bannedUsers'), 'Module 5: Ban list present');
  assert(portalContent.includes('Collaborators'), 'Module 5: Collaborator management present');
});

// 5. Global inclusion in all HTML files
const HTML_FILES = [
  'index.html',
  'routine.html',
  'calendar.html',
  'syllabus.html',
  'revision.html',
  'radar.html',
  'skills.html',
  'notes.html',
  'timer.html',
  'login.html',
  'admin.html',
  'privacy.html'
];

it('All 12 HTML files include <script src="admin-config.js"></script> in <head>', () => {
  for (const filename of HTML_FILES) {
    const filePath = path.join(process.cwd(), filename);
    assert(fs.existsSync(filePath), `${filename} must exist`);
    const content = fs.readFileSync(filePath, 'utf-8');
    assert(
      content.includes('<script src="admin-config.js"></script>'),
      `${filename} must contain <script src="admin-config.js"></script> in <head>`
    );
  }
});

// Summary
console.log(`\n========================================`);
console.log(`Results: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests/totalTests)*100)}%)`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
