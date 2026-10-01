import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMotionConfig, V } from '../lib/motion.js';
import { apiGet } from '../lib/api.js';
import Icon from '../components/Icon.jsx';

export default function Help() {
  const nav = useNavigate();
  const M = useMotionConfig();
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    apiGet('/api/help').then((r) => setArticles((r.data || r) || [])).catch(() => {});
  }, []);

  const sections = {};
  for (const a of articles) {
    if (!sections[a.section]) sections[a.section] = [];
    sections[a.section].push(a);
  }

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" className="col" style={{ gap: 12 }}>
      <div className="row between" style={{ margin: '2px 2px 0' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => nav(-1)}>
            <Icon name="chevL" size={18} />
          </button>
          <h2 className="display" style={{ fontSize: 22 }}>Help</h2>
        </div>
      </div>

      {Object.entries(sections).map(([section, items]) => (
        <div key={section} className="glass card">
          <b style={{ fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--bone-200)' }}>{section}</b>
          <div className="col" style={{ gap: 6, marginTop: 10 }}>
            {items.map((a) => (
              <button
                key={a.slug}
                onClick={() => nav('/help/' + a.slug)}
                style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 12,
                  background: 'rgba(255,243,208,.04)',
                  border: '1px solid var(--glass-brd)',
                  color: 'var(--ink)'
                }}
              >
                <b style={{ fontSize: 14 }}>{a.title}</b>
              </button>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
}