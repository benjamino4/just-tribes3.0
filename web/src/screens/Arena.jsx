// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/screens/Arena.jsx
// PURPOSE: The PvP hub. 12 game cards. Ranked and Staked modes.
// DEPENDS ON: GameDispatcher, RulesOverlay, api, store
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { fmt } from '../lib/format.js';
import { Endpoints } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import { GAME_META } from '../data/games.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import GameDispatcher from '../games/GameDispatcher.jsx';
import RulesOverlay from '../components/RulesOverlay.jsx';
import { toast } from '../components/Toast.jsx';

const SEEN_KEY = 'tribes.games.seen';
function hasSeen(slug) {
  try { return !!JSON.parse(localStorage.getItem(SEEN_KEY) || '{}')[slug]; } catch { return false; }
}
function markSeen(slug) {
  try {
    const s = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
    s[slug] = 1;
    localStorage.setItem(SEEN_KEY, JSON.stringify(s));
  } catch {}
}

export default function Arena() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const M = useMotionConfig();
  const user = data?.user || {};

  const [tab, setTab] = useState('ranked');
  const [match, setMatch] = useState(null);
  const [rules, setRules] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    Endpoints.arenaRecent().then((r) => setRecent((r.data || r).matches || [])).catch(() => {});
  }, [match]);

  async function findRanked(slug) {
    try {
      haptic('medium');
      const r = await Endpoints.arenaRankedFind(slug);
      const body = r.data || r;
      if (!hasSeen(body.game)) { setRules(body.game); markSeen(body.game); }
      setMatch({ mode: 'ranked', game: body.game, duel_id: body.duel_id, opponent: body.opponent });
    } catch (e) { toast(e.message || 'Matchmaking failed', 'bad'); }
  }

  async function onGameDone(score, payload) {
    if (!match) return;
    try {
      if (match.duel_id) {
        const r = await Endpoints.arenaRankedResolve(match.duel_id, payload || {});
        const body = r.data || r;
        toast(body.won ? 'Victory!' : 'Defeat', body.won ? 'good' : 'bad');
      } else {
        toast(`Score: ${score}`, 'info');
      }
      reload();
    } catch (e) { toast(e.message || 'Resolve failed', 'bad'); }
    finally { setMatch(null); }
  }

  if (match) {
    return (
      <>
        {rules && <RulesOverlay slug={rules} open onClose={() => setRules(null)} />}
        <GameDispatcher slug={match.game} onDone={onGameDone} onExit={() => setMatch(null)} mode="ranked" timeLimit={90000} />
      </>
    );
  }

  return (
    <motion.div className="col" style={{ gap: 4 }} variants={V.page} initial="initial" animate="animate">
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <h2 className="display" style={{ fontSize: 22 }}>Arena</h2>
          <Hint slug="arena" text="Fight other players 1v1 in mini-games. Ranked matches give Kinship. Staked matches bet Sparks." />
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        {['ranked', 'staked', 'war'].map((t) => (
          <button key={t}
            onClick={() => { haptic('select'); t === 'war' ? nav('/arena/war') : setTab(t); }}
            className="chip"
            style={{
              flex: 1, justifyContent: 'center',
              borderColor: tab === t ? 'var(--ember-300)' : 'var(--glass-brd)',
              color: tab === t ? 'var(--ember-200)' : 'var(--ink-dim)',
              background: tab === t ? 'rgba(255,199,138,.14)' : 'var(--glass-bg)'
            }}
          >{t === 'ranked' ? 'Ranked' : t === 'staked' ? 'Staked' : 'War'}</button>
        ))}
      </div>

      <p className="tiny" style={{ marginBottom: 8, marginLeft: 4 }}>
        {tab === 'ranked' ? 'Ranked duels are free. Win to climb the ladder.' :
         tab === 'staked' ? 'Stake Sparks. Winner takes the pot.' :
         'Tribe vs tribe. Enter the war room.'}
      </p>

      <div className="arena-game-grid">
        {Object.entries(GAME_META).map(([slug, meta], i) => (
          <motion.button
            key={slug}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...M.buoyant, delay: i * 0.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => tab === 'ranked' ? findRanked(slug) : findRanked(slug)}
            className="arena-game-card"
            style={{ '--accent': meta.accent }}
          >
            <span className="arena-game-dot" />
            <b>{meta.name}</b>
          </motion.button>
        ))}
      </div>

      {recent.length > 0 && (
        <>
          <div className="sec-h"><h3>Recent</h3><span className="line" /></div>
          {recent.slice(0, 5).map((m) => (
            <div key={m.id} className="glass card">
              <div className="row between">
                <b style={{ fontSize: 13 }}>{GAME_META[m.game_slug]?.name || m.game_slug}</b>
                <span className="chip tiny">
                  {Number(m.winner_id) === Number(user.id) ? 'Won' : 'Lost'}
                </span>
              </div>
            </div>
          ))}
        </>
      )}
    </motion.div>
  );
}