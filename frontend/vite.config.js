// ─────────────────────────────────────────────────────────────────────────────
// frontend/vite.config.js  — FIXED (full replacement)
//
// Bug fix applied:
//   [M3] Added /uploads proxy entry so that attachment download links
//        (/uploads/inquiry/<filename>) are forwarded to the backend at
//        http://localhost:5000 during development.
//        Without this, the Vite dev server returns 404 for all file downloads.
//        (In production this is not needed because the same Express server
//        serves both the API and the static uploads/ directory.)
// ─────────────────────────────────────────────────────────────────────────────

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target:       'http://localhost:5000',
        changeOrigin: true,
      },
      // [FIX M3] Forward uploaded-file requests to the backend
      '/uploads': {
        target:       'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
