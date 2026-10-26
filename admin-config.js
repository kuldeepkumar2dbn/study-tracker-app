/**
 * Admin & Collaborator Configuration, Access Gate & Role Definitions
 * StudyFlow Multi-Page Architecture (admin-config.js)
 *
 * Implements:
 * - Role Definitions: Super Admin & Editors
 * - Access Gate & Route Guard for /admin.html
 * - Collaborator Management (admin_collaborators)
 * - Ban List Manager (banned_users)
 * - Emergency Controls & Kill Switches (admin_killswitches)
 * - Global Platform Announcement Banner (platform_announcement)
 * - Student Feedback & Bug Reports Drawer (admin_feedback_bugs)
 */

export const SUPER_ADMIN_EMAILS = [
  'YOUR_GOOGLE_EMAIL@gmail.com',
  'admin@studyflow.local'
];

export const DEFAULT_EDITOR_EMAILS = [
  'FRIEND_EMAIL@gmail.com',
  'editor@studyflow.local'
];

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

/**
 * Retrieves the currently logged-in user profile.
 * Checks study_user_profile first (as required by spec),
 * falling back to user_profile, google_user_profile, and session cookie.
 */
export function getLoggedInUserProfile() {
  if (typeof window === 'undefined') return null;
  try {
    // 1. Primary: check study_user_profile in localStorage or sessionStorage
    const rawStudyProfile = localStorage.getItem(ADMIN_STORAGE_KEYS.USER_PROFILE) || 
                            sessionStorage.getItem(ADMIN_STORAGE_KEYS.USER_PROFILE);
    if (rawStudyProfile) {
      const parsed = JSON.parse(rawStudyProfile);
      if (parsed && (parsed.email || parsed.name || parsed.sub)) {
        return parsed;
      }
    }

    // 2. Secondary: check user_profile fallback
    const rawUserProfile = localStorage.getItem('user_profile') || 
                           sessionStorage.getItem('user_profile') ||
                           localStorage.getItem('google_user_profile');
    if (rawUserProfile) {
      const parsed = JSON.parse(rawUserProfile);
      if (parsed && (parsed.email || parsed.name || parsed.sub)) {
        return parsed;
      }
    }

    // 3. Fallback: check session cookie
    if (typeof document !== 'undefined' && document.cookie) {
      const match = document.cookie.match(/(?:^|;\s*)study_session=([^;]*)/);
      if (match) {
        const decoded = decodeURIComponent(match[1]);
        const parsed = JSON.parse(decoded);
        if (parsed && (parsed.email || parsed.name || parsed.sub)) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('Error reading logged-in user profile for admin:', err);
  }
  return null;
}

/**
 * Retrieves the normalized lowercase email of the logged-in user
 */
export function getCurrentUserEmail() {
  const profile = getLoggedInUserProfile();
  if (profile && profile.email) {
    return String(profile.email).trim().toLowerCase();
  }
  return '';
}

/**
 * Returns list of Super Admin emails (base list + any dynamically stored)
 */
export function getSuperAdmins() {
  const list = [...SUPER_ADMIN_EMAILS];
  if (typeof window === 'undefined') return list;
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
  } catch (e) {
    console.warn('Error reading super admins:', e);
  }
  return list;
}

/**
 * Returns list of Editor emails (base list + any saved in admin_collaborators)
 */
export function getCollaborators() {
  const list = [...DEFAULT_EDITOR_EMAILS];
  if (typeof window === 'undefined') return list;
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
  } catch (e) {
    console.warn('Error reading collaborators:', e);
  }
  return list;
}

/**
 * Returns array of active editor collaborator objects with metadata
 */
export function getCollaboratorsDetailed() {
  const base = DEFAULT_EDITOR_EMAILS.map(email => ({
    email,
    role: 'Editor',
    addedAt: '2026-10-01',
    addedBy: 'System Default',
    isDefault: true
  }));

  if (typeof window === 'undefined') return base;
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
  } catch (e) {
    console.warn('Error reading detailed collaborators:', e);
  }
  return base;
}

/**
 * Adds a new collaborator email with Editor privileges
 */
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
    window.dispatchEvent(new Event('studyflow-collaborators-changed'));
    return { success: true, message: `Granted Editor access to ${norm}`, collaborator: newEntry };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Revokes collaborator access for an email
 */
export function removeCollaborator(email) {
  if (!email) return false;
  const norm = String(email).trim().toLowerCase();
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEYS.COLLABORATORS);
    if (!raw) return true;
    let list = JSON.parse(raw);
    list = list.filter(item => {
      const itemEmail = typeof item === 'string' ? item : item?.email;
      return String(itemEmail || '').trim().toLowerCase() !== norm;
    });
    localStorage.setItem(ADMIN_STORAGE_KEYS.COLLABORATORS, JSON.stringify(list));
    window.dispatchEvent(new Event('studyflow-collaborators-changed'));
    return true;
  } catch (e) {
    console.error('Error removing collaborator:', e);
    return false;
  }
}

/**
 * Checks if a user is a Super Admin
 */
export function isSuperAdmin(email = null) {
  const checkEmail = (email || getCurrentUserEmail()).trim().toLowerCase();
  if (!checkEmail) return false;
  const superAdmins = getSuperAdmins();
  return superAdmins.map(e => e.trim().toLowerCase()).includes(checkEmail);
}

/**
 * Checks if a user is an Editor
 */
export function isEditor(email = null) {
  const checkEmail = (email || getCurrentUserEmail()).trim().toLowerCase();
  if (!checkEmail) return false;
  const editors = getCollaborators();
  return editors.map(e => e.trim().toLowerCase()).includes(checkEmail);
}

