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
  { id: 'timer', name: 'Focus Timer', icon: Clock },
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Navigation Tabs Bar */}
        <div className="mb-6 overflow-x-auto pb-1 sm:pb-0">
          <nav className="flex space-x-1 sm:space-x-2 p-1.5 rounded-2xl glass-panel border border-theme-border w-max min-w-full sm:min-w-0" aria-label="Dashboard Navigation">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`nav-tab-item flex items-center space-x-2 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 ease-in-out relative whitespace-nowrap ${
                    isActive
                      ? 'bg-theme-accent text-white shadow-glow-accent font-semibold'
                      : 'text-theme-muted hover:text-theme-text hover:bg-theme-cardHover'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-theme-muted'}`} />
                  <span>{tab.name}</span>

                  {tab.id === 'routine' && pendingRoutineSlots > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono-numbers ${
                      isActive ? 'bg-white text-indigo-700' : 'bg-theme-accent text-white'
                    }`}>
                      {pendingRoutineSlots}
                    </span>
                  )}

                  {tab.id === 'revision' && dueRevisionCount > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono-numbers ${
                      isActive ? 'bg-white text-emerald-700' : 'bg-emerald-500 text-white'
                    }`}>
                      {dueRevisionCount}
                    </span>
                  )}

                  {tab.id === 'exams' && urgentCount > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono-numbers ${
                      isActive ? 'bg-white text-rose-700' : 'bg-rose-500 text-white'
                    }`}>
                      {urgentCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

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
