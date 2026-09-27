import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AppProvider } from './lib/store.jsx';
import { MotionProvider } from './lib/motion.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

/* ---------- Telegram SDK ---------- */
try {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.('#0a0908');
    tg.setBackgroundColor?.('#07060a');
    tg.enableClosingConfirmation?.();
  }
} catch {}

/* ---------- reduced-effects tier (low-end phones) ---------- */
try {
  const mem = navigator.deviceMemory && navigator.deviceMemory <= 4;
  const cpu = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  if (mem && cpu) document.documentElement.setAttribute('data-fx', 'reduced');
} catch {}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <MotionProvider>
          <App />
        </MotionProvider>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
);