/**
 * Checks if user has admin/collaborator access (Super Admin or Editor)
 */
export function canAccessAdmin(email = null) {
  return isSuperAdmin(email) || isEditor(email);
}

/**
 * Returns role string: 'SUPER_ADMIN' | 'EDITOR' | 'STUDENT'
 */
export function getUserRole(email = null) {
  if (isSuperAdmin(email)) return 'SUPER_ADMIN';
  if (isEditor(email)) return 'EDITOR';
  return 'STUDENT';
}

/**
 * Ban List Manager (banned_users)
 */
export function getBannedUsers() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEYS.BANNED_USERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Error reading banned users:', e);
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
    window.dispatchEvent(new Event('studyflow-banned-users-changed'));

    // If currently logged-in user is the one being banned, force signout immediately
    if (getCurrentUserEmail() === norm) {
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
    window.dispatchEvent(new Event('studyflow-banned-users-changed'));
    return true;
  } catch (e) {
    console.error('Error unbanning user:', e);
    return false;
  }
}

/**
 * Emergency Controls & Kill Switches
 * Defaults:
 * - driveSync: true (enabled)
 * - demoMode: true (enabled)
 * - maintenanceMode: false (disabled)
 */
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
  } catch (e) {
    console.warn('Error reading kill switches:', e);
    return defaults;
  }
}

export function setEmergencyKillswitch(key, value) {
  const current = getEmergencyKillswitches();
  if (key in current) {
    current[key] = !!value;
    try {
      localStorage.setItem(ADMIN_STORAGE_KEYS.KILLSWITCHES, JSON.stringify(current));
      window.dispatchEvent(new CustomEvent('studyflow-killswitch-changed', {
        detail: { key, value: !!value, killswitches: current }
      }));
      return true;
    } catch (e) {
      console.error('Error saving killswitch:', e);
      return false;
    }
  }
  return false;
}

/**
 * Global Announcement Banner (platform_announcement)
 */
export function getPlatformAnnouncement() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEYS.ANNOUNCEMENT);
    if (!raw) return null;
    const announcement = JSON.parse(raw);
    if (!announcement || !announcement.text || !announcement.active) return null;

    // Check expiration date
    if (announcement.expiresAt) {
      const today = new Date().toISOString().split('T')[0];
      if (announcement.expiresAt < today) {
        return null; // Expired
      }
    }
    return announcement;
  } catch (e) {
    console.warn('Error reading announcement:', e);
    return null;
  }
}

export function setPlatformAnnouncement({ text, urgency = 'normal', expiresAt = '' }) {
  if (!text || !text.trim()) return false;
  const announcement = {
    id: 'announcement_' + Date.now(),
    text: text.trim(),
    urgency, // 'normal' | 'motivational' | 'warning'
    expiresAt: expiresAt || '',
    createdAt: new Date().toISOString().split('T')[0],
    active: true
  };
  try {
    localStorage.setItem(ADMIN_STORAGE_KEYS.ANNOUNCEMENT, JSON.stringify(announcement));
    window.dispatchEvent(new Event('studyflow-announcement-changed'));
    return announcement;
  } catch (e) {
    console.error('Error saving announcement:', e);
    return false;
  }
}

export function clearPlatformAnnouncement() {
  try {
    localStorage.removeItem(ADMIN_STORAGE_KEYS.ANNOUNCEMENT);
    window.dispatchEvent(new Event('studyflow-announcement-changed'));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Feedback & Bug Drawer (admin_feedback_bugs)
 */
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
  } catch (e) {
    return INITIAL_BUG_REPORTS;
  }
}

export function updateBugStatus(id, newStatus) {
  try {
    const bugs = getBugReports();
    const updated = bugs.map(b => b.id === id ? { ...b, status: newStatus } : b);
    localStorage.setItem(ADMIN_STORAGE_KEYS.FEEDBACK_BUGS, JSON.stringify(updated));
    window.dispatchEvent(new Event('studyflow-bugs-changed'));
    return true;
  } catch (e) {
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
    window.dispatchEvent(new Event('studyflow-bugs-changed'));
    return newEntry;
  } catch (e) {
    return null;
  }
}

/**
 * Access Gate & Route Guard for /admin.html
 * If an unauthorized student visits /admin.html:
 * Immediately redirect them to /index.html with alert:
 * "Access Denied: Administrator privileges required."
 */
export function checkAdminAccess({ redirect = true } = {}) {
  if (typeof window === 'undefined') return false;

  const email = getCurrentUserEmail();
  const allowed = canAccessAdmin(email);

  if (!allowed && redirect) {
    const alertMessage = "Access Denied: Administrator privileges required.";
    try {
      sessionStorage.setItem(ADMIN_STORAGE_KEYS.ACCESS_DENIED_ALERT, alertMessage);
    } catch {}

    // Synchronous browser alert prompt for immediate user feedback
    try {
      window.alert(alertMessage);
    } catch {}

    // Immediate redirection to index.html with query parameter
    window.location.replace('/index.html?access_denied=admin');
    return false;
  }

  return allowed;
}

/**
 * Helper to simulate roles in development / zero-cost testing
 */
export function setSimulatedRole(role) {
  if (typeof window === 'undefined') return;
  let testProfile = null;
  if (role === 'SUPER_ADMIN') {
    testProfile = {
      sub: 'super_admin_simulated',
      name: 'Super Admin',
      email: 'YOUR_GOOGLE_EMAIL@gmail.com',
      picture: '',
      isLoggedIn: true
    };
  } else if (role === 'EDITOR') {
    testProfile = {
      sub: 'editor_simulated',
      name: 'Collaborator Editor',
      email: 'FRIEND_EMAIL@gmail.com',
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
}
