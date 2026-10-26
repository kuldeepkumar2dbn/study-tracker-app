/**
 * Admin & Collaborator Configuration, Access Gate & Role Definitions
 * Study Tracker Pro (admin-config.js)
 *
 * Implements:
 * - ROLE_CONFIG & AdminAuth
 * - Role Definitions: Super Admin & Editors
 * - Access Gate & Route Guard for admin.html
 * - Collaborator Management
 * - Ban List Manager (bannedUsers)
 * - Emergency Controls & Kill Switches
 * - Global Platform Announcement Banner
 * - Student Feedback & Bug Reports Drawer
 */

export const ROLE_CONFIG = {
  superAdmins: [
    "kuldeepkumarncc2dbn@gmail.com",
    "YOUR_GOOGLE_EMAIL@gmail.com"
  ],
  editors: [
    "friend_email@gmail.com",
    "FRIEND_EMAIL@gmail.com"
  ],
  bannedUsers: []
};

export const SUPER_ADMIN_EMAILS = ROLE_CONFIG.superAdmins;
export const DEFAULT_EDITOR_EMAILS = ROLE_CONFIG.editors;

export const ADMIN_STORAGE_KEYS = {
  USER_PROFILE: 'study_user_profile',
  SUPER_ADMINS: 'admin_super_admins',
  COLLABORATORS: 'admin_collaborators',
  BANNED_USERS: 'banned_users',
  KILLSWITCHES: 'admin_killswitches',
  ANNOUNCEMENT: 'platform_announcement',
  ANNOUNCEMENT_DISMISSED_PREFIX: 'announcement_dismissed_',
  FEEDBACK_BUGS: 'admin_feedback_bugs',
  SYLLABI_TEMPLATES: 'admin_syllabi_templates',
  SKILL_ROADMAPS: 'admin_skill_roadmaps',
  ACCESS_DENIED_ALERT: 'admin_access_denied_alert'
};

export const AdminAuth = {
  getUserEmail() {
    try {
      const profile = JSON.parse(localStorage.getItem("study_user_profile") || "{}");
      if (profile.email) return (profile.email || "").toLowerCase().trim();
      const alt = JSON.parse(localStorage.getItem("user_profile") || "{}");
      return (alt.email || "").toLowerCase().trim();
    } catch (e) {
      return "";
    }
  },
  getRole() {
    const email = this.getUserEmail();
    if (!email) return "guest";

    let superList = [...ROLE_CONFIG.superAdmins];
    try {
      const storedSupers = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEYS.SUPER_ADMINS) || "[]");
      if (Array.isArray(storedSupers)) {
        storedSupers.forEach(s => {
          const norm = String(s || '').trim().toLowerCase();
          if (norm && !superList.map(e => e.toLowerCase()).includes(norm)) superList.push(norm);
        });
      }
    } catch {}

    if (superList.map(e => e.toLowerCase()).includes(email)) return "super_admin";

    let editorList = [...ROLE_CONFIG.editors];
    try {
      const storedEditors = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEYS.COLLABORATORS) || "[]");
      if (Array.isArray(storedEditors)) {
        storedEditors.forEach(item => {
          const em = typeof item === 'string' ? item : item?.email;
          const norm = String(em || '').trim().toLowerCase();
          if (norm && !editorList.map(e => e.toLowerCase()).includes(norm)) editorList.push(norm);
        });
      }
    } catch {}

    if (editorList.map(e => e.toLowerCase()).includes(email)) return "editor";
    return "student";
  },
  canAccessAdmin() {
    const role = this.getRole();
    return role === "super_admin" || role === "editor";
  },
  isSuperAdmin() {
    return this.getRole() === "super_admin";
  }
};

// Global bindings for script tag usage
if (typeof window !== 'undefined') {
  window.ROLE_CONFIG = ROLE_CONFIG;
  window.AdminAuth = AdminAuth;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ROLE_CONFIG = ROLE_CONFIG;
  globalThis.AdminAuth = AdminAuth;
}

/**
 * Automatically update #sidebar-admin-link visibility across all views
 */
