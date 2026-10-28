/**
 * Admin & Collaborator Configuration, Access Gate & Role Definitions
 * Study Tracker Pro (admin-config.js)
 *
 * Classic non-module browser script loaded via <script src="admin-config.js">
 */
(function () {
  var root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this);

  root.ROLE_CONFIG = {
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

  root.SUPER_ADMIN_EMAILS = root.ROLE_CONFIG.superAdmins;
  root.DEFAULT_EDITOR_EMAILS = root.ROLE_CONFIG.editors;

  root.ADMIN_STORAGE_KEYS = {
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

  root.AdminAuth = {
    getUserEmail: function () {
      try {
        var profile = JSON.parse(localStorage.getItem("study_user_profile") || "{}");
        if (profile.email) return (profile.email || "").toLowerCase().trim();
        var alt = JSON.parse(localStorage.getItem("user_profile") || "{}");
        return (alt.email || "").toLowerCase().trim();
      } catch (e) {
        return "";
      }
    },
    getRole: function () {
      var email = this.getUserEmail();
      if (!email) return "guest";
      var config = (typeof window !== 'undefined' && window.ROLE_CONFIG) ? window.ROLE_CONFIG : (root.ROLE_CONFIG || {});
      var supers = (config.superAdmins || []).map(function (e) { return e.toLowerCase(); });
      var eds = (config.editors || []).map(function (e) { return e.toLowerCase(); });
      if (supers.indexOf(email) !== -1) return "super_admin";
      if (eds.indexOf(email) !== -1) return "editor";
      return "student";
    },
    canAccessAdmin: function () {
      var role = this.getRole();
      return role === "super_admin" || role === "editor";
    },
    isSuperAdmin: function () {
      return this.getRole() === "super_admin";
    }
  };

  root.canAccessAdmin = function () {
    return root.AdminAuth.canAccessAdmin();
  };

  root.isSuperAdmin = function () {
    return root.AdminAuth.isSuperAdmin();
  };

  root.checkAdminAccess = function (options) {
    if (!root.AdminAuth.canAccessAdmin()) {
      if (!options || options.redirect !== false) {
        alert("Access Denied: Administrator permissions required.");
        window.location.replace("index.html?access_denied=admin");
      }
      return false;
    }
    return true;
  };

  if (typeof window !== 'undefined') {
    window.ROLE_CONFIG = root.ROLE_CONFIG;
    window.AdminAuth = root.AdminAuth;
    window.canAccessAdmin = root.canAccessAdmin;
    window.isSuperAdmin = root.isSuperAdmin;
    window.checkAdminAccess = root.checkAdminAccess;
  }
})();
