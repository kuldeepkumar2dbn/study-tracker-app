import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Calendar as CalendarIcon, 
  Award, 
  FileText, 
  Clock, 
  Repeat,
  CheckCircle2,
  Sparkles,
  Cloud,
  Link2
} from 'lucide-react';
import Navbar from './components/Navbar';
import DriveModal from './components/DriveModal';
import DashboardTab from './components/tabs/DashboardTab';
import DailyRoutine from './components/DailyRoutine';
import CalendarView from './components/CalendarView';
import SubjectsTab from './components/tabs/SubjectsTab';
import RevisionTab from './components/tabs/RevisionTab';
import ExamsTab from './components/tabs/ExamsTab';
import SkillsTab from './components/tabs/SkillsTab';
import NotesTab from './components/tabs/NotesTab';
import TimerTab from './components/tabs/TimerTab';
import ImportantLinks from './components/ImportantLinks';
import { StopwatchIcon } from './components/CollapsibleSidebar';
import { useData } from './context/DataContext';

const TABS = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
  { id: 'routine', name: 'Daily Routine', icon: Clock },
  { id: 'calendar', name: 'Calendar', icon: CalendarIcon },
  { id: 'subjects', name: 'Subjects & Syllabus', icon: BookOpen },
  { id: 'revision', name: 'Revision Queue', icon: Repeat },
  { id: 'exams', name: 'Exam Radar', icon: CalendarIcon },
  { id: 'skills', name: 'Skill Tracker', icon: Award },
  { id: 'notes', name: 'Drive Notes', icon: FileText },
  { id: 'links', name: 'Important Links', icon: Link2 },
  { id: 'timer', name: 'Focus Timer', icon: StopwatchIcon },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const { exams, getTodayRevisionQueue, routineSlots } = useData();

  // Find urgent exams/assignments for indicator badge
  const urgentCount = exams.filter(e => {
    if (e.isCompleted) return false;
    const diffDays = (new Date(e.date) - new Date()) / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= 7;
  }).length;

  const dueRevisionCount = getTodayRevisionQueue().length;
  const pendingRoutineSlots = routineSlots.filter(s => !s.completed).length;

  return (
    <div className="min-h-screen flex flex-col bg-theme-bg text-theme-text transition-colors duration-200">
      
      {/* Top Navbar */}
      <Navbar 
        onOpenDriveModal={() => setIsDriveModalOpen(true)} 
        onLogoClick={() => setActiveTab('dashboard')} 
        onNavigateTab={setActiveTab}
      />

      {/* Main Container */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-8">

        {/* Tab Content Display */}
        <div key={activeTab} className="transition-all duration-300 animate-tab-enter">
          {activeTab === 'dashboard' && <DashboardTab onNavigateTab={setActiveTab} />}
          {activeTab === 'routine' && <DailyRoutine />}
          {activeTab === 'calendar' && <CalendarView />}
          {activeTab === 'subjects' && <SubjectsTab />}
          {activeTab === 'revision' && <RevisionTab />}
          {activeTab === 'exams' && <ExamsTab />}
          {activeTab === 'skills' && <SkillsTab />}
          {activeTab === 'notes' && <NotesTab onOpenDriveModal={() => setIsDriveModalOpen(true)} />}
          {activeTab === 'links' && <ImportantLinks />}
          {activeTab === 'timer' && <TimerTab />}
        </div>

      </main>

      {/* Subtle Footer */}
      <footer className="mt-auto border-t border-theme-border/60 py-4 text-center text-xs text-theme-muted">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="flex items-center gap-1.5">
            <span>StudyFlow</span>
            <span>•</span>
            <span>Personal Daily Study & Skill Tracker</span>
          </p>
          <p className="text-[11px] font-mono-numbers">
            Client-Side Google Drive API v3 (GIS) & LocalStorage Active
          </p>
        </div>
      </footer>

      {/* Google Drive Settings & Client ID Modal */}
      <DriveModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
      />

    </div>
  );
}