export function updateSidebarAdminLinkVisibility() {
  if (typeof document === 'undefined') return;
  const adminLink = document.getElementById('sidebar-admin-link');
  if (!adminLink) return;

  const allowed = AdminAuth.canAccessAdmin();
  if (allowed) {
    adminLink.style.display = '';
  } else {
    adminLink.style.display = 'none';
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', updateSidebarAdminLinkVisibility);
  window.addEventListener('storage', updateSidebarAdminLinkVisibility);
  window.addEventListener('studyflow-role-switched', updateSidebarAdminLinkVisibility);
  window.addEventListener('studyflow-collaborators-changed', updateSidebarAdminLinkVisibility);
}

/**
 * Retrieves the currently logged-in user profile
 */
export function getLoggedInUserProfile() {
  if (typeof window === 'undefined') return null;
  try {
    const rawStudyProfile = localStorage.getItem(ADMIN_STORAGE_KEYS.USER_PROFILE) || 
                            sessionStorage.getItem(ADMIN_STORAGE_KEYS.USER_PROFILE);
    if (rawStudyProfile) {
      const parsed = JSON.parse(rawStudyProfile);
      if (parsed && (parsed.email || parsed.name || parsed.sub)) {
        return parsed;
      }
    }

    const rawUserProfile = localStorage.getItem('user_profile') || 
                           sessionStorage.getItem('user_profile') ||
                           localStorage.getItem('google_user_profile');
    if (rawUserProfile) {
      const parsed = JSON.parse(rawUserProfile);
      if (parsed && (parsed.email || parsed.name || parsed.sub)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading user profile:', err);
  }
  return null;
}

export function getCurrentUserEmail() {
  return AdminAuth.getUserEmail();
}

export function getSuperAdmins() {
  const list = [...ROLE_CONFIG.superAdmins];
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEYS.SUPER_ADMINS);
    if (raw) {
      const extra = JSON.parse(raw);
      if (Array.isArray(extra)) {
        extra.forEach(email => {
          const norm = String(email).trim().toLowerCase();
          if (norm && !list.map(e => e.toLowerCase()).includes(norm)) {
            list.push(norm);
          }
        });
      }
    }
  } catch {}
  return list;
}

export function getCollaborators() {
  const list = [...ROLE_CONFIG.editors];
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEYS.COLLABORATORS);
    if (raw) {
      const stored = JSON.parse(raw);
      if (Array.isArray(stored)) {
        stored.forEach(item => {
          const email = typeof item === 'string' ? item : item?.email;
          const norm = String(email || '').trim().toLowerCase();
          if (norm && !list.map(e => e.toLowerCase()).includes(norm)) {
            list.push(norm);
          }
        });
      }
    }
  } catch {}
  return list;
}

export function getCollaboratorsDetailed() {
  const base = ROLE_CONFIG.editors.map(email => ({
    email,
    role: 'Editor',
    addedAt: '2026-10-01',
    addedBy: 'System Default',
    isDefault: true
  }));

  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEYS.COLLABORATORS);
    if (raw) {
      const stored = JSON.parse(raw);
      if (Array.isArray(stored)) {
        stored.forEach(item => {
          const email = typeof item === 'string' ? item : item?.email;
          const norm = String(email || '').trim().toLowerCase();
          if (norm && !base.some(b => b.email.toLowerCase() === norm)) {
            base.push({
              email: norm,
              role: 'Editor',
              addedAt: item?.addedAt || new Date().toISOString().split('T')[0],
              addedBy: item?.addedBy || 'Super Admin',
              isDefault: false
            });
          }
        });
      }
    }
  } catch {}
  return base;
}

export function addCollaborator(email, addedBy = 'Super Admin') {
  if (!email || typeof email !== 'string') return { success: false, message: 'Invalid email' };
  const norm = email.trim().toLowerCase();
  if (!norm.includes('@') || !norm.includes('.')) {
    return { success: false, message: 'Invalid email format' };
  }

  const current = getCollaboratorsDetailed();
  if (current.some(c => c.email.toLowerCase() === norm)) {
    return { success: false, message: 'Email is already an active collaborator' };
  }

  const newEntry = {
    email: norm,
    role: 'Editor',
    addedAt: new Date().toISOString().split('T')[0],
    addedBy,
    isDefault: false
  };

  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEYS.COLLABORATORS);
    const list = raw ? JSON.parse(raw) : [];
    list.push(newEntry);
    localStorage.setItem(ADMIN_STORAGE_KEYS.COLLABORATORS, JSON.stringify(list));
    if (!ROLE_CONFIG.editors.map(e => e.toLowerCase()).includes(norm)) {
      ROLE_CONFIG.editors.push(norm);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('studyflow-collaborators-changed'));
    }
    return { success: true, message: `Granted Editor access to ${norm}`, collaborator: newEntry };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

