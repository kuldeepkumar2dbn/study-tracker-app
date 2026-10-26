import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  Bell, 
  Sparkles, 
  FileText, 
  BookOpen, 
  Award, 
  Download, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  RefreshCw, 
  UserPlus, 
  UserX, 
  UserCheck, 
  Users, 
  CheckCircle2, 
  Clock, 
  Flame, 
  Cloud, 
  ExternalLink, 
  Search, 
  Filter, 
  ArrowRight,
  Eye,
  Sliders,
  Radio,
  X,
  AlertCircle
} from 'lucide-react';
import YouTubeIcon from './YouTubeIcon';
import { 
  getLoggedInUserProfile,
  getCurrentUserEmail,
  isSuperAdmin,
  isEditor,
  canAccessAdmin,
  getUserRole,
  getCollaboratorsDetailed,
  addCollaborator,
  removeCollaborator,
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
  setSimulatedRole,
  ADMIN_STORAGE_KEYS
} from '../../admin-config';
import { celebrateTaskCompletion } from '../utils/confetti';
import { soundEngine } from '../utils/audio';

// Default starter templates in case none exist in localStorage
const DEFAULT_SYLLABI_TEMPLATES = [
  {
    id: 'syl_cs201',
    title: 'Data Structures & Algorithms in Modern C++',
    code: 'CS201',
    examDate: '2026-11-20',
    createdAt: '2026-10-15',
    modules: [
      { id: 'm1', title: 'Module 1: Asymptotic Complexity & Arrays', hours: 6, subtopics: 'Big-O notation, Amortized analysis, Dynamic arrays' },
      { id: 'm2', title: 'Module 2: Trees & Balanced Search Trees', hours: 8, subtopics: 'Binary Search Trees, AVL rotations, Red-Black trees' },
      { id: 'm3', title: 'Module 3: Graph Algorithms & Network Flow', hours: 10, subtopics: 'BFS/DFS, Dijkstra, Bellman-Ford, Kruskal MST' },
      { id: 'm4', title: 'Module 4: Dynamic Programming & Greedy Approaches', hours: 12, subtopics: 'Knapsack, Longest Common Subsequence, Matrix chain multiplication' }
    ]
  },
  {
    id: 'syl_cs302',
    title: 'Computer Networks & Distributed Systems',
    code: 'CS302',
    examDate: '2026-12-05',
    createdAt: '2026-10-20',
    modules: [
      { id: 'm1', title: 'Module 1: OSI Architecture & Physical/Data Link', hours: 5, subtopics: 'Framing, Error correction, CSMA/CD, Ethernet' },
      { id: 'm2', title: 'Module 2: IP Addressing & Routing Protocols', hours: 8, subtopics: 'Subnetting, CIDR, OSPF, BGP routing' },
      { id: 'm3', title: 'Module 3: Transport Layer & TCP Flow Control', hours: 9, subtopics: '3-way handshake, Congestion avoidance, TCP Reno vs BBR' }
    ]
  }
];

const DEFAULT_SKILL_ROADMAPS = [
  {
    id: 'skill_webdev',
    title: 'Full-Stack Web Development',
    category: 'Computer Science',
    videoLink: 'https://www.youtube.com/watch?v=nu_pCVPKzTk',
    createdAt: '2026-10-10',
    beginner: 'HTML5 Semantic markup, Modern CSS3 Flexbox/Grid, JavaScript ES6+ fundamentals, DOM manipulation',
    intermediate: 'React 18 hooks & state management, REST API design, Node.js & Express, MongoDB / PostgreSQL schema design',
    advanced: 'Next.js App Router, Server Components, Redis caching, CI/CD pipeline deployment & Docker containerization'
  },
  {
    id: 'skill_pytorch',
    title: 'Deep Learning & PyTorch',
    category: 'Artificial Intelligence',
    videoLink: 'https://www.youtube.com/watch?v=V_xro14G74U',
    createdAt: '2026-10-18',
    beginner: 'Python for scientific computing, NumPy tensor operations, Linear algebra fundamentals, Gradient descent basics',
    intermediate: 'PyTorch nn.Module architecture, Custom datasets & DataLoaders, Convolutional Neural Networks (CNNs), Model checkpoints',
    advanced: 'Transformer attention mechanisms, Vision Transformers (ViT), Distributed Data Parallel (DDP), TensorRT export'
  }
];

