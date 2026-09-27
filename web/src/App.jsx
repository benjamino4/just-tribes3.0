// TRIBES-FILE: web/src/App.jsx
// PHASE: 3 — Economy
// Adds Trials and Spin routes (reached from the Hearth constellation).

import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import World from './components/World.jsx';
import TopBar from './components/TopBar.jsx';
import TabBar from './components/TabBar.jsx';
import { ToastHost } from './components/Toast.jsx';
import Hearth from './screens/Hearth.jsx';
import Longhouse from './screens/Longhouse.jsx';
import Profile from './screens/Profile.jsx';
import Trials from './screens/Trials.jsx';
import Spin from './screens/Spin.jsx';
import { V, useMotionConfig } from './lib/motion.js';

function Placeholder({ title }) {
  const M = useMotionConfig();
  return (
    <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}>
      <div className="glass card" style={{ textAlign: 'center', padding: 32 }}>
        <h2 className="display" style={{ fontSize: 22 }}>{title}</h2>
        <p className="tiny" style={{ marginTop: 8 }}>Arrives in a later phase.</p>
      </div>
    </motion.div>
  );
}

function Shell() {
  const location = useLocation();
  const M = useMotionConfig();

  return (
    <div className="app-frame">
      <TopBar />
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
              <Route path="/"           element={<Hearth />} />
              <Route path="/longhouse"  element={<Longhouse />} />
              <Route path="/standings"  element={<Placeholder title="Standings" />} />
              <Route path="/settlement" element={<Placeholder title="Settlement" />} />
              <Route path="/post"       element={<Placeholder title="The Trading Post" />} />
              <Route path="/profile"    element={<Profile />} />
              <Route path="/trials"     element={<Trials />} />
              <Route path="/spin"       element={<Spin />} />
              <Route path="*"           element={<Placeholder title="Not found" />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>
      <TabBar />
      <ToastHost />
    </div>
  );
}

export default function App() {
  return (
    <>
      <World />
      <Shell />
    </>
  );
}