export function removeCollaborator(email) {
  if (!email) return false;
  const norm = String(email).trim().toLowerCase();
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEYS.COLLABORATORS);
    if (raw) {
      let list = JSON.parse(raw);
      list = list.filter(item => {
        const itemEmail = typeof item === 'string' ? item : item?.email;
        return String(itemEmail || '').trim().toLowerCase() !== norm;
      });
      localStorage.setItem(ADMIN_STORAGE_KEYS.COLLABORATORS, JSON.stringify(list));
    }
    const idx = ROLE_CONFIG.editors.findIndex(e => e.toLowerCase() === norm);
    if (idx !== -1) {
      ROLE_CONFIG.editors.splice(idx, 1);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('studyflow-collaborators-changed'));
    }
    return true;
  } catch (e) {
    console.error('Error removing collaborator:', e);
    return false;
  }
}

export function isSuperAdmin(email = null) {
  if (email) {
    const norm = String(email).trim().toLowerCase();
    return getSuperAdmins().map(e => e.toLowerCase()).includes(norm);
  }
  return AdminAuth.isSuperAdmin();
}

export function isEditor(email = null) {
  if (email) {
    const norm = String(email).trim().toLowerCase();
    return getCollaborators().map(e => e.toLowerCase()).includes(norm);
  }
  const role = AdminAuth.getRole();
  return role === 'editor';
}

export function canAccessAdmin(email = null) {
  if (email) {
    const norm = String(email).trim().toLowerCase();
    return getSuperAdmins().map(e => e.toLowerCase()).includes(norm) ||
           getCollaborators().map(e => e.toLowerCase()).includes(norm);
  }
  return AdminAuth.canAccessAdmin();
}

export function getUserRole(email = null) {
  if (email) {
    const norm = String(email).trim().toLowerCase();
    if (getSuperAdmins().map(e => e.toLowerCase()).includes(norm)) return 'SUPER_ADMIN';
    if (getCollaborators().map(e => e.toLowerCase()).includes(norm)) return 'EDITOR';
    return 'STUDENT';
  }
  const r = AdminAuth.getRole();
  if (r === 'super_admin') return 'SUPER_ADMIN';
  if (r === 'editor') return 'EDITOR';
  return 'STUDENT';
}

export function getBannedUsers() {
  if (typeof localStorage === 'undefined') return [...(ROLE_CONFIG.bannedUsers || [])];
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEYS.BANNED_USERS);
    if (!raw) return [...(ROLE_CONFIG.bannedUsers || [])];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...(ROLE_CONFIG.bannedUsers || [])];
  } catch {
    return [];
  }
}

export function isUserBanned(email = null) {
  const checkEmail = (email || getCurrentUserEmail()).trim().toLowerCase();
  if (!checkEmail) return false;
  const banned = getBannedUsers();
  return banned.some(item => {
    const bEmail = typeof item === 'string' ? item : item?.email;
    return String(bEmail || '').trim().toLowerCase() === checkEmail;
  });
}

export function banUser(email, reason = 'Administrative suspension', bannedBy = 'Super Admin') {
  if (!email || typeof email !== 'string') return { success: false, message: 'Invalid email' };
  const norm = email.trim().toLowerCase();
  if (isSuperAdmin(norm)) {
    return { success: false, message: 'Cannot ban a Super Admin account' };
  }

  const banned = getBannedUsers();
  if (banned.some(b => (typeof b === 'string' ? b : b?.email)?.toLowerCase() === norm)) {
    return { success: false, message: 'User is already blacklisted' };
  }

  const newBan = {
    email: norm,
    reason,
    bannedAt: new Date().toISOString().split('T')[0],
    bannedBy
  };

  try {
    banned.push(newBan);
    localStorage.setItem(ADMIN_STORAGE_KEYS.BANNED_USERS, JSON.stringify(banned));
    if (!ROLE_CONFIG.bannedUsers.map(e => e.toLowerCase()).includes(norm)) {
      ROLE_CONFIG.bannedUsers.push(norm);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('studyflow-banned-users-changed'));
    }

    if (getCurrentUserEmail() === norm && typeof window !== 'undefined') {
      localStorage.removeItem(ADMIN_STORAGE_KEYS.USER_PROFILE);
      localStorage.removeItem('user_profile');
      sessionStorage.clear();
      window.location.replace('/login.html?banned=true');
    }

    return { success: true, message: `Blacklisted ${norm}`, ban: newBan };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

export function unbanUser(email) {
  if (!email) return false;
  const norm = String(email).trim().toLowerCase();
  try {
    let banned = getBannedUsers();
    banned = banned.filter(b => {
      const bEmail = typeof b === 'string' ? b : b?.email;
      return String(bEmail || '').trim().toLowerCase() !== norm;
    });
    localStorage.setItem(ADMIN_STORAGE_KEYS.BANNED_USERS, JSON.stringify(banned));
    const idx = ROLE_CONFIG.bannedUsers.findIndex(e => e.toLowerCase() === norm);
    if (idx !== -1) {
      ROLE_CONFIG.bannedUsers.splice(idx, 1);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('studyflow-banned-users-changed'));
    }
    return true;
  } catch (e) {
    return false;
  }
}

