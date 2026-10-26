import React, { useEffect } from 'react';
import { initPage } from '../../app-core';
import AdminPortal from '../components/AdminPortal';
import { checkAdminAccess } from '../../admin-config';

function AdminPage() {
  useEffect(() => {
    // Secondary runtime check
    checkAdminAccess({ redirect: true });
  }, []);

  return <AdminPortal />;
}

initPage(AdminPage, 'admin');
