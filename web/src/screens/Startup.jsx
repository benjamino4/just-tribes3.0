import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateVerse } from '../lib/verse.js';
import { useApp } from '../lib/store.jsx';

export default function Startup({ onDone }) {
  const { data } = useApp();
  const [phase, setPhase] = useState('ember');
  const [verse] = useState(() => generateVerse(data));

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('title'), 800);
    const t2 = setTimeout(() => setPhase('verse'), 1600);
    const t3 = setTimeout(() => onDone(), 3200);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [onDone]);

  return (
    <div className="startup-scene">
      <div className="startup-void" />
      <motion.div
        className="startup-ember"
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: phase === 'ember' ? 1 : [1, 3, 8],
          opacity: phase === 'ember' ? 1 : [1, 0.8, 0]
        }}
        transition={{ duration: phase === 'ember' ? 0.8 : 2.4, ease: [0.16, 1, 0.3, 1] }}
      />
      <AnimatePresence>
        {(phase === 'title' || phase === 'verse') && (
          <motion.h1
            key="title"
            initial={{ opacity: 0, letterSpacing: '0.4em' }}
            animate={{ opacity: 1, letterSpacing: '0.06em' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="display startup-title"
          >TRIBES</motion.h1>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {phase === 'verse' && (
          <motion.p
            key="verse"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="startup-verse"
          >{verse}</motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}