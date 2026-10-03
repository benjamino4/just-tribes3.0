import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AppProvider } from './lib/store.jsx';
import { EventProvider } from './lib/EventProvider.jsx';
import { LiveContentProvider } from './lib/liveContent.jsx';
import { initTelegram } from './lib/telegram.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/island.css';
import './styles/ticker.css';
import './styles/startup.css';
import './styles/arena.css';
import './styles/tribe.css';
import './styles/kiva.css';
import './styles/vault.css';
import './styles/war.css';
import './styles/games.css';

initTelegram();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <EventProvider>
          <LiveContentProvider>
            <App />
          </LiveContentProvider>
        </EventProvider>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
);