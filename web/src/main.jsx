// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/main.jsx
// PURPOSE: React entry. Providers. Style imports. Boot sequence.
// DEPENDS ON: everything
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AppProvider } from './lib/store.jsx';
import { EmojiProvider } from './lib/emojiRegistry.jsx';
import { EventProvider } from './lib/EventProvider.jsx';
import { HintProvider } from './components/Hint.jsx';
import { initTelegram } from './lib/telegram.js';
import { initPerf } from './lib/perf.js';

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/animations.css';
import './styles/reduced.css';
import './styles/island.css';
import './styles/ticker.css';
import './styles/startup.css';
import './styles/benchmark.css';
import './styles/help.css';
import './styles/arena.css';
import './styles/tribe.css';
import './styles/kiva.css';
import './styles/vault.css';
import './styles/store.css';
import './styles/referral.css';

import './styles/materials/obsidian.css';
import './styles/materials/bone.css';
import './styles/materials/metal.css';
import './styles/materials/ember.css';
import './styles/materials/clay.css';
import './styles/materials/frost.css';
import './styles/materials/void.css';

import './styles/games/_frame.css';
import './styles/games/runematch.css';
import './styles/games/stonestack.css';
import './styles/games/fireflies.css';
import './styles/games/hands.css';
import './styles/games/flow.css';
import './styles/games/stonesort.css';
import './styles/games/bid.css';
import './styles/games/masks.css';
import './styles/games/chain.css';
import './styles/games/cascade.css';
import './styles/games/runeline.css';
import './styles/games/runebloom.css';

import './styles/war/_front.css';
import './styles/war/_score.css';
import './styles/war/_transition.css';

initTelegram();
initPerf();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <EmojiProvider>
          <EventProvider>
            <HintProvider>
              <App />
            </HintProvider>
          </EventProvider>
        </EmojiProvider>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
);