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
import { useGame } from './store.js';

const page = {
  initial: { opacity: 0, y: 14, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.99 },
};

function Boot() {
  return (
    <div className="center" style={{ position: 'fixed', inset: 0, zIndex: 300, flexDirection: 'column', gap: 16 }}>
      <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.6, repeat: Infinity }}
        style={{ width: 64, height: 64, borderRadius: 20, background: 'radial-gradient(circle at 35% 30%, var(--ember-400), var(--ember-700))', boxShadow: 'var(--sh-ember)' }} />
      <span className="display" style={{ letterSpacing: '.12em', fontSize: 18 }}>TRIBES</span>
    </div>
  );
}

export default function App() {
  const { loading, load } = useGame();
  const loc = useLocation();

  useEffect(() => { load(); }, [load]);

  if (loading) return <Boot />;

  return (
    <div className="app-frame">
      <TopBar />
      <div className="scroller">
        <AnimatePresence mode="wait">
          <motion.div
            key={loc.pathname}
            variants={page}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            <Routes location={loc}>
              <Route path="/" element={<Fire />} />
              <Route path="/tribe" element={<Tribe />} />
              <Route path="/ranks" element={<Ranks />} />
              <Route path="/lands" element={<Lands />} />
              <Route path="/store" element={<Store />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>
      <TabBar />
      <ToastHost />
    </div>
  );
}