export default function AdminPortal() {
  const [activeModule, setActiveModule] = useState('templates'); // 'templates' | 'announcements' | 'feedback' | 'emergency' | 'banlist' | 'collaborators'
  const [userProfile, setUserProfile] = useState(() => getLoggedInUserProfile());
  const [userEmail, setUserEmail] = useState(() => getCurrentUserEmail());
  const [userRole, setUserRole] = useState(() => getUserRole());
  const isSuper = userRole === 'SUPER_ADMIN';

  // State synchronization on simulated role change or storage changes
  useEffect(() => {
    const handleRoleSync = () => {
      const p = getLoggedInUserProfile();
      setUserProfile(p);
      const email = getCurrentUserEmail();
      setUserEmail(email);
      setUserRole(getUserRole(email));
    };

    window.addEventListener('studyflow-role-switched', handleRoleSync);
    window.addEventListener('studyflow-collaborators-changed', handleRoleSync);
    window.addEventListener('storage', handleRoleSync);
    return () => {
      window.removeEventListener('studyflow-role-switched', handleRoleSync);
      window.removeEventListener('studyflow-collaborators-changed', handleRoleSync);
      window.removeEventListener('storage', handleRoleSync);
    };
  }, []);

  // Notification Toast state
  const [toastMessage, setToastMessage] = useState(null);
  const showToast = (msg, type = 'info') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState(null);

  // -------------------------------------------------------------
  // MODULE 1: TEMPLATE STUDIO STATE & HANDLERS
  // -------------------------------------------------------------
  const [syllabiList, setSyllabiList] = useState(() => {
    try {
      const raw = localStorage.getItem(ADMIN_STORAGE_KEYS.SYLLABI_TEMPLATES);
      return raw ? JSON.parse(raw) : DEFAULT_SYLLABI_TEMPLATES;
    } catch {
      return DEFAULT_SYLLABI_TEMPLATES;
    }
  });

  const [skillsList, setSkillsList] = useState(() => {
    try {
      const raw = localStorage.getItem(ADMIN_STORAGE_KEYS.SKILL_ROADMAPS);
      return raw ? JSON.parse(raw) : DEFAULT_SKILL_ROADMAPS;
    } catch {
      return DEFAULT_SKILL_ROADMAPS;
    }
  });

  // Syllabus Form State
  const [sylTitle, setSylTitle] = useState('');
  const [sylCode, setSylCode] = useState('');
  const [sylExamDate, setSylExamDate] = useState('');
  const [sylModules, setSylModules] = useState([
    { id: 'm1', title: 'Module 1: Foundations', hours: 4, subtopics: 'Core principles, definitions, overview' }
  ]);

  // Skill Form State
  const [skillTitle, setSkillTitle] = useState('');
  const [skillCategory, setSkillCategory] = useState('Computer Science');
  const [skillVideoLink, setSkillVideoLink] = useState('');
  const [skillBeginner, setSkillBeginner] = useState('');
  const [skillIntermediate, setSkillIntermediate] = useState('');
  const [skillAdvanced, setSkillAdvanced] = useState('');

  // Auto-generate 3-tier subtopics handler
  const handleAutoGenerateSubtopics = () => {
    if (!skillTitle.trim()) {
      showToast('Please enter a Skill Title first to auto-generate subtopics.', 'warning');
      return;
    }
    const title = skillTitle.trim();
    setSkillBeginner(`Fundamental terminology, core syntax, environment setup, introductory exercises in ${title}`);
    setSkillIntermediate(`Architecture patterns, state management, testing workflows, intermediate algorithms in ${title}`);
    setSkillAdvanced(`Performance profiling, distributed scale, memory optimization, production best practices in ${title}`);
    showToast(`Generated 3-tier subtopics for "${title}"!`, 'success');
  };

  const handleAddSyllabusModule = () => {
    const nextIdx = sylModules.length + 1;
    setSylModules([
      ...sylModules,
      { id: 'm' + Date.now(), title: `Module ${nextIdx}: Advanced Topics`, hours: 6, subtopics: 'Deep dive, problem solving' }
    ]);
  };

  const handleRemoveSyllabusModule = (id) => {
    if (sylModules.length <= 1) return;
    setSylModules(sylModules.filter(m => m.id !== id));
  };

  const handleSaveSyllabus = (e) => {
    e.preventDefault();
    if (!sylTitle.trim() || !sylCode.trim()) return;

    const newSyllabus = {
      id: 'syl_' + Date.now(),
      title: sylTitle.trim(),
      code: sylCode.trim().toUpperCase(),
      examDate: sylExamDate,
      createdAt: new Date().toISOString().split('T')[0],
      modules: [...sylModules]
    };

    const updated = [newSyllabus, ...syllabiList];
    setSyllabiList(updated);
    localStorage.setItem(ADMIN_STORAGE_KEYS.SYLLABI_TEMPLATES, JSON.stringify(updated));

    // Reset Form
    setSylTitle('');
    setSylCode('');
    setSylExamDate('');
    setSylModules([{ id: 'm1', title: 'Module 1: Foundations', hours: 4, subtopics: 'Core principles' }]);
    showToast(`Saved syllabus template for ${newSyllabus.code}!`, 'success');
    celebrateTaskCompletion();
  };

  const handleSaveSkillRoadmap = (e) => {
    e.preventDefault();
    if (!skillTitle.trim()) return;

    const newSkill = {
      id: 'skill_' + Date.now(),
      title: skillTitle.trim(),
      category: skillCategory,
      videoLink: skillVideoLink.trim(),
      createdAt: new Date().toISOString().split('T')[0],
      beginner: skillBeginner.trim() || `Basics of ${skillTitle.trim()}`,
      intermediate: skillIntermediate.trim() || `Intermediate concepts in ${skillTitle.trim()}`,
      advanced: skillAdvanced.trim() || `Advanced topics and optimizations in ${skillTitle.trim()}`
    };

    const updated = [newSkill, ...skillsList];
    setSkillsList(updated);
    localStorage.setItem(ADMIN_STORAGE_KEYS.SKILL_ROADMAPS, JSON.stringify(updated));

    // Reset Form
    setSkillTitle('');
    setSkillVideoLink('');
    setSkillBeginner('');
    setSkillIntermediate('');
    setSkillAdvanced('');
    showToast(`Saved curated skill roadmap for "${newSkill.title}"!`, 'success');
    celebrateTaskCompletion();
  };

  const handleExportStarterJson = () => {
    const starterPack = {
      version: '2.5.0',
      exportedAt: new Date().toISOString(),
      generator: 'StudyFlow Template Studio',
      description: 'Official starter course syllabi and curated YouTube skill roadmaps',
      syllabi: syllabiList,
      skills: skillsList
    };

    const jsonString = JSON.stringify(starterPack, null, 2);

    // 1. Download as starter JSON file
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `studyflow-starter-pack-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // 2. Also copy to clipboard
    try {
      navigator.clipboard.writeText(jsonString);
      showToast('Exported & downloaded Starter JSON! (Also copied to clipboard)', 'success');
    } catch {
      showToast('Exported & downloaded Starter JSON successfully!', 'success');
    }
  };

  // -------------------------------------------------------------
  // MODULE 2: GLOBAL ANNOUNCEMENT BANNER STATE & HANDLERS
  // -------------------------------------------------------------
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementUrgency, setAnnouncementUrgency] = useState('normal');
  const [announcementExpires, setAnnouncementExpires] = useState('');
  const [activeAnnouncement, setActiveAnnouncement] = useState(() => getPlatformAnnouncement());

  useEffect(() => {
    const handleAnnSync = () => setActiveAnnouncement(getPlatformAnnouncement());
    window.addEventListener('studyflow-announcement-changed', handleAnnSync);
    return () => window.removeEventListener('studyflow-announcement-changed', handleAnnSync);
  }, []);

  const handlePublishAnnouncement = (e) => {
    e.preventDefault();
    if (!announcementText.trim()) return;

    const result = setPlatformAnnouncement({
      text: announcementText.trim(),
      urgency: announcementUrgency,
      expiresAt: announcementExpires
    });

    if (result) {
      setActiveAnnouncement(result);
      setAnnouncementText('');
      showToast('Global announcement banner published across all student pages!', 'success');
      soundEngine.playTaskComplete();
    }
  };

  const handleClearAnnouncement = () => {
    clearPlatformAnnouncement();
    setActiveAnnouncement(null);
    showToast('Global announcement cleared from all pages.', 'info');
  };

  // -------------------------------------------------------------
  // MODULE 3: FEEDBACK & BUG DRAWER STATE & HANDLERS
  // -------------------------------------------------------------
  const [bugReports, setBugReports] = useState(() => getBugReports());
  const [bugFilter, setBugFilter] = useState('All');
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);
  const [newBugTitle, setNewBugTitle] = useState('');
  const [newBugCategory, setNewBugCategory] = useState('General');
  const [newBugDesc, setNewBugDesc] = useState('');
  const [newBugEmail, setNewBugEmail] = useState('');

  useEffect(() => {
    const handleBugSync = () => setBugReports(getBugReports());
    window.addEventListener('studyflow-bugs-changed', handleBugSync);
    return () => window.removeEventListener('studyflow-bugs-changed', handleBugSync);
  }, []);

  const handleCycleBugStatus = (id, currentStatus) => {
    const nextStatus = currentStatus === 'Open' ? 'In Review' : currentStatus === 'In Review' ? 'Resolved' : 'Open';
    updateBugStatus(id, nextStatus);
    showToast(`Updated bug report ${id} status to "${nextStatus}"!`, 'info');
  };

  const handleCreateBug = (e) => {
    e.preventDefault();
    if (!newBugTitle.trim() || !newBugDesc.trim()) return;
    addBugReport({
      title: newBugTitle.trim(),
      category: newBugCategory,
      description: newBugDesc.trim(),
      studentEmail: newBugEmail.trim() || 'student@studyflow.local'
    });
    setNewBugTitle('');
    setNewBugDesc('');
    setNewBugEmail('');
    setIsBugModalOpen(false);
    showToast('Student bug report recorded into drawer!', 'success');
  };

  // -------------------------------------------------------------
  // MODULE 4: EMERGENCY CONTROLS & KILL SWITCHES STATE & HANDLERS
  // -------------------------------------------------------------
  const [killswitches, setKillswitches] = useState(() => getEmergencyKillswitches());

  useEffect(() => {
    const handleKsSync = () => setKillswitches(getEmergencyKillswitches());
    window.addEventListener('studyflow-killswitch-changed', handleKsSync);
    return () => window.removeEventListener('studyflow-killswitch-changed', handleKsSync);
  }, []);

  const requestToggleKillswitch = (key, switchName) => {
    if (!isSuper) {
      showToast('Permission Denied: Only Super Admins can toggle emergency kill switches.', 'error');
      return;
    }

    const nextValue = !killswitches[key];
    const actionVerb = nextValue ? 'ENABLE' : 'DISABLE';

    setConfirmModal({
      title: `Emergency Kill Switch: ${switchName}`,
      message: `Are you sure you want to ${actionVerb} "${switchName}"? This change immediately impacts all student sessions across the platform.`,
      actionLabel: `Confirm & ${actionVerb}`,
      isDangerous: !nextValue || key === 'maintenanceMode',
      onConfirm: () => {
        setEmergencyKillswitch(key, nextValue);
        showToast(`Updated ${switchName} to: ${nextValue ? 'ENABLED' : 'DISABLED'}`, 'info');
      }
    });
  };

  // -------------------------------------------------------------
  // MODULE 5: BAN LIST MANAGER STATE & HANDLERS
  // -------------------------------------------------------------
  const [bannedUsers, setBannedUsers] = useState(() => getBannedUsers());
  const [banInputEmail, setBanInputEmail] = useState('');
  const [banInputReason, setBanInputReason] = useState('Terms of service violation');

  useEffect(() => {
    const handleBanSync = () => setBannedUsers(getBannedUsers());
    window.addEventListener('studyflow-banned-users-changed', handleBanSync);
    return () => window.removeEventListener('studyflow-banned-users-changed', handleBanSync);
  }, []);

  const requestBanUser = (e) => {
    e.preventDefault();
    if (!isSuper) {
      showToast('Permission Denied: Only Super Admins can ban accounts.', 'error');
      return;
    }

    const emailToBan = banInputEmail.trim().toLowerCase();
    if (!emailToBan) return;

    setConfirmModal({
      title: 'Blacklist Student Account',
      message: `Are you sure you want to ban email "${emailToBan}"? The student will be immediately signed out and redirected to login.html?banned=true.`,
      actionLabel: 'Confirm & Ban Account',
      isDangerous: true,
      onConfirm: () => {
        const res = banUser(emailToBan, banInputReason.trim() || 'Administrative suspension', userEmail || 'Super Admin');
        if (res.success) {
          showToast(res.message, 'success');
          setBanInputEmail('');
        } else {
          showToast(res.message, 'error');
        }
      }
    });
  };

  const handleUnban = (email) => {
    if (!isSuper) {
      showToast('Permission Denied: Only Super Admins can unban accounts.', 'error');
      return;
    }
    unbanUser(email);
    showToast(`Restored access for ${email}`, 'info');
  };

  // -------------------------------------------------------------
  // MODULE 6: COLLABORATOR MANAGEMENT STATE & HANDLERS
  // -------------------------------------------------------------
  const [collaborators, setCollaborators] = useState(() => getCollaboratorsDetailed());
  const [collabInputEmail, setCollabInputEmail] = useState('');

  useEffect(() => {
    const handleCollabSync = () => setCollaborators(getCollaboratorsDetailed());
    window.addEventListener('studyflow-collaborators-changed', handleCollabSync);
    return () => window.removeEventListener('studyflow-collaborators-changed', handleCollabSync);
  }, []);

  const handleAddCollab = (e) => {
    e.preventDefault();
    if (!isSuper) {
      showToast('Permission Denied: Only Super Admins can add collaborators.', 'error');
      return;
    }

    const res = addCollaborator(collabInputEmail.trim(), userEmail || 'Super Admin');
    if (res.success) {
      showToast(res.message, 'success');
      setCollabInputEmail('');
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleRemoveCollab = (email) => {
    if (!isSuper) {
      showToast('Permission Denied: Only Super Admins can remove collaborators.', 'error');
      return;
    }

    setConfirmModal({
      title: 'Revoke Collaborator Access',
      message: `Are you sure you want to revoke Editor privileges for "${email}"?`,
      actionLabel: 'Revoke Access',
      isDangerous: true,
      onConfirm: () => {
        removeCollaborator(email);
        showToast(`Revoked Editor privileges for ${email}`, 'info');
      }
    });
  };

  // Filtered bug reports
  const filteredBugs = bugReports.filter(b => {
    if (bugFilter === 'All') return true;
    return b.status === bugFilter;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      
      {/* Role Testing Simulator Bar for seamless zero-cost client evaluation */}
      <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-emerald-500/10 border border-theme-border/80 flex flex-col md:flex-row items-center justify-between gap-3 text-xs shadow-sm">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-theme-accent" />
          <span className="font-semibold text-theme-text">Developer Role Persona Switcher:</span>
          <span className="text-theme-muted hidden sm:inline">(Test role-based feature gating instantly)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSimulatedRole('SUPER_ADMIN')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
              userRole === 'SUPER_ADMIN'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-theme-surface hover:bg-theme-cardHover text-theme-muted hover:text-theme-text border border-theme-border'
            }`}
          >
            👑 Super Admin
          </button>
          <button
            onClick={() => setSimulatedRole('EDITOR')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
              userRole === 'EDITOR'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'bg-theme-surface hover:bg-theme-cardHover text-theme-muted hover:text-theme-text border border-theme-border'
            }`}
          >
            ✏️ Editor
          </button>
          <button
            onClick={() => setSimulatedRole('STUDENT')}
            title="Switch to regular student (triggers access denied redirect)"
            className="px-3 py-1.5 rounded-xl font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all cursor-pointer"
          >
            🎓 Regular Student (Test Gate)
          </button>
        </div>
      </div>

      {/* Main Admin Portal Header */}
      <div className="p-6 rounded-3xl glass-panel border border-theme-border shadow-xl backdrop-blur-xl bg-theme-surface/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-md">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-theme-text">
              Admin & Collaborator Portal
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
              isSuper 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}>
              {isSuper ? '👑 Super Admin' : '✏️ Editor'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-theme-muted max-w-2xl">
            {isSuper 
              ? 'Unrestricted system access: manage syllabi starter packs, skill roadmaps, announcements, kill switches, and collaborator access.'
              : 'Collaborator privileges: build course syllabi templates, draft global announcements, and review student bug reports.'}
          </p>
        </div>

        {/* User Identity Pill */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-2.5 rounded-2xl bg-theme-bg/60 border border-theme-border/60 flex items-center gap-2.5 text-xs">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-amber-500 text-white font-bold flex items-center justify-center text-xs">
              {(userProfile?.name || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-theme-text truncate max-w-[140px]">{userProfile?.name || 'Administrator'}</p>
              <p className="text-[11px] text-theme-muted truncate max-w-[140px]">{userEmail || 'admin@studyflow.local'}</p>
            </div>
          </div>
          <a
            href="/index.html"
            className="px-3.5 py-2.5 rounded-2xl bg-theme-surface hover:bg-theme-cardHover border border-theme-border text-xs font-semibold text-theme-text transition-all hover:brightness-105 active:scale-95 text-center shrink-0"
          >
            ← Main Tracker
          </a>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        {[
          { id: 'templates', label: 'Template Studio', icon: BookOpen, accent: 'text-indigo-400' },
          { id: 'announcements', label: 'Global Announcement', icon: Bell, accent: 'text-blue-400' },
          { id: 'feedback', label: 'Feedback & Bug Drawer', icon: AlertCircle, accent: 'text-emerald-400' },
          { id: 'emergency', label: 'Emergency Controls', icon: Sliders, accent: 'text-amber-400', superOnly: true },
          { id: 'banlist', label: 'Ban List Manager', icon: UserX, accent: 'text-rose-400', superOnly: true },
          { id: 'collaborators', label: 'Collaborators', icon: Users, accent: 'text-purple-400', superOnly: true }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeModule === tab.id;
          const isLockedForEditor = tab.superOnly && !isSuper;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveModule(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/25 border border-indigo-400/30'
                  : 'bg-theme-surface hover:bg-theme-cardHover text-theme-muted hover:text-theme-text border border-theme-border/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : tab.accent}`} />
              <span>{tab.label}</span>
              {isLockedForEditor && (
                <span title="Super Admin Only" className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Padlock</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* MODULE 1: TEMPLATE STUDIO (Super Admin & Editors)                */}
      {/* ----------------------------------------------------------------- */}
      {activeModule === 'templates' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-theme-surface/60 border border-theme-border/60">
            <div>
              <h2 className="font-display font-bold text-lg text-theme-text">Curated Academic Template Studio</h2>
              <p className="text-xs text-theme-muted">Build structured syllabus roadmaps & curated YouTube skill packs. Export as Starter JSON for students.</p>
            </div>
            <button
              onClick={handleExportStarterJson}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Export as Starter JSON</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Syllabi Builder Form */}
            <div className="p-6 rounded-3xl glass-panel border border-theme-border shadow-xl backdrop-blur-xl bg-theme-surface/70 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-theme-border/60">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <h3 className="font-display font-bold text-base text-theme-text">Create Subject Syllabus</h3>
              </div>

              <form onSubmit={handleSaveSyllabus} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-theme-muted mb-1 font-medium">Subject Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Operating Systems & Kernel Architecture"
                    value={sylTitle}
                    onChange={(e) => setSylTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-theme-bg border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-theme-muted mb-1 font-medium">Subject Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CS401"
                      value={sylCode}
                      onChange={(e) => setSylCode(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-theme-bg border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500 uppercase font-mono-numbers"
                    />
                  </div>
                  <div>
                    <label className="block text-theme-muted mb-1 font-medium">Exam Date (Optional)</label>
                    <input
                      type="date"
                      value={sylExamDate}
                      onChange={(e) => setSylExamDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-theme-bg border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500 font-mono-numbers"
                    />
                  </div>
                </div>

                {/* Modules / Chapters List */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-theme-muted font-semibold">Course Modules / Chapters ({sylModules.length})</label>
                    <button
                      type="button"
                      onClick={handleAddSyllabusModule}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Chapter</span>
                    </button>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                    {sylModules.map((m, idx) => (
                      <div key={m.id} className="p-3 rounded-xl bg-theme-bg/60 border border-theme-border/60 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Module Title (e.g. Module 1: Process Synchronization)"
                            value={m.title}
                            onChange={(e) => {
                              const updated = [...sylModules];
                              updated[idx].title = e.target.value;
                              setSylModules(updated);
                            }}
                            className="flex-1 px-2.5 py-1 rounded-lg bg-theme-surface border border-theme-border text-theme-text text-xs"
                          />
                          <input
                            type="number"
                            min="1"
                            max="50"
                            placeholder="Hours"
                            title="Estimated study hours"
                            value={m.hours}
                            onChange={(e) => {
                              const updated = [...sylModules];
                              updated[idx].hours = Number(e.target.value) || 2;
                              setSylModules(updated);
                            }}
                            className="w-16 px-2 py-1 rounded-lg bg-theme-surface border border-theme-border text-theme-text text-xs text-center font-mono-numbers"
                          />
                          {sylModules.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSyllabusModule(m.id)}
                              className="text-theme-muted hover:text-rose-400 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="Subtopics (comma-separated, e.g. Semaphores, Mutex, Monitors)"
                          value={m.subtopics}
                          onChange={(e) => {
                            const updated = [...sylModules];
                            updated[idx].subtopics = e.target.value;
                            setSylModules(updated);
                          }}
                          className="w-full px-2.5 py-1 rounded-lg bg-theme-surface border border-theme-border text-theme-text text-[11px]"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Save Syllabus Template
                </button>
              </form>
            </div>

            {/* YouTube Skill Roadmaps Form */}
            <div className="p-6 rounded-3xl glass-panel border border-theme-border shadow-xl backdrop-blur-xl bg-theme-surface/70 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-theme-border/60">
                <div className="flex items-center gap-2">
                  <YouTubeIcon className="w-5 h-5 text-rose-400" />
                  <h3 className="font-display font-bold text-base text-theme-text">Curated YouTube Skill Roadmap</h3>
                </div>
                <button
                  type="button"
                  onClick={handleAutoGenerateSubtopics}
                  title="Auto-generates beginner, intermediate, and advanced subtopics based on title"
                  className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30 text-[11px] font-semibold flex items-center gap-1 transition-all"
                >
                  <Sparkles className="w-3 h-3 text-rose-400" />
                  <span>Auto-Generate Tiers</span>
                </button>
              </div>

              <form onSubmit={handleSaveSkillRoadmap} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-theme-muted mb-1 font-medium">Skill Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rust Systems Programming"
                    value={skillTitle}
                    onChange={(e) => setSkillTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-theme-bg border border-theme-border text-theme-text focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-theme-muted mb-1 font-medium">Category</label>
                    <select
                      value={skillCategory}
                      onChange={(e) => setSkillCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-theme-bg border border-theme-border text-theme-text focus:outline-none focus:border-rose-500"
                    >
                      <option>Computer Science</option>
                      <option>Artificial Intelligence</option>
                      <option>System Design</option>
                      <option>Web Development</option>
                      <option>Mathematics</option>
                      <option>Cybersecurity</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-theme-muted mb-1 font-medium">Curated YouTube URL</label>
                    <input
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={skillVideoLink}
                      onChange={(e) => setSkillVideoLink(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-theme-bg border border-theme-border text-theme-text focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                {/* 3-Tier Subtopics */}
                <div className="space-y-2.5 pt-1">
                  <div>
                    <label className="block text-emerald-400 font-semibold mb-1">Tier 1: Beginner Subtopics</label>
                    <input
                      type="text"
                      placeholder="e.g. Ownership & Borrowing basics, cargo setup, primitive types"
                      value={skillBeginner}
                      onChange={(e) => setSkillBeginner(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-theme-bg border border-theme-border text-theme-text text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-indigo-400 font-semibold mb-1">Tier 2: Intermediate Subtopics</label>
                    <input
                      type="text"
                      placeholder="e.g. Traits, Lifetimes, Error handling, Concurrency with Arc & Mutex"
                      value={skillIntermediate}
                      onChange={(e) => setSkillIntermediate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-theme-bg border border-theme-border text-theme-text text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-purple-400 font-semibold mb-1">Tier 3: Advanced Subtopics</label>
                    <input
                      type="text"
                      placeholder="e.g. Unsafe Rust, FFI bindings, Tokio async runtimes, SIMD intrinsics"
                      value={skillAdvanced}
                      onChange={(e) => setSkillAdvanced(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-theme-bg border border-theme-border text-theme-text text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Save Skill Roadmap
                </button>
              </form>
            </div>

          </div>

          {/* Active Templates Library Display */}
          <div className="p-6 rounded-3xl glass-panel border border-theme-border shadow-xl backdrop-blur-xl bg-theme-surface/70 space-y-4">
            <h3 className="font-display font-bold text-base text-theme-text">Active Course Templates & Roadmaps ({syllabiList.length + skillsList.length})</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {syllabiList.map((syl) => (
                <div key={syl.id} className="p-4 rounded-2xl bg-theme-bg/60 border border-theme-border/60 hover:border-indigo-500/40 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono-numbers font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {syl.code}
                      </span>
                      <span className="text-[11px] text-theme-muted font-mono-numbers">
                        {syl.modules?.length || 0} Modules
                      </span>
                    </div>
                    <h4 className="font-semibold text-xs text-theme-text line-clamp-1">{syl.title}</h4>
                    <p className="text-[11px] text-theme-muted mt-1">Exam: {syl.examDate || 'Open'}</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-theme-border/40 flex items-center justify-between">
                    <span className="text-[10px] text-theme-muted">Syllabus Template</span>
                    <button
                      onClick={() => {
                        const next = syllabiList.filter(s => s.id !== syl.id);
                        setSyllabiList(next);
                        localStorage.setItem(ADMIN_STORAGE_KEYS.SYLLABI_TEMPLATES, JSON.stringify(next));
                      }}
                      className="text-theme-muted hover:text-rose-400 p-1"
                      title="Delete template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {skillsList.map((skill) => (
                <div key={skill.id} className="p-4 rounded-2xl bg-theme-bg/60 border border-theme-border/60 hover:border-rose-500/40 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {skill.category}
                      </span>
                      <YouTubeIcon className="w-3.5 h-3.5 text-rose-400" />
                    </div>
                    <h4 className="font-semibold text-xs text-theme-text line-clamp-1">{skill.title}</h4>
                    <p className="text-[11px] text-theme-muted mt-1 line-clamp-1">{skill.beginner}</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-theme-border/40 flex items-center justify-between">
                    <span className="text-[10px] text-theme-muted">3-Tier Skill Roadmap</span>
                    <button
                      onClick={() => {
                        const next = skillsList.filter(s => s.id !== skill.id);
                        setSkillsList(next);
                        localStorage.setItem(ADMIN_STORAGE_KEYS.SKILL_ROADMAPS, JSON.stringify(next));
                      }}
                      className="text-theme-muted hover:text-rose-400 p-1"
                      title="Delete roadmap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MODULE 2: GLOBAL ANNOUNCEMENT BANNER (Super Admin & Editors)     */}
      {/* ----------------------------------------------------------------- */}
      {activeModule === 'announcements' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="p-6 rounded-3xl glass-panel border border-theme-border shadow-xl backdrop-blur-xl bg-theme-surface/70 space-y-5">
            <div>
              <h2 className="font-display font-bold text-lg text-theme-text">Global Announcement Banner Manager</h2>
              <p className="text-xs text-theme-muted">
                Publish a high-visibility floating banner displayed at the top of all student pages.
              </p>
            </div>

            {/* Current Active Banner Preview */}
            <div className="p-4 rounded-2xl bg-theme-bg/70 border border-theme-border/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider">Current Live Banner Status</span>
                {activeAnnouncement ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Active & Visible to Students
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-500/20 text-theme-muted border border-zinc-500/30">
                    No Active Banner
                  </span>
                )}
              </div>

              {activeAnnouncement ? (
                <div className={`p-3 rounded-xl flex items-center justify-between gap-3 text-xs ${
                  activeAnnouncement.urgency === 'warning'
                    ? 'bg-rose-500/20 border border-rose-500/40 text-rose-200'
                    : activeAnnouncement.urgency === 'motivational'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200'
                    : 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold uppercase tracking-wider text-[10px]">[{activeAnnouncement.urgency}]</span>
                    <span>{activeAnnouncement.text}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {activeAnnouncement.expiresAt && (
                      <span className="text-[11px] text-theme-muted font-mono-numbers">
                        Expires: {activeAnnouncement.expiresAt}
                      </span>
                    )}
                    <button
                      onClick={handleClearAnnouncement}
                      className="px-2 py-1 rounded bg-black/30 hover:bg-black/50 text-white font-semibold text-[11px] transition-colors"
                    >
                      Clear Banner
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-theme-muted italic">No floating announcement is currently active.</p>
              )}
            </div>

            {/* Announcement Creator Form */}
            <form onSubmit={handlePublishAnnouncement} className="space-y-4 text-xs">
              <div>
                <label className="block text-theme-muted mb-1 font-medium">Banner Message Text</label>
                <textarea
                  rows="3"
                  required
                  placeholder="e.g. 📢 Final Semester examinations begin in 2 weeks! Check your Exam Radar for upcoming papers."
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-theme-bg border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-theme-muted mb-1 font-medium">Urgency Theme Style</label>
                  <select
                    value={announcementUrgency}
                    onChange={(e) => setAnnouncementUrgency(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-theme-bg border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent"
                  >
                    <option value="normal">Normal (Informational Blue / Indigo Glow)</option>
                    <option value="motivational">Motivational (Emerald Green Glow & Flame)</option>
                    <option value="warning">Exam Warning (Amber / Rose Red Glow)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-theme-muted mb-1 font-medium">Expiration Date (Optional)</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={announcementExpires}
                    onChange={(e) => setAnnouncementExpires(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-theme-bg border border-theme-border text-theme-text focus:outline-none focus:border-theme-accent font-mono-numbers"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                {activeAnnouncement && (
                  <button
                    type="button"
                    onClick={handleClearAnnouncement}
                    className="px-4 py-2.5 rounded-xl bg-theme-surface hover:bg-theme-cardHover text-rose-400 border border-theme-border font-semibold transition-all"
                  >
                    Remove Active Banner
                  </button>
                )}
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Publish Floating Banner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MODULE 3: FEEDBACK & BUG DRAWER (Super Admin & Editors)          */}
      {/* ----------------------------------------------------------------- */}
      {activeModule === 'feedback' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="p-6 rounded-3xl glass-panel border border-theme-border shadow-xl backdrop-blur-xl bg-theme-surface/70 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-bold text-lg text-theme-text">Student Feedback & Bug Reports Drawer</h2>
                <p className="text-xs text-theme-muted">Review submitted bug tickets and cycle report status tags.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-theme-bg p-1 rounded-xl border border-theme-border text-xs">
                  {['All', 'Open', 'In Review', 'Resolved'].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setBugFilter(filter)}
                      className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                        bugFilter === filter
                          ? 'bg-theme-surface text-theme-text shadow-sm'
                          : 'text-theme-muted hover:text-theme-text'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setIsBugModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Submit Ticket</span>
                </button>
              </div>
            </div>

            {/* Bug Table */}
            <div className="overflow-x-auto rounded-2xl border border-theme-border/60">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-theme-bg/80 border-b border-theme-border/60 text-theme-muted uppercase font-mono-numbers text-[11px]">
                    <th className="py-3 px-4">Ticket ID</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Category & Title</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border/40">
                  {filteredBugs.map((bug) => (
                    <tr key={bug.id} className="hover:bg-theme-cardHover/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono-numbers font-bold text-indigo-400">
                        {bug.id}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-theme-text">{bug.studentName || 'Student'}</p>
                        <p className="text-[11px] text-theme-muted truncate max-w-[140px]">{bug.studentEmail}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-theme-bg border border-theme-border/60 text-theme-muted mr-1.5">
                          {bug.category}
                        </span>
                        <span className="font-medium text-theme-text">{bug.title}</span>
                      </td>
                      <td className="py-3.5 px-4 text-theme-muted max-w-xs truncate" title={bug.description}>
                        {bug.description}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleCycleBugStatus(bug.id, bug.status)}
                          title="Click to cycle status: Open -> In Review -> Resolved"
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            bug.status === 'Resolved'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                              : bug.status === 'In Review'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                          }`}
                        >
                          {bug.status} ↻
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            const updated = bugReports.filter(b => b.id !== bug.id);
                            setBugReports(updated);
                            localStorage.setItem(ADMIN_STORAGE_KEYS.FEEDBACK_BUGS, JSON.stringify(updated));
                            showToast(`Deleted ticket ${bug.id}`, 'info');
                          }}
                          className="text-theme-muted hover:text-rose-400 p-1.5 rounded-lg transition-colors"
                          title="Delete report"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredBugs.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-theme-muted text-xs">
                        No bug reports matching filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MODULE 4: EMERGENCY CONTROLS & KILL SWITCHES (Super Admin ONLY)   */}
      {/* ----------------------------------------------------------------- */}
      {activeModule === 'emergency' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="p-6 rounded-3xl glass-panel border border-theme-border shadow-xl backdrop-blur-xl bg-theme-surface/70 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-lg text-theme-text flex items-center gap-2">
                  <span>Emergency Controls & System Kill Switches</span>
                  {!isSuper && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>🔒 Super Admin Only</span>
                    </span>
                  )}
                </h2>
                <p className="text-xs text-theme-muted">
                  Toggle critical platform modules. Disabled switches immediately lock out sub-systems across all student clients.
                </p>
              </div>
            </div>

            {/* Padlock Warning Badge if viewed as Editor */}
            {!isSuper && (
              <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs flex items-center gap-3">
                <Lock className="w-5 h-5 shrink-0 text-amber-400" />
                <div>
                  <h4 className="font-semibold text-amber-200">Editor View - Read Only</h4>
                  <p className="text-[11px] text-amber-300/90">
                    Collaborator Editors have read-only visibility into emergency controls. Switch to Super Admin in the Developer Persona Bar above to toggle these switches.
                  </p>
                </div>
              </div>
            )}

            {/* Killswitch Toggles Grid */}
            <div className="space-y-4">
              
              {/* Switch 1: Google Drive Sync Module */}
              <div className="p-4 rounded-2xl bg-theme-bg/60 border border-theme-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${killswitches.driveSync ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm text-theme-text">Google Drive Sync Module</h4>
                      <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${killswitches.driveSync ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                        {killswitches.driveSync ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    <p className="text-xs text-theme-muted mt-0.5">
                      Controls client-side Google Drive API v3 (GIS) cloud backups and notes file sync.
                    </p>
                  </div>
                </div>

                <button
                  disabled={!isSuper}
                  onClick={() => requestToggleKillswitch('driveSync', 'Google Drive Sync Module')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    killswitches.driveSync
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {killswitches.driveSync ? 'Kill Drive Sync' : 'Enable Drive Sync'}
                </button>
              </div>

              {/* Switch 2: 7-Minute Instant Demo Mode */}
              <div className="p-4 rounded-2xl bg-theme-bg/60 border border-theme-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${killswitches.demoMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm text-theme-text">7-Minute Instant Demo Mode</h4>
                      <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${killswitches.demoMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                        {killswitches.demoMode ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    <p className="text-xs text-theme-muted mt-0.5">
                      Permits visitors to run guest sandbox sessions without authenticating via Google.
                    </p>
                  </div>
                </div>

                <button
                  disabled={!isSuper}
                  onClick={() => requestToggleKillswitch('demoMode', '7-Minute Instant Demo Mode')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    killswitches.demoMode
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {killswitches.demoMode ? 'Disable Demo Sandbox' : 'Enable Demo Sandbox'}
                </button>
              </div>

              {/* Switch 3: Maintenance Mode */}
              <div className="p-4 rounded-2xl bg-theme-bg/60 border border-theme-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${killswitches.maintenanceMode ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-500/20 text-theme-muted'}`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm text-theme-text">Maintenance Mode Lock</h4>
                      <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${killswitches.maintenanceMode ? 'bg-amber-500/20 text-amber-300 animate-pulse' : 'bg-zinc-500/20 text-theme-muted'}`}>
                        {killswitches.maintenanceMode ? 'ACTIVE (PAGES LOCKED)' : 'INACTIVE'}
                      </span>
                    </div>
                    <p className="text-xs text-theme-muted mt-0.5">
                      Locks all study tracker pages for regular students with a 'Platform Updating' screen. Super Admins bypass this screen.
                    </p>
                  </div>
                </div>

                <button
                  disabled={!isSuper}
                  onClick={() => requestToggleKillswitch('maintenanceMode', 'Maintenance Mode')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    killswitches.maintenanceMode
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  {killswitches.maintenanceMode ? 'Deactivate Maintenance' : 'Activate Maintenance'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MODULE 5: BAN LIST MANAGER (Super Admin ONLY)                     */}
      {/* ----------------------------------------------------------------- */}
      {activeModule === 'banlist' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="p-6 rounded-3xl glass-panel border border-theme-border shadow-xl backdrop-blur-xl bg-theme-surface/70 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-lg text-theme-text flex items-center gap-2">
                  <span>Student Ban List & Blacklist Manager</span>
                  {!isSuper && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>🔒 Super Admin Only</span>
                    </span>
                  )}
                </h2>
                <p className="text-xs text-theme-muted">
                  Banned emails trying to authenticate are immediately logged out and redirected to login.html?banned=true.
                </p>
              </div>
            </div>

            {/* Padlock Badge if Editor */}
            {!isSuper && (
              <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs flex items-center gap-3">
                <Lock className="w-5 h-5 shrink-0 text-amber-400" />
                <div>
                  <h4 className="font-semibold text-amber-200">Editor View - Read Only</h4>
                  <p className="text-[11px] text-amber-300/90">
                    Blacklist additions and account restorations require Super Admin privileges.
                  </p>
                </div>
              </div>
            )}

            {/* Ban Input Form */}
            <form onSubmit={requestBanUser} className="p-4 rounded-2xl bg-theme-bg/60 border border-theme-border/60 flex flex-col sm:flex-row items-end gap-3 text-xs">
              <div className="flex-1 w-full">
                <label className="block text-theme-muted mb-1 font-medium">Student Google Email to Ban</label>
                <input
                  type="email"
                  disabled={!isSuper}
                  required
                  placeholder="student.email@example.com"
                  value={banInputEmail}
                  onChange={(e) => setBanInputEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-rose-500 disabled:opacity-50"
                />
              </div>

              <div className="flex-1 w-full">
                <label className="block text-theme-muted mb-1 font-medium">Suspension Reason</label>
                <input
                  type="text"
                  disabled={!isSuper}
                  placeholder="e.g. Terms of service violation, abusive activity"
                  value={banInputReason}
                  onChange={(e) => setBanInputReason(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-rose-500 disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={!isSuper}
                className="w-full sm:w-auto px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
              >
                Blacklist Email
              </button>
            </form>

            {/* Banned Users Table */}
            <div className="overflow-x-auto rounded-2xl border border-theme-border/60">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-theme-bg/80 border-b border-theme-border/60 text-theme-muted uppercase font-mono-numbers text-[11px]">
                    <th className="py-3 px-4">Blacklisted Email</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Date Banned</th>
                    <th className="py-3 px-4">Banned By</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border/40">
                  {bannedUsers.map((b, idx) => {
                    const bEmail = typeof b === 'string' ? b : b?.email;
                    const bReason = typeof b === 'string' ? 'Administrative suspension' : b?.reason;
                    const bDate = typeof b === 'string' ? '2026-10-01' : b?.bannedAt;
                    const bBy = typeof b === 'string' ? 'Super Admin' : b?.bannedBy;

                    return (
                      <tr key={idx} className="hover:bg-theme-cardHover/50 transition-colors">
                        <td className="py-3 px-4 font-mono-numbers font-semibold text-rose-400">
                          {bEmail}
                        </td>
                        <td className="py-3 px-4 text-theme-text">
                          {bReason}
                        </td>
                        <td className="py-3 px-4 font-mono-numbers text-theme-muted">
                          {bDate}
                        </td>
                        <td className="py-3 px-4 text-theme-muted">
                          {bBy}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            disabled={!isSuper}
                            onClick={() => handleUnban(bEmail)}
                            className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            Unban
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {bannedUsers.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center py-6 text-theme-muted text-xs">
                        No students currently banned. Blacklist is clear.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MODULE 6: COLLABORATOR MANAGEMENT (Super Admin ONLY)              */}
      {/* ----------------------------------------------------------------- */}
      {activeModule === 'collaborators' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="p-6 rounded-3xl glass-panel border border-theme-border shadow-xl backdrop-blur-xl bg-theme-surface/70 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-lg text-theme-text flex items-center gap-2">
                  <span>Collaborator & Editor Access Management</span>
                  {!isSuper && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>🔒 Super Admin Only</span>
                    </span>
                  )}
                </h2>
                <p className="text-xs text-theme-muted">
                  Grant Editor privileges to trusted teaching assistants or study partners. Editors can curate course syllabi and draft announcements.
                </p>
              </div>
            </div>

            {/* Padlock Badge if Editor */}
            {!isSuper && (
              <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs flex items-center gap-3">
                <Lock className="w-5 h-5 shrink-0 text-amber-400" />
                <div>
                  <h4 className="font-semibold text-amber-200">Editor View - Read Only</h4>
                  <p className="text-[11px] text-amber-300/90">
                    Collaborators cannot grant or revoke Editor privileges. Only Super Admins can manage collaborator invitations.
                  </p>
                </div>
              </div>
            )}

            {/* Add Collaborator Form */}
            <form onSubmit={handleAddCollab} className="p-4 rounded-2xl bg-theme-bg/60 border border-theme-border/60 flex flex-col sm:flex-row items-end gap-3 text-xs">
              <div className="flex-1 w-full">
                <label className="block text-theme-muted mb-1 font-medium">Google Account Email</label>
                <input
                  type="email"
                  disabled={!isSuper}
                  required
                  placeholder="collaborator.friend@gmail.com"
                  value={collabInputEmail}
                  onChange={(e) => setCollabInputEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-theme-surface border border-theme-border text-theme-text focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={!isSuper}
                className="w-full sm:w-auto px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Add Collaborator</span>
              </button>
            </form>

            {/* Active Collaborators List */}
            <div className="space-y-3">
              <h3 className="font-display font-semibold text-xs uppercase tracking-wider text-theme-muted">
                Active System Editors ({collaborators.length})
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {collaborators.map((c) => (
                  <div key={c.email} className="p-4 rounded-2xl bg-theme-bg/60 border border-theme-border/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-indigo-500 text-white font-bold flex items-center justify-center text-xs shrink-0">
                        {c.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-xs text-theme-text truncate">{c.email}</p>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Editor
                          </span>
                        </div>
                        <p className="text-[11px] text-theme-muted">Added {c.addedAt} by {c.addedBy}</p>
                      </div>
                    </div>

                    {!c.isDefault && isSuper && (
                      <button
                        onClick={() => handleRemoveCollab(c.email)}
                        className="text-theme-muted hover:text-rose-400 p-1.5 rounded-lg transition-colors shrink-0"
                        title="Revoke access"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* CONFIRMATION MODAL PROMPT                                        */}
      {/* ----------------------------------------------------------------- */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl glass-dropdown p-6 shadow-2xl border border-theme-border relative bg-theme-surface/95">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-xl ${confirmModal.isDangerous ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold text-base text-theme-text">
                {confirmModal.title}
              </h3>
            </div>
            
            <p className="text-xs sm:text-sm text-theme-muted leading-relaxed mb-6">
              {confirmModal.message}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-theme-surface text-theme-muted hover:text-theme-text border border-theme-border text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className={`px-5 py-2 rounded-xl text-white font-bold text-xs shadow-md active:scale-95 cursor-pointer ${
                  confirmModal.isDangerous ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* SUBMIT STUDENT BUG / FEEDBACK MODAL                              */}
      {/* ----------------------------------------------------------------- */}
      {isBugModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl glass-dropdown p-6 shadow-2xl border border-theme-border relative bg-theme-surface/95">
            <div className="flex items-center justify-between pb-3 border-b border-theme-border mb-4">
              <h3 className="font-display font-bold text-base text-theme-text flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-emerald-400" />
                <span>Submit Student Bug or Feedback</span>
              </h3>
              <button onClick={() => setIsBugModalOpen(false)} className="text-theme-muted hover:text-theme-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBug} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-theme-muted mb-1 font-medium">Issue Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Spaced repetition queue not incrementing interval"
                  value={newBugTitle}
                  onChange={(e) => setNewBugTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-bg border border-theme-border text-theme-text focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-theme-muted mb-1 font-medium">Category</label>
                  <select
                    value={newBugCategory}
                    onChange={(e) => setNewBugCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-bg border border-theme-border text-theme-text focus:outline-none focus:border-emerald-500"
                  >
                    <option>General</option>
                    <option>Timer Audio</option>
                    <option>Drive Sync</option>
                    <option>Exam Radar</option>
                    <option>Revision Queue</option>
                    <option>Daily Routine</option>
                  </select>
                </div>
                <div>
                  <label className="block text-theme-muted mb-1 font-medium">Student Email</label>
                  <input
                    type="email"
                    placeholder="student@studyflow.local"
                    value={newBugEmail}
                    onChange={(e) => setNewBugEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-theme-bg border border-theme-border text-theme-text focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-theme-muted mb-1 font-medium">Description</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Detailed description of unexpected behavior..."
                  value={newBugDesc}
                  onChange={(e) => setNewBugDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-theme-bg border border-theme-border text-theme-text focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBugModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-theme-surface text-theme-muted hover:text-theme-text border border-theme-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                >
                  Save Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 animate-fadeIn ${
          toastMessage.type === 'success'
            ? 'bg-emerald-600 text-white border-emerald-400'
            : toastMessage.type === 'error'
            ? 'bg-rose-600 text-white border-rose-400'
            : toastMessage.type === 'warning'
            ? 'bg-amber-600 text-white border-amber-400'
            : 'bg-indigo-600 text-white border-indigo-400'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toastMessage.msg}</span>
        </div>
      )}

    </div>
  );
}
