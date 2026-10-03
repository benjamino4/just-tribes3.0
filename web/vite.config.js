// ═══════════════════════════════════════════════════════════════════
// FILE: web/vite.config.js
// PURPOSE: Vite config. Outputs to server/public. Proxy /api in dev.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '..', 'server', 'public'),
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: 4096
  },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } }
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } }
});