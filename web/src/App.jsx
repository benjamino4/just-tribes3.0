// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/App.jsx
// PURPOSE: Routes. Startup flow. War pull. Four tabs. World.
// DEPENDS ON: everything
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import World from './components/World.jsx';
import TopBar from './components/TopBar.jsx';
import TabBar from './components/TabBar.jsx';
import { ToastHost } from './components/Toast.jsx';
import IslandHost from './components/IslandHost.jsx';
import TickerHost from './components/TickerHost.jsx';
import GiftBox from './components/GiftBox.jsx';
import Startup from './screens/Startup.jsx';
import Benchmark from './components/Benchmark.jsx';
import Hearth from './screens/Hearth.jsx';
import Arena from './screens/Arena.jsx';
import ArenaWar from './screens/ArenaWar.jsx';
import Tribe from './screens/Tribe.jsx';
import TribeKiva from './screens/TribeKiva.jsx';
import Vault from './screens/Vault.jsx';
import VaultStore from './screens/VaultStore.jsx';
import VaultForge from './screens/VaultForge.jsx';
import Profile from './screens/Profile.jsx';
import Help from './screens/Help.jsx';
import HelpArticle from './screens/HelpArticle.jsx';
import Referral from './screens/Referral.jsx';
import WarPullSequence from './components/WarPullSequence.jsx';
import RankUpSequence from './components/RankUpSequence.jsx';
import { V, useMotionConfig } from './lib/motion.js';
import { useApp } from './lib/store.jsx';
import { useEvents } from './lib/EventProvider.jsx';

function Shell() {
  const location = useLocation();
  const M = useMotionConfig();
  const { data } = useApp();
  const { subscribe } = useEvents();
  const [pulled, setPulled] = useState(false);
  const [rankUp, setRankUp] = useState(null);

  useEffect(() => {
    if (!data?.war?.war || pulled) return;
    const key = `tribes.pull.${data.war.war.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    setPulled(true);
  }, [data?.war?.war?.id, pulled]);

  useEffect(() => subscribe((evt) => {
    if (evt.kind === 'rank_change' && evt.action_data?.up) {
      setRankUp(evt.action_data);
    }
  }), [subscribe]);

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
            transition={M.buoyant}
          >
            <Routes location={location}>
              <Route path="/" element={<Hearth />} />
              <Route path="/arena" element={<Arena />} />
              <Route path="/arena/war" element={<ArenaWar />} />
              <Route path="/tribe" element={<Tribe />} />
              <Route path="/tribe/kiva" element={<TribeKiva />} />
              <Route path="/vault" element={<Vault />} />
              <Route path="/vault/store" element={<VaultStore />} />
              <Route path="/vault/forge" element={<VaultForge />} />
              <Route path="/referral" element={<Referral />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/help" element={<Help />} />
              <Route path="/help/:slug" element={<HelpArticle />} />
              <Route path="*" element={<div className="glass card" style={{ padding: 32, textAlign: 'center' }}>Not found</div>} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>
      <TabBar />
      <ToastHost />
      <GiftBox />
      {pulled && data?.war?.war && <WarPullSequence war={data.war} onDone={() => setPulled(false)} />}
      {rankUp && (
        <RankUpSequence
          tierFrom={{ color_hex: '#8899aa', emoji: '🪨', name: 'Flint' }}
          tierTo={{
            color_hex: rankUp.tier_to === 'gold' ? '#efc168' :
                       rankUp.tier_to === 'silver' ? '#c9d4e0' :
                       rankUp.tier_to === 'jade' ? '#55a882' :
                       rankUp.tier_to === 'obsidian' ? '#2a2735' :
                       rankUp.tier_to === 'eternal' ? '#fff3d0' : '#c08a4a',
            emoji: rankUp.tier_to === 'gold' ? '🟡' :
                   rankUp.tier_to === 'silver' ? '⚪' :
                   rankUp.tier_to === 'jade' ? '💚' :
                   rankUp.tier_to === 'obsidian' ? '⚫' :
                   rankUp.tier_to === 'eternal' ? '🔥' : '🟠',
            name: rankUp.tier_to.charAt(0).toUpperCase() + rankUp.tier_to.slice(1),
            title: rankUp.tier_to.charAt(0).toUpperCase() + rankUp.tier_to.slice(1) + ' Warlord'
          }}
          onDone={() => setRankUp(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  const [stage, setStage] = useState(() => {
    if (typeof window === 'undefined') return 'startup';
    if (!localStorage.getItem('tribes.perf')) return 'benchmark';
    if (!sessionStorage.getItem('tribes.startup')) return 'startup';
    return 'app';
  });

  function finishStartup() {
    try { sessionStorage.setItem('tribes.startup', '1'); } catch {}
    setStage('app');
  }

  return (
    <>
      <World />
      {stage === 'benchmark' && <Benchmark onDone={() => setStage('startup')} />}
      {stage === 'startup' && <Startup onDone={finishStartup} />}
      {stage === 'app' && <Shell />}
    </>
  );
}