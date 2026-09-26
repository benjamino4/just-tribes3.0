import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Frontend builds into ../server/public so the existing Express server
// serves it as a single Render web service (no second service needed).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../server/public',
    emptyOutDir: true,
    target: 'es2019',
  },
  server: {
    port: 5173,
    // During `npm run dev`, proxy API calls to the local Express server.
    proxy: {
      '/api': 'http://localhost:3000',
      '/tonconnect-manifest.json': 'http://localhost:3000',
    },
  },
});
