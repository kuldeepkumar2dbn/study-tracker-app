/**
 * Admin & Collaborator Configuration Bridge (src/admin-config.js)
 * Re-exports all administrative configurations, role definitions, and telemetry URLs
 * for both ES module environments and browser window globals.
 */

import AdminAuth, {
  TELEMETRY_URL,
  TELEMETRY_ENDPOINT,
  isTelemetryConfigured,
  safeSendTelemetry,
  ROLE_CONFIG,
  SUPER_ADMIN_EMAILS,
  DEFAULT_EDITOR_EMAILS,
  ADMIN_STORAGE_KEYS,
  getLoggedInUserProfile,
  getSuperAdmins,
  getCollaborators,
  getCollaboratorsDetailed,
  saveCollaborators,
  addCollaborator,
  removeCollaborator,
  getBannedUsers,
  isUserBanned,
  banUser,
  unbanUser,
  canAccessAdmin,
  getEmergencyKillswitches,
  saveEmergencyKillswitches,
  isFeatureDisabled,
  getPlatformAnnouncement,
  savePlatformAnnouncement,
  dismissPlatformAnnouncement,
  isAnnouncementDismissed,
  getBugReports,
  saveBugReports,
  addBugReport,
  updateBugReportStatus,
  deleteBugReport,
  checkAdminAccess,
  simulateRole
} from '../admin-config.js';

if (typeof window !== 'undefined') {
  window.TELEMETRY_URL = TELEMETRY_URL;
  window.TELEMETRY_ENDPOINT = TELEMETRY_ENDPOINT;
}

export {
  TELEMETRY_URL,
  TELEMETRY_ENDPOINT,
  isTelemetryConfigured,
  safeSendTelemetry,
  ROLE_CONFIG,
  SUPER_ADMIN_EMAILS,
  DEFAULT_EDITOR_EMAILS,
  ADMIN_STORAGE_KEYS,
  AdminAuth,
  getLoggedInUserProfile,
  getSuperAdmins,
  getCollaborators,
  getCollaboratorsDetailed,
  saveCollaborators,
  addCollaborator,
  removeCollaborator,
  getBannedUsers,
  isUserBanned,
  banUser,
  unbanUser,
  canAccessAdmin,
  getEmergencyKillswitches,
  saveEmergencyKillswitches,
  isFeatureDisabled,
  getPlatformAnnouncement,
  savePlatformAnnouncement,
  dismissPlatformAnnouncement,
  isAnnouncementDismissed,
  getBugReports,
  saveBugReports,
  addBugReport,
  updateBugReportStatus,
  deleteBugReport,
  checkAdminAccess,
  simulateRole
};

export default AdminAuth;

