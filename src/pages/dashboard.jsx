import React, { useState, useEffect } from 'react';
import { initPage } from '../../app-core';
import DashboardTab from '../components/tabs/DashboardTab';
import DailyRoutine from '../components/DailyRoutine';
import CalendarView from '../components/CalendarView';
import SubjectsTab from '../components/tabs/SubjectsTab';
import RevisionTab from '../components/tabs/RevisionTab';
import ExamsTab from '../components/tabs/ExamsTab';
import MockLogbookTab from '../components/tabs/MockLogbookTab';
import SkillsTab from '../components/tabs/SkillsTab';
import NotesTab from '../components/tabs/NotesTab';
import TimerTab from '../components/tabs/TimerTab';
import DriveModal from '../components/DriveModal';
import { useAuth } from '../context/AuthContext';
import { switchView, getCurrentView, initRouter } from '../../router.js';

export function SPAApp() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [activeView, setActiveView] = useState(() => getCurrentView());
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

  useEffect(() => {
    initRouter();

    const handleViewChange = (e) => {
      if (e.detail?.view) {
        setActiveView(e.detail.view);
      }
    };
    window.addEventListener('studyflow-view-changed', handleViewChange);

    const handleHash = () => {
      setActiveView(getCurrentView());
    };
    window.addEventListener('hashchange', handleHash);

    return () => {
      window.removeEventListener('studyflow-view-changed', handleViewChange);
      window.removeEventListener('hashchange', handleHash);
    };
  }, []);

  const handleNavigate = (tab) => {
    const lockedTabs = ['exams', 'radar', 'revision', 'skills', 'subjects', 'syllabus', 'notes'];
    if (!isAuthenticated && lockedTabs.includes(tab)) {
      const featureKey = (tab === 'exams' || tab === 'radar') ? 'radar' :
        (tab === 'revision') ? 'revision' :
          (tab === 'skills') ? 'skills' :
            (tab === 'notes') ? 'notes' : 'syllabus';
      openAuthModal(featureKey, `#${tab}`);
      return;
    }

    switchView(tab);
  };

  return (
    <div className="w-full max-w-none mx-0 relative min-h-full">
      {/* 1. Dashboard View */}
      <div 
        id="view-dashboard" 
        className={`app-view w-full max-w-none mx-0 ${activeView === 'dashboard' ? 'active-view' : ''}`}
        data-view="dashboard"
      >
        <DashboardTab onNavigateTab={handleNavigate} />
      </div>

      {/* 2. Daily Routine View */}
      <div 
        id="view-routine" 
        className={`app-view w-full max-w-none mx-0 ${activeView === 'routine' ? 'active-view' : ''}`}
        data-view="routine"
      >
        <DailyRoutine />
      </div>

      {/* 3. Calendar View */}
      <div 
        id="view-calendar" 
        className={`app-view w-full max-w-none mx-0 ${activeView === 'calendar' ? 'active-view' : ''}`}
        data-view="calendar"
      >
        <CalendarView />
      </div>

      {/* 4. Subjects & Syllabus View */}
      <div 
        id="view-syllabus" 
        className={`app-view w-full max-w-none mx-0 ${activeView === 'syllabus' ? 'active-view' : ''}`}
        data-view="syllabus"
      >
        <SubjectsTab />
      </div>

      {/* 5. Revision Queue View */}
      <div 
        id="view-revision" 
        className={`app-view w-full max-w-none mx-0 ${activeView === 'revision' ? 'active-view' : ''}`}
        data-view="revision"
      >
        <RevisionTab />
      </div>

      {/* 6. Exam Radar View */}
      <div 
        id="view-radar" 
        className={`app-view w-full max-w-none mx-0 ${activeView === 'radar' ? 'active-view' : ''}`}
        data-view="radar"
      >
        <ExamsTab />
      </div>

      {/* Mock Test & Mistake Logbook View */}
      <div 
        id="view-mock-logbook" 
        className={`app-view w-full max-w-none mx-0 ${activeView === 'mock-logbook' ? 'active-view' : ''}`}
        data-view="mock-logbook"
      >
        <MockLogbookTab onNavigateTab={handleNavigate} />
      </div>

      {/* 7. Skill Tracker View */}
      <div 
        id="view-skills" 
        className={`app-view w-full max-w-none mx-0 ${activeView === 'skills' ? 'active-view' : ''}`}
        data-view="skills"
      >
        <SkillsTab />
      </div>

      {/* 8. Drive Notes View */}
      <div 
        id="view-notes" 
        className={`app-view w-full max-w-none mx-0 ${activeView === 'notes' ? 'active-view' : ''}`}
        data-view="notes"
      >
        <NotesTab onOpenDriveModal={() => setIsDriveModalOpen(true)} />
        <DriveModal
          isOpen={isDriveModalOpen}
          onClose={() => setIsDriveModalOpen(false)}
        />
      </div>

      {/* 9. Focus Timer View */}
      <div 
        id="view-timer" 
        className={`app-view w-full max-w-none mx-0 ${activeView === 'timer' ? 'active-view' : ''}`}
        data-view="timer"
      >
        <TimerTab />
      </div>
    </div>
  );
}

export default SPAApp;

initPage(SPAApp, 'dashboard');
