import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        routine: resolve(import.meta.dirname, 'routine.html'),
        calendar: resolve(import.meta.dirname, 'calendar.html'),
        syllabus: resolve(import.meta.dirname, 'syllabus.html'),
        revision: resolve(import.meta.dirname, 'revision.html'),
        radar: resolve(import.meta.dirname, 'radar.html'),
        skills: resolve(import.meta.dirname, 'skills.html'),
        notes: resolve(import.meta.dirname, 'notes.html'),
        timer: resolve(import.meta.dirname, 'timer.html'),
        privacy: resolve(import.meta.dirname, 'privacy.html'),
        login: resolve(import.meta.dirname, 'login.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
      },
    },
  },
});
