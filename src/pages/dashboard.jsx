import React from 'react';
import { initPage } from '../../app-core';
import DashboardTab from '../components/tabs/DashboardTab';
import { useAuth } from '../context/AuthContext';

function DashboardPage() {
  const { isAuthenticated, openAuthModal } = useAuth();

  const handleNavigate = (tab) => {
    const lockedTabs = ['exams', 'radar', 'revision', 'skills', 'subjects', 'syllabus', 'notes'];
    if (!isAuthenticated && lockedTabs.includes(tab)) {
      const featureKey = (tab === 'exams' || tab === 'radar') ? 'radar' :
                         (tab === 'revision') ? 'revision' :
                         (tab === 'skills') ? 'skills' :
                         (tab === 'notes') ? 'notes' : 'syllabus';
      const targetUrl = (tab === 'exams' || tab === 'radar') ? '/radar.html' :
                        (tab === 'revision') ? '/revision.html' :
                        (tab === 'skills') ? '/skills.html' :
                        (tab === 'notes') ? '/notes.html' : '/syllabus.html';
      openAuthModal(featureKey, targetUrl);
      return;
    }

    const routeMap = {
      dashboard: '/index.html',
      routine: '/routine.html',
      calendar: '/calendar.html',
      subjects: '/syllabus.html',
      revision: '/revision.html',
      exams: '/radar.html',
      skills: '/skills.html',
      notes: '/notes.html',
      timer: '/timer.html'
    };
    window.location.href = routeMap[tab] || '/index.html';
  };

  return <DashboardTab onNavigateTab={handleNavigate} />;
}

initPage(DashboardPage, 'dashboard');
