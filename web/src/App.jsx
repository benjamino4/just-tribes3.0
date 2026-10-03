import { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import TopBar from './components/TopBar.jsx';
import TabBar from './components/TabBar.jsx';
import { ToastHost } from './components/Toast.jsx';
import IslandHost from './components/IslandHost.jsx';
import TickerHost from './components/TickerHost.jsx';
import GiftBox from './components/GiftBox.jsx';
import Startup from './screens/Startup.jsx';
import Hearth from './screens/Hearth.jsx';
import Arena from './screens/Arena.jsx';
import ArenaWar from './screens/ArenaWar.jsx';
import Tribe from './screens/Tribe.jsx';
import TribeKiva from './screens/TribeKiva.jsx';
import Vault from './screens/Vault.jsx';
import Profile from './screens/Profile.jsx';
import Help from './screens/Help.jsx';
import { V } from './lib/motion.js';
import { useApp } from './lib/store.jsx';
import { useEvents } from './lib/EventProvider.jsx';

function Shell() {
  const location = useLocation();
  const { reloadSilent } = useApp();
  const { subscribe } = useEvents();

  // Near-real-time, flicker-free refresh: whenever an island event lands
  // (new Kiva message, bless, reward, etc.) quietly re-pull state in place.
  // Debounced so a burst of events only triggers one silent refresh.
  useEffect(() => {
    let t = null;
    return subscribe((evt) => {
      if (!evt || evt.tier !== 'island') return;
      if (t) clearTimeout(t);
      t = setTimeout(() => { reloadSilent(); t = null; }, 250);
    });
  }, [subscribe, reloadSilent]);

  return (
    <div className="app-frame">
      <TopBar />
      <IslandHost />
      <TickerHost />
      <div className="scroller">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={V.page}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          >
            <Routes location={location}>
              <Route path="/" element={<Hearth />} />
              <Route path="/arena" element={<Arena />} />
              <Route path="/arena/war" element={<ArenaWar />} />
              <Route path="/tribe" element={<Tribe />} />
              <Route path="/tribe/kiva" element={<TribeKiva />} />
              <Route path="/vault" element={<Vault />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/help" element={<Help />} />
              <Route path="*" element={<div className="glass card" style={{ padding: 32, textAlign: 'center' }}>Not found</div>} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>
      <TabBar />
      <GiftBox />
      <ToastHost />
    </div>
  );
}

export default function App() {
  const [stage, setStage] = useState(() => {
    if (typeof window === 'undefined') return 'startup';
    if (!sessionStorage.getItem('tribes.startup')) return 'startup';
    return 'app';
  });

  function finishStartup() {
    try { sessionStorage.setItem('tribes.startup', '1'); } catch {}
    setStage('app');
  }

  return (
    <>
      {stage === 'startup' && <Startup onDone={finishStartup} />}
      {stage === 'app' && <Shell />}
    </>
  );
}