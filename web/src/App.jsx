import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import TopBar from './components/TopBar.jsx';
import TabBar from './components/TabBar.jsx';
import ToastHost from './components/Toast.jsx';
import Fire from './screens/Fire.jsx';
import Tribe from './screens/Tribe.jsx';
import Ranks from './screens/Ranks.jsx';
import Lands from './screens/Lands.jsx';
import Store from './screens/Store.jsx';
import Profile from './screens/Profile.jsx';
import HomeSub from './screens/home/index.jsx';
import TribeSub from './screens/tribe/index.jsx';
import PackOpen from './screens/store/PackOpen.jsx';
import Admin from './screens/admin/Admin.jsx';
import { useGame } from './store.js';
import { variantFor } from './lib/transitions.js';

function Boot() {
  return (
    <div className="center" style={{ position: 'fixed', inset: 0, zIndex: 300, flexDirection: 'column', gap: 16 }}>
      <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.6, repeat: Infinity }}
        style={{ width: 64, height: 64, borderRadius: 20, background: 'radial-gradient(circle at 35% 30%, var(--ember-400), var(--ember-700))', boxShadow: 'var(--sh-ember)' }} />
      <span className="display" style={{ letterSpacing: '.12em', fontSize: 18 }}>TRIBES</span>
    </div>
  );
}

// Sub-pages live outside the tab bar; the tab bar only shows on the 5 roots.
const ROOTS = ['/', '/tribe', '/ranks', '/lands', '/store'];

export default function App() {
  const { loading, load } = useGame();
  const loc = useLocation();
  useEffect(() => { load(); }, [load]);
  if (loading) return <Boot />;

  const v = variantFor(loc.pathname);
  const showTabs = ROOTS.includes(loc.pathname);

  return (
    <div className="app-frame">
      <TopBar />
      <div className="scroller">
        <AnimatePresence mode="wait">
          <motion.div key={loc.pathname} initial={v.initial} animate={v.animate} exit={v.exit} transition={v.transition}>
            <Routes location={loc}>
              <Route path="/" element={<Fire />} />
              <Route path="/tribe" element={<Tribe />} />
              <Route path="/ranks" element={<Ranks />} />
              <Route path="/lands" element={<Lands />} />
              <Route path="/store" element={<Store />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/home/:id" element={<HomeSub />} />
              <Route path="/tribe/:id" element={<TribeSub />} />
              <Route path="/store/pack/:id" element={<PackOpen />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>
      {showTabs && <TabBar />}
      <ToastHost />
    </div>
  );
}
