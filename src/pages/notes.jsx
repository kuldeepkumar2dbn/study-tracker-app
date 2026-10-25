import React, { useState } from 'react';
import { initPage } from '../../app-core';
import NotesTab from '../components/tabs/NotesTab';
import DriveModal from '../components/DriveModal';

function NotesPage() {
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

  return (
    <>
      <NotesTab onOpenDriveModal={() => setIsDriveModalOpen(true)} />
      <DriveModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
      />
    </>
  );
}

initPage(NotesPage, 'notes');
