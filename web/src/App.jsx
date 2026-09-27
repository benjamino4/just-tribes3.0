import { Routes, Route } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import World from './components/World.jsx';
import TopBar from './components/TopBar.jsx';
import TabBar from './components/TabBar.jsx';
import Hearth from './screens/Hearth.jsx';
import { V, useMotionConfig } from './lib/motion.js';

function Placeholder({ title }) {
  const M = useMotionConfig();
  return (
    <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}>
      <div className="glass card" style={{ textAlign: 'center', padding: 32 }}>
        <h2 className="display" style={{ fontSize: 22 }}>{title}</h2>
        <p className="tiny" style={{ marginTop: 8 }}>
          Arrives in a later phase.
        </p>
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
              <Route path="/longhouse"  element={<Placeholder title="The Longhouse" />} />
              <Route path="/standings"  element={<Placeholder title="Standings" />} />
              <Route path="/settlement" element={<Placeholder title="Settlement" />} />
              <Route path="/post"       element={<Placeholder title="The Trading Post" />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>
      <TabBar />
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