export function getEmergencyKillswitches() {
  const defaults = {
    driveSync: true,
    demoMode: true,
    maintenanceMode: false
  };

  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEYS.KILLSWITCHES);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      driveSync: parsed.driveSync !== undefined ? !!parsed.driveSync : defaults.driveSync,
      demoMode: parsed.demoMode !== undefined ? !!parsed.demoMode : defaults.demoMode,
      maintenanceMode: parsed.maintenanceMode !== undefined ? !!parsed.maintenanceMode : defaults.maintenanceMode
    };
  } catch {
    return defaults;
  }
}

export function setEmergencyKillswitch(key, value) {
  const current = getEmergencyKillswitches();
  if (key in current) {
    current[key] = !!value;
    try {
      localStorage.setItem(ADMIN_STORAGE_KEYS.KILLSWITCHES, JSON.stringify(current));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('studyflow-killswitch-changed', {
          detail: { key, value: !!value, killswitches: current }
        }));
      }
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function getPlatformAnnouncement() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEYS.ANNOUNCEMENT);
    if (!raw) return null;
    const announcement = JSON.parse(raw);
    if (!announcement || !announcement.text || !announcement.active) return null;

    if (announcement.expiresAt) {
      const today = new Date().toISOString().split('T')[0];
      if (announcement.expiresAt < today) {
        return null;
      }
    }
    return announcement;
  } catch {
    return null;
  }
}

export function setPlatformAnnouncement({ text, urgency = 'normal', expiresAt = '' }) {
  if (!text || !text.trim()) return false;
  const announcement = {
    id: 'announcement_' + Date.now(),
    text: text.trim(),
    urgency,
    expiresAt: expiresAt || '',
    createdAt: new Date().toISOString().split('T')[0],
    active: true
  };
  try {
    localStorage.setItem(ADMIN_STORAGE_KEYS.ANNOUNCEMENT, JSON.stringify(announcement));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('studyflow-announcement-changed'));
    }
    return announcement;
  } catch {
    return false;
  }
}

export function clearPlatformAnnouncement() {
  try {
    localStorage.removeItem(ADMIN_STORAGE_KEYS.ANNOUNCEMENT);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('studyflow-announcement-changed'));
    }
    return true;
  } catch {
    return false;
  }
}

export const INITIAL_BUG_REPORTS = [
  {
    id: 'BUG-101',
    studentEmail: 'priya.sharma@uni.edu',
    studentName: 'Priya Sharma',
    category: 'Timer Audio',
    title: 'Focus Timer chime mute when browser tab backgrounded',
    description: 'When running deep work session with the browser tab in background, the gentle completion chime occasionally fails to play.',
    status: 'Open',
    severity: 'Medium',
    createdAt: '2026-10-25'
  },
  {
    id: 'BUG-102',
    studentEmail: 'rahul.m@college.ac.in',
    studentName: 'Rahul Mehta',
    category: 'Drive Sync',
    title: 'Google Drive notes upload timeout on large 45MB PDF files',
    description: 'Direct binary upload through GIS times out when attaching multi-chapter semester scan PDF notes over 40MB.',
    status: 'In Review',
    severity: 'High',
    createdAt: '2026-10-24'
  },
  {
    id: 'BUG-103',
    studentEmail: 'ananya.k@iitd.ac.in',
    studentName: 'Ananya Kumar',
    category: 'Exam Radar',
    title: 'Exam countdown off by 1 day in positive UTC timezones (IST)',
    description: 'Exam radar was shifting countdown date by 24h due to UTC midnight discrepancy. Verified resolved in v2.4.',
    status: 'Resolved',
    severity: 'Low',
    createdAt: '2026-10-22'
  },
  {
    id: 'BUG-104',
    studentEmail: 'dev.patel@bits.ac.in',
    studentName: 'Dev Patel',
    category: 'Revision Queue',
    title: 'Spaced repetition flashcard flipping animation stutter on mobile',
    description: 'On Android Chrome mobile view, card flip CSS 3D transform drops frames when transitioning through large card decks.',
    status: 'Open',
    severity: 'Low',
    createdAt: '2026-10-26'
  }
];

