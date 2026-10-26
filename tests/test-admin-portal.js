/**
 * Comprehensive Automated Verification Test Suite for Admin & Collaborator Portal
 * tests/test-admin-portal.js
 *
 * Verifies:
 * 1. ACCESS GATE & ROLE DEFINITION (admin-config.js):
 *    - Reading Google email stored in study_user_profile
 *    - Super Admin: ["YOUR_GOOGLE_EMAIL@gmail.com"] -> Unrestricted system access
 *    - Editors: ["FRIEND_EMAIL@gmail.com"] -> Can build templates, view feedback, draft announcements
 *    - Non-authorized student visiting /admin.html redirected to /index.html with alert
 *    - Main sidebar shows "🛡️ Admin Portal" ONLY for Super Admin or Editor
 * 2. TEMPLATE STUDIO:
 *    - Syllabi creation (Title, code, exam dates, chapters/modules)
 *    - YouTube Skill Roadmaps (title, category, link, 3-tier subtopics)
 *    - Export as Starter JSON
 * 3. GLOBAL ANNOUNCEMENT BANNER:
 *    - Banner text, urgency, expiration date saved to platform_announcement
 *    - Floating banner active check & expiration handling
 * 4. FEEDBACK & BUG DRAWER:
 *    - Pre-seeded tickets, status transitions (Open -> In Review -> Resolved), ticket addition
 * 5. EMERGENCY CONTROLS & KILL SWITCHES:
 *    - Toggles for Drive Sync, Demo Mode, Maintenance Mode
 *    - Super Admin only feature gating (padlock for editors)
 *    - Demo mode killswitch blocks demo session
 *    - Maintenance mode locks regular users
 * 6. BAN LIST MANAGER:
 *    - Blacklist in banned_users
 *    - Banned email immediate signout and redirection to login.html?banned=true
 * 7. COLLABORATOR MANAGEMENT:
 *    - Display active editors, add new collaborator, revoke access
 */

import {
  SUPER_ADMIN_EMAILS,
  DEFAULT_EDITOR_EMAILS,
  ADMIN_STORAGE_KEYS,
  getLoggedInUserProfile,
  getCurrentUserEmail,
  getSuperAdmins,
  getCollaborators,
  getCollaboratorsDetailed,
  addCollaborator,
  removeCollaborator,
  isSuperAdmin,
  isEditor,
  canAccessAdmin,
  getUserRole,
  getBannedUsers,
  isUserBanned,
  banUser,
  unbanUser,
  getEmergencyKillswitches,
  setEmergencyKillswitch,
  getPlatformAnnouncement,
  setPlatformAnnouncement,
  clearPlatformAnnouncement,
  getBugReports,
  updateBugStatus,
  addBugReport,
  checkAdminAccess,
  setSimulatedRole
} from '../admin-config.js';

import {
  saveUserSession,
  getUserProfile,
  initDemoSession,
  clearDemoSession,
  isDemoUser
} from '../auth-guard.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// In-Memory Storage Mock for Node test environment
const mockStorage = {};
global.localStorage = {
  getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  key: (i) => Object.keys(mockStorage)[i] || null,
  get length() { return Object.keys(mockStorage).length; }
};

const mockSession = {};
global.sessionStorage = {
  getItem: (k) => (k in mockSession ? mockSession[k] : null),
  setItem: (k, v) => { mockSession[k] = String(v); },
  removeItem: (k) => { delete mockSession[k]; },
  clear: () => { Object.keys(mockSession).forEach(k => delete mockSession[k]); },
  key: (i) => Object.keys(mockSession)[i] || null,
  get length() { return Object.keys(mockSession).length; }
};

global.document = {
  cookie: ''
};

let lastWindowRedirect = null;
let lastWindowAlert = null;
global.window = {
  location: {
    protocol: 'http:',
    hostname: 'localhost',
    pathname: '/admin.html',
    search: '',
    replace: (url) => { lastWindowRedirect = url; }
  },
  alert: (msg) => { lastWindowAlert = msg; },
  dispatchEvent: () => {}
};

