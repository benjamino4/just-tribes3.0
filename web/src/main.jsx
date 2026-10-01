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
import './styles/animations.css';
import './styles/reduced.css';
import './styles/war/_front.css';
import './styles/war/_silhouette.css';
import './styles/war/_score.css';
import './styles/war/_transition.css';
import './styles/games/_tokens.css';
import './styles/games/_frame.css';
import './styles/games/reflex.css';
import './styles/games/cascade.css';
import './styles/games/memory.css';
import './styles/games/rune.css';
import './styles/games/hands.css';
import './styles/games/bid.css';
import './styles/games/chain.css';
import './styles/games/masks.css';

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