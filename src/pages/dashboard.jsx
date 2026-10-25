import React from 'react';
import { initPage } from '../../app-core';
import DashboardTab from '../components/tabs/DashboardTab';

function DashboardPage() {
  const handleNavigate = (tab) => {
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
