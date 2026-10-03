import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiGet } from '../lib/api.js';

export default function Help() {
  const nav = useNavigate();
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
    <motion.div className="col" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 10 }}>
        <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => nav(-1)}>←</button>
        <h2 className="display" style={{ fontSize: 22 }}>Help</h2>
      </div>
      {Object.entries(sections).map(([section, items]) => (
        <div key={section} className="glass card">
          <b style={{ fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--slate-200)' }}>{section}</b>
          <div className="col" style={{ gap: 6, marginTop: 10 }}>
            {items.map((a) => (
              <div key={a.slug} style={{ padding: '10px 0', borderBottom: '1px solid var(--glass-brd)' }}>
                <b style={{ fontSize: 14 }}>{a.title}</b>
                <p className="tiny" style={{ marginTop: 4 }}>{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
}