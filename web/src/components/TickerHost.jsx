import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEvents } from '../lib/EventProvider.jsx';
import { useApp } from '../lib/store.jsx';

export default function TickerHost() {
  const { subscribe } = useEvents();
  const { data } = useApp();
  const [events, setEvents] = useState([]);

  useEffect(() => subscribe((evt) => {
    if (evt.tier !== 'ticker') return;
    setEvents((e) => [...e.slice(-19), evt]);
  }), [subscribe]);

  if (!data?.tribe || !events.length) return null;

  return (
    <div className="ticker-host">
      <div className="ticker-track">
        <AnimatePresence initial={false}>
          {events.map((evt) => (
            <motion.div
              key={evt.at + ':' + evt.kind}
              className="ticker-item"
              data-tone={evt.severity}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            >
              <span className="ticker-dot" />
              <span className="ticker-text">
                <b>{evt.title}</b>
                {evt.body ? <> · {evt.body}</> : null}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}