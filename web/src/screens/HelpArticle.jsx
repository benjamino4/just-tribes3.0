// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/screens/HelpArticle.jsx
// PURPOSE: One help article.
// DEPENDS ON: api
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { V } from '../lib/motion.js';
import { apiGet } from '../lib/api.js';
import Icon from '../components/Icon.jsx';

export default function HelpArticle() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [article, setArticle] = useState(null);

  useEffect(() => {
    apiGet('/api/help/' + slug).then((r) => setArticle(r.data || r)).catch(() => {});
  }, [slug]);

  if (!article) return <p className="muted" style={{ padding: 24, textAlign: 'center' }}>Loading…</p>;

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" className="col" style={{ gap: 12 }}>
      <div className="row between" style={{ margin: '2px 2px 0' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => nav(-1)}>
            <Icon name="chevL" size={18} />
          </button>
          <span className="tiny" style={{ color: 'var(--bone-200)', textTransform: 'uppercase' }}>{article.section}</span>
        </div>
      </div>
      <div className="glass card">
        <h2 className="display" style={{ fontSize: 24, marginBottom: 12 }}>{article.title}</h2>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--bone-100)' }}>{article.body}</p>
      </div>
    </motion.div>
  );
}