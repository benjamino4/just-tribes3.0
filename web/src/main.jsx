// =====================================================================
// web/src/main.jsx — entry
// =====================================================================
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AppProvider } from './lib/store.jsx';
import { EmojiProvider } from './lib/emojiRegistry.jsx';
import { HintProvider } from './components/Hint.jsx';
import { initTelegram } from './lib/telegram.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/relics.css';
import './styles/kiva.css';
import './styles/war.css';
import './styles/animations.css';

initTelegram();

try {
  const mem = navigator.deviceMemory && navigator.deviceMemory <= 4;
  const cpu = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  if (mem && cpu) document.documentElement.setAttribute('data-fx', 'reduced');
} catch {}

try {
  const raw = localStorage.getItem('tribes.settings');
  const s = raw ? JSON.parse(raw) : { animations: true, haptics: true, sound: false };
  document.documentElement.setAttribute('data-fx', s.animations ? 'full' : 'reduced');
  window.__hapticsEnabled = s.haptics;
  window.__soundEnabled = s.sound;
  window.__animEnabled = s.animations;
} catch {}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <EmojiProvider>
          <HintProvider>
            <App />
          </HintProvider>
        </EmojiProvider>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
);