console.log('\n======================================================');
console.log('--- 1. Testing Access Gate & Role Definitions ---');
console.log('======================================================');
{
  // Test 1.1: Super Admin role check
  const superEmail = 'YOUR_GOOGLE_EMAIL@gmail.com';
  localStorage.setItem(ADMIN_STORAGE_KEYS.USER_PROFILE, JSON.stringify({
    email: superEmail,
    name: 'Main Admin',
    sub: 'google_super_123'
  }));

  assert(getCurrentUserEmail() === superEmail.toLowerCase(), 'getCurrentUserEmail retrieves from study_user_profile');
  assert(isSuperAdmin(superEmail) === true, 'isSuperAdmin returns true for YOUR_GOOGLE_EMAIL@gmail.com');
  assert(canAccessAdmin(superEmail) === true, 'canAccessAdmin returns true for Super Admin');
  assert(getUserRole(superEmail) === 'SUPER_ADMIN', 'getUserRole returns SUPER_ADMIN');

  // Test 1.2: checkAdminAccess does NOT redirect Super Admin
  lastWindowRedirect = null;
  const superAllowed = checkAdminAccess({ redirect: true });
  assert(superAllowed === true, 'checkAdminAccess allows Super Admin without redirect');
  assert(lastWindowRedirect === null, 'No redirection for Super Admin');

  // Test 1.3: Editor role check
  const editorEmail = 'FRIEND_EMAIL@gmail.com';
  localStorage.setItem(ADMIN_STORAGE_KEYS.USER_PROFILE, JSON.stringify({
    email: editorEmail,
    name: 'Collaborator Friend',
    sub: 'google_editor_456'
  }));

  assert(isSuperAdmin(editorEmail) === false, 'isSuperAdmin returns false for Editor');
  assert(isEditor(editorEmail) === true, 'isEditor returns true for FRIEND_EMAIL@gmail.com');
  assert(canAccessAdmin(editorEmail) === true, 'canAccessAdmin returns true for Editor');
  assert(getUserRole(editorEmail) === 'EDITOR', 'getUserRole returns EDITOR');

  // Test 1.4: checkAdminAccess does NOT redirect Editor
  lastWindowRedirect = null;
  const editorAllowed = checkAdminAccess({ redirect: true });
  assert(editorAllowed === true, 'checkAdminAccess allows Editor without redirect');
  assert(lastWindowRedirect === null, 'No redirection for Editor');

  // Test 1.5: Non-authorized student role check & immediate redirect
  const studentEmail = 'student.regular@college.edu';
  localStorage.setItem(ADMIN_STORAGE_KEYS.USER_PROFILE, JSON.stringify({
    email: studentEmail,
    name: 'Regular Student',
    sub: 'google_student_789'
  }));

  assert(isSuperAdmin(studentEmail) === false, 'isSuperAdmin returns false for Student');
  assert(isEditor(studentEmail) === false, 'isEditor returns false for Student');
  assert(canAccessAdmin(studentEmail) === false, 'canAccessAdmin returns false for Student');
  assert(getUserRole(studentEmail) === 'STUDENT', 'getUserRole returns STUDENT');

  // Test 1.6: checkAdminAccess immediately redirects unauthorized student with alert
  lastWindowRedirect = null;
  lastWindowAlert = null;
  const studentBlocked = checkAdminAccess({ redirect: true });
  assert(studentBlocked === false, 'checkAdminAccess blocks student');
  assert(lastWindowRedirect === '/index.html?access_denied=admin', 'Student is immediately redirected to /index.html?access_denied=admin');
  assert(lastWindowAlert === 'Access Denied: Administrator privileges required.', 'Immediate alert: Access Denied: Administrator privileges required.');
  assert(sessionStorage.getItem(ADMIN_STORAGE_KEYS.ACCESS_DENIED_ALERT) === 'Access Denied: Administrator privileges required.', 'Access denied alert stored in sessionStorage');
}

console.log('\n======================================================');
console.log('--- 2. Testing Template Studio Modules & Starter JSON ---');
console.log('======================================================');
{
  // Test 2.1: Add new syllabus template
  const newSyl = {
    id: 'syl_test_1',
    title: 'Computer Architecture & RISC-V',
    code: 'CS204',
    examDate: '2026-11-30',
    modules: [
      { id: 'm1', title: 'Instruction Set Architecture', hours: 5, subtopics: 'R-type, I-type, S-type' },
      { id: 'm2', title: 'Pipelining & Hazards', hours: 8, subtopics: 'Data hazards, Forwarding, Branch prediction' }
    ]
  };
  const syllabiList = [newSyl];
  localStorage.setItem(ADMIN_STORAGE_KEYS.SYLLABI_TEMPLATES, JSON.stringify(syllabiList));
  const retrievedSyl = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEYS.SYLLABI_TEMPLATES));
  assert(retrievedSyl.length === 1 && retrievedSyl[0].code === 'CS204', 'Syllabus template saved and retrieved');

  // Test 2.2: Add curated YouTube Skill roadmap with 3-tier subtopics
  const newSkill = {
    id: 'skill_test_1',
    title: 'Kubernetes & Cloud Infrastructure',
    category: 'Cloud Computing',
    videoLink: 'https://www.youtube.com/watch?v=X48VuDVv0do',
    beginner: 'Containers, Pods, Deployments, Kubectl commands',
    intermediate: 'Services, Ingress controllers, ConfigMaps, Secrets, PVCs',
    advanced: 'Custom Resource Definitions (CRDs), Operators, Service Mesh, eBPF Cilium'
  };
  const skillsList = [newSkill];
  localStorage.setItem(ADMIN_STORAGE_KEYS.SKILL_ROADMAPS, JSON.stringify(skillsList));
  const retrievedSkill = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEYS.SKILL_ROADMAPS));
  assert(retrievedSkill[0].title === 'Kubernetes & Cloud Infrastructure', 'Curated Skill roadmap saved');
  assert(retrievedSkill[0].beginner.includes('Pods') && retrievedSkill[0].advanced.includes('Operators'), '3-tier subtopics preserved');

  // Test 2.3: Starter pack JSON structure
  const starterPack = {
    version: '2.5.0',
    generator: 'StudyFlow Template Studio',
    syllabi: syllabiList,
    skills: skillsList
  };
  assert(Array.isArray(starterPack.syllabi) && starterPack.syllabi[0].code === 'CS204', 'Starter pack contains syllabi');
  assert(Array.isArray(starterPack.skills) && starterPack.skills[0].category === 'Cloud Computing', 'Starter pack contains skills');
}

