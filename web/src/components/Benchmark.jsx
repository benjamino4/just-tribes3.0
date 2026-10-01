import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { runBenchmark } from '../lib/benchmark.js';
import { savePerf, setTier } from '../lib/perf.js';
import Icon from './Icon.jsx';

export default function Benchmark({ onDone }) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('starting');
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      const r = await runBenchmark((p, s) => { setProgress(p); setStage(s); });
      setResult(r);
      savePerf(r);
    })();
  }, []);

  if (!result) {
    return (
      <div className="benchmark-scene">
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 3, -3, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ marginBottom: 24 }}
        >
          <Icon name="hearth" size={72} style={{ color: 'var(--ember-400)' }} />
        </motion.div>
        <h1 className="display" style={{ fontSize: 24, marginBottom: 8 }}>Testing your device</h1>
        <p className="tiny" style={{ marginBottom: 24 }}>{stage}</p>
        <div className="bar" style={{ width: 220 }}>
          <i style={{ width: (progress * 100) + '%' }} />
        </div>
      </div>
    );
  }

  const tierLabel = {
    ultra120: 'ULTRA 120', ultra: 'ULTRA', high: 'HIGH',
    balanced: 'BALANCED', low: 'LOW', potato: 'POTATO'
  }[result.tier];

  const desc = {
    ultra120: 'Every effect. 120fps where available.',
    ultra: 'Every effect.',
    high: 'Most effects.',
    balanced: 'Smooth everywhere.',
    low: 'Lighter, saves battery.',
    potato: 'Maximum compatibility.'
  }[result.tier];

  return (
    <div className="benchmark-scene">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        style={{ marginBottom: 24 }}
      >
        <Icon name="crown" size={72} style={{ color: 'var(--gold-300)' }} />
      </motion.div>
      <h1 className="display" style={{ fontSize: 26, marginBottom: 4 }}>{tierLabel}</h1>
      <p className="tiny" style={{ marginBottom: 24 }}>{desc}</p>
      <div className="row" style={{ gap: 8, marginBottom: 24 }}>
        <button className="btn ghost" onClick={() => { setTier('balanced'); onDone(); }}>Change</button>
        <button className="btn primary" onClick={onDone}>Continue</button>
      </div>
      <details className="tiny" style={{ opacity: 0.5 }}>
        <summary>Details</summary>
        <pre>{JSON.stringify(result.tests, null, 2)}</pre>
      </details>
    </div>
  );
}