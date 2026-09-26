import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/global.css';
import './styles/components.css';
import App from './App.jsx';
import { initTelegram } from './lib/telegram.js';

initTelegram();

// Apply reduced-effects on low-end devices for buttery performance.
try {
  const lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4;
  const lowCore = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  if (lowMem && lowCore) document.documentElement.setAttribute('data-fx', 'reduced');
} catch (e) {}

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <div className="world" aria-hidden="true">
      <div className="aurora" />
      <div className="heat" />
      <div className="vig" />
    </div>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
