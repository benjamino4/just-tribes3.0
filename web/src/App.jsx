// TRIBES-FILE: web/src/App.jsx
// PHASE: 8 — Payments + Polish
// Final route table.

import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import World from './components/World.jsx';
import TopBar from './components/TopBar.jsx';
import TabBar from './components/TabBar.jsx';
import { ToastHost } from './components/Toast.jsx';
import NotifIsland from './components/NotifIsland.jsx';
import Hearth from './screens/Hearth.jsx';
import Longhouse from './screens/Longhouse.jsx';
import Profile from './screens/Profile.jsx';
import Trials from './screens/Trials.jsx';
import Spin from './screens/Spin.jsx';
import Forge from './screens/Forge.jsx';
import Vault from './screens/Vault.jsx';
import Kiva from './screens/Kiva.jsx';
import Moot from './screens/Moot.jsx';
import Pyre from './screens/Pyre.jsx';
import War from './screens/War.jsx';
import Watchtower from './screens/Watchtower.jsx';
import Chronicle from './screens/Chronicle.jsx';
import Admin from './screens/Admin.jsx';
import Inbox from './screens/Inbox.jsx';
import TradingPost from './screens/TradingPost.jsx';
import Settlement from './screens/Settlement.jsx';
import Standings from './screens/Standings.jsx';
import { V, useMotionConfig } from './lib/motion.js';

function NotFound() {
  const M = useMotionConfig();
  return (
    <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}>
      <div className="glass card" style={{ textAlign: 'center', padding: 32 }}>
        <h2 className="display" style={{ fontSize: 22 }}>Not found</h2>
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
      <NotifIsland />
      <div className="scroller">
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}>
            <Routes location={location}>
              <Route path="/"            element={<Hearth />} />
              <Route path="/longhouse"   element={<Longhouse />} />
              <Route path="/standings"   element={<Standings />} />
              <Route path="/settlement"  element={<Settlement />} />
              <Route path="/post"        element={<TradingPost />} />
              <Route path="/profile"     element={<Profile />} />
              <Route path="/trials"      element={<Trials />} />
              <Route path="/spin"        element={<Spin />} />
              <Route path="/forge"       element={<Forge />} />
              <Route path="/vault"       element={<Vault />} />
              <Route path="/kiva"        element={<Kiva />} />
              <Route path="/moot"        element={<Moot />} />
              <Route path="/pyre"        element={<Pyre />} />
              <Route path="/war"         element={<War />} />
              <Route path="/watchtower"  element={<Watchtower />} />
              <Route path="/chronicle"   element={<Chronicle />} />
              <Route path="/admin"       element={<Admin />} />
              <Route path="/inbox"       element={<Inbox />} />
              <Route path="*"            element={<NotFound />} />
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