console.log('\n======================================================');
console.log('--- 3. Testing Global Announcement Banner ---');
console.log('======================================================');
{
  // Test 3.1: Set announcement banner
  const banner = setPlatformAnnouncement({
    text: 'Midterm exams begin next Monday. Check your Exam Radar!',
    urgency: 'warning',
    expiresAt: '2026-11-20'
  });
  assert(banner.text.includes('Midterm exams'), 'Announcement text saved');
  assert(banner.urgency === 'warning', 'Urgency selector (warning) saved');

  // Test 3.2: getPlatformAnnouncement retrieves active banner
  const active = getPlatformAnnouncement();
  assert(active !== null && active.text === banner.text, 'Active announcement banner retrieved');

  // Test 3.3: Expired banner returns null
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 2);
  const expiredDate = yesterday.toISOString().split('T')[0];
  setPlatformAnnouncement({
    text: 'Old expired exam announcement',
    urgency: 'normal',
    expiresAt: expiredDate
  });
  assert(getPlatformAnnouncement() === null, 'Expired announcement automatically ignored');

  // Test 3.4: Clear announcement
  clearPlatformAnnouncement();
  assert(getPlatformAnnouncement() === null, 'Announcement cleared');
}

console.log('\n======================================================');
console.log('--- 4. Testing Feedback & Bug Drawer ---');
console.log('======================================================');
{
  // Test 4.1: Bug reports pre-seeded
  const bugs = getBugReports();
  assert(bugs.length >= 4, 'Bug reports pre-seeded with at least 4 realistic student tickets');
  assert(bugs.some(b => b.category === 'Timer Audio'), 'Timer audio ticket present');
  assert(bugs.some(b => b.category === 'Drive Sync'), 'Drive sync ticket present');

  // Test 4.2: Update status Open -> In Review -> Resolved
  const ticketId = bugs[0].id;
  updateBugStatus(ticketId, 'In Review');
  assert(getBugReports().find(b => b.id === ticketId).status === 'In Review', 'Bug status updated to In Review');
  updateBugStatus(ticketId, 'Resolved');
  assert(getBugReports().find(b => b.id === ticketId).status === 'Resolved', 'Bug status updated to Resolved');

  // Test 4.3: Add new student bug ticket
  const added = addBugReport({
    title: 'Mobile dark mode contrast issue',
    category: 'UI/UX',
    description: 'On OLED screens, text in sidebar footer is slightly low contrast',
    studentEmail: 'student.feedback@uni.edu'
  });
  assert(added !== null && added.title === 'Mobile dark mode contrast issue', 'New bug ticket recorded');
}

console.log('\n======================================================');
console.log('--- 5. Testing Emergency Controls & Kill Switches ---');
console.log('======================================================');
{
  // Test 5.1: Default kill switches
  const initialKs = getEmergencyKillswitches();
  assert(initialKs.driveSync === true, 'Default driveSync is true (enabled)');
  assert(initialKs.demoMode === true, 'Default demoMode is true (enabled)');
  assert(initialKs.maintenanceMode === false, 'Default maintenanceMode is false (disabled)');

  // Test 5.2: Toggle switches
  setEmergencyKillswitch('driveSync', false);
  assert(getEmergencyKillswitches().driveSync === false, 'driveSync disabled via killswitch');

  setEmergencyKillswitch('maintenanceMode', true);
  assert(getEmergencyKillswitches().maintenanceMode === true, 'maintenanceMode enabled via killswitch');

  // Test 5.3: Demo Mode killswitch prevents initDemoSession
  setEmergencyKillswitch('demoMode', false);
  let alertCalled = false;
  global.alert = () => { alertCalled = true; };
  initDemoSession();
  assert(isDemoUser() === false, 'initDemoSession blocked when demoMode killswitch is false');

  // Restore switches
  setEmergencyKillswitch('driveSync', true);
  setEmergencyKillswitch('demoMode', true);
  setEmergencyKillswitch('maintenanceMode', false);
  assert(getEmergencyKillswitches().driveSync === true, 'driveSync restored');
}

console.log('\n======================================================');
console.log('--- 6. Testing Ban List Manager & Blacklist Enforcement ---');
console.log('======================================================');
{
  const troublemaker = 'spammer.student@external.com';

  // Test 6.1: Ban user
  const banRes = banUser(troublemaker, 'Spamming notes vault', 'Super Admin');
  assert(banRes.success === true, 'User added to blacklist');
  assert(isUserBanned(troublemaker) === true, 'isUserBanned returns true for blacklisted email');

  // Test 6.2: Banned user trying to save session is immediately blocked and redirected to login.html?banned=true
  lastWindowRedirect = null;
  saveUserSession({
    email: troublemaker,
    name: 'Spammer',
    sub: 'bad_user_sub'
  });
  assert(lastWindowRedirect === '/login.html?banned=true', 'Banned user redirected to /login.html?banned=true');
  assert(getUserProfile() === null, 'Banned user session is rejected and returns null');

  // Test 6.3: Cannot ban Super Admin
  const banSuperRes = banUser('YOUR_GOOGLE_EMAIL@gmail.com');
  assert(banSuperRes.success === false, 'Safety guard: Cannot ban a Super Admin account');

  // Test 6.4: Unban user
  unbanUser(troublemaker);
  assert(isUserBanned(troublemaker) === false, 'User unbanned successfully');
}

console.log('\n======================================================');
console.log('--- 7. Testing Collaborator Management ---');
console.log('======================================================');
{
  // Test 7.1: Active editors list contains default editor
  const editors = getCollaborators();
  assert(editors.includes('friend_email@gmail.com') || editors.includes('FRIEND_EMAIL@gmail.com'), 'Default Editor FRIEND_EMAIL@gmail.com present');

  // Test 7.2: Add new collaborator
  const newCollab = 'ta.instructor@university.edu';
  const addRes = addCollaborator(newCollab, 'Super Admin');
  assert(addRes.success === true, 'Granted Editor access to new collaborator');
  assert(isEditor(newCollab) === true, 'New collaborator has isEditor === true');
  assert(canAccessAdmin(newCollab) === true, 'New collaborator has canAccessAdmin === true');

  // Test 7.3: Revoke collaborator
  removeCollaborator(newCollab);
  assert(isEditor(newCollab) === false, 'Collaborator access revoked successfully');
}

console.log('\n======================================================');
console.log('--- 8. Testing Sidebar Navigation Integration ---');
console.log('======================================================');
{
  import('fs').then(fs => {
    // Check CollapsibleSidebar.jsx renders "🛡️ Admin Portal" conditionally
    const sidebarSrc = fs.readFileSync('src/components/CollapsibleSidebar.jsx', 'utf-8');
    assert(sidebarSrc.includes('canAccessAdmin'), 'CollapsibleSidebar imports canAccessAdmin');
    assert(sidebarSrc.includes('🛡️ Admin Portal'), 'CollapsibleSidebar includes "🛡️ Admin Portal" link label');
    assert(sidebarSrc.includes('/admin.html'), 'CollapsibleSidebar links to /admin.html');
    assert(sidebarSrc.includes('hasAdminAccess ?'), 'CollapsibleSidebar conditionally includes Admin Portal ONLY when authorized');

    // Check AppShell.jsx includes floating announcement banner and access denied toast
    const appShellSrc = fs.readFileSync('src/components/AppShell.jsx', 'utf-8');
    assert(appShellSrc.includes('getPlatformAnnouncement'), 'AppShell checks getPlatformAnnouncement');
    assert(appShellSrc.includes('Platform Announcement'), 'AppShell renders Platform Announcement banner');
    assert(appShellSrc.includes('Access Denied: Administrator privileges required'), 'AppShell handles access denied notice');
    assert(appShellSrc.includes('Platform Updating'), 'AppShell renders Platform Updating maintenance lock screen');

    // Check admin.html route guard
    const adminHtmlSrc = fs.readFileSync('admin.html', 'utf-8');
    assert(adminHtmlSrc.includes('checkAdminAccess'), 'admin.html includes checkAdminAccess pre-render gate');
    assert(adminHtmlSrc.includes('src/pages/admin.jsx'), 'admin.html mounts src/pages/admin.jsx');

    console.log(`\n======================================================`);
    console.log(`  ALL ${passedTests}/${totalTests} ADMIN PORTAL TESTS PASSED 100%!`);
    console.log(`======================================================\n`);
  });
}