export function getBugReports() {
  if (typeof window === 'undefined') return INITIAL_BUG_REPORTS;
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEYS.FEEDBACK_BUGS);
    if (!raw) {
      localStorage.setItem(ADMIN_STORAGE_KEYS.FEEDBACK_BUGS, JSON.stringify(INITIAL_BUG_REPORTS));
      return INITIAL_BUG_REPORTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_BUG_REPORTS;
  } catch {
    return INITIAL_BUG_REPORTS;
  }
}

export function updateBugStatus(id, newStatus) {
  try {
    const bugs = getBugReports();
    const updated = bugs.map(b => b.id === id ? { ...b, status: newStatus } : b);
    localStorage.setItem(ADMIN_STORAGE_KEYS.FEEDBACK_BUGS, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('studyflow-bugs-changed'));
    }
    return true;
  } catch {
    return false;
  }
}

export function addBugReport(report) {
  try {
    const bugs = getBugReports();
    const newEntry = {
      id: 'BUG-' + Math.floor(100 + Math.random() * 900),
      studentEmail: report.studentEmail || getCurrentUserEmail() || 'student@studyflow.local',
      studentName: report.studentName || 'Student',
      category: report.category || 'General',
      title: report.title,
      description: report.description,
      status: 'Open',
      severity: report.severity || 'Medium',
      createdAt: new Date().toISOString().split('T')[0]
    };
    bugs.unshift(newEntry);
    localStorage.setItem(ADMIN_STORAGE_KEYS.FEEDBACK_BUGS, JSON.stringify(bugs));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('studyflow-bugs-changed'));
    }
    return newEntry;
  } catch {
    return null;
  }
}

export function checkAdminAccess({ redirect = true } = {}) {
  const allowed = AdminAuth.canAccessAdmin();

  if (!allowed && redirect && typeof window !== 'undefined') {
    const alertMessage = "Access Denied: Administrator privileges required.";
    try {
      sessionStorage.setItem(ADMIN_STORAGE_KEYS.ACCESS_DENIED_ALERT, alertMessage);
    } catch {}

    try {
      window.alert(alertMessage);
    } catch {}

    window.location.replace('/index.html?access_denied=admin');
    return false;
  }

  return allowed;
}

export function setSimulatedRole(role) {
  if (typeof window === 'undefined') return;
  let testProfile = null;
  if (role === 'SUPER_ADMIN') {
    testProfile = {
      sub: 'super_admin_simulated',
      name: 'Super Admin',
      email: 'kuldeepkumarncc2dbn@gmail.com',
      picture: '',
      isLoggedIn: true
    };
  } else if (role === 'EDITOR') {
    testProfile = {
      sub: 'editor_simulated',
      name: 'Collaborator Editor',
      email: 'friend_email@gmail.com',
      picture: '',
      isLoggedIn: true
    };
  } else {
    testProfile = {
      sub: 'student_simulated',
      name: 'Student User',
      email: 'student@example.com',
      picture: '',
      isLoggedIn: true
    };
  }

  localStorage.setItem(ADMIN_STORAGE_KEYS.USER_PROFILE, JSON.stringify(testProfile));
  localStorage.setItem('user_profile', JSON.stringify(testProfile));
  sessionStorage.setItem(ADMIN_STORAGE_KEYS.USER_PROFILE, JSON.stringify(testProfile));
  sessionStorage.setItem('user_profile', JSON.stringify(testProfile));
  window.dispatchEvent(new Event('studyflow-role-switched'));
  updateSidebarAdminLinkVisibility();
}

export default AdminAuth;
