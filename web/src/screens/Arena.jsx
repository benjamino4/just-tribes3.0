import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { fmt, shortTime } from '../lib/format.js';
import { Endpoints } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import RulesOverlay from '../components/RulesOverlay.jsx';
import EmberReflex from '../games/EmberReflex.jsx';
import CascadeReflex from '../games/CascadeReflex.jsx';
import AncestorMemory from '../games/AncestorMemory.jsx';
import MissingRune from '../games/MissingRune.jsx';
import RiteOfHands from '../games/RiteOfHands.jsx';
import BidOrFold from '../games/BidOrFold.jsx';
import ChainOfFire from '../games/ChainOfFire.jsx';
import ThreeMasks from '../games/ThreeMasks.jsx';
import { toast } from '../components/Toast.jsx';

const GAME_COMPONENTS = {
  reflex: EmberReflex, cascade: CascadeReflex, ancestor: AncestorMemory,
  rune: MissingRune, hands: RiteOfHands, bid: BidOrFold, chain: ChainOfFire, masks: ThreeMasks
};

const SEEN_KEY = 'tribes.games.seen';

function hasSeenGame(slug) {
  try {
    const s = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
    return !!s[slug];
  } catch { return false; }
}
function markGameSeen(slug) {
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
  const tribe = data?.tribe;

  const [tab, setTab] = useState('ranked');
  const [match, setMatch] = useState(null);
  const [rules, setRules] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    Endpoints.arenaRecent().then((r) => setRecent((r.data || r).matches || [])).catch(() => {});
  }, [match]);

  async function findRanked() {
    try {
      haptic('medium');
      const r = await Endpoints.arenaRankedFind(null);
      const body = r.data || r;
      if (!body.opponent) {
        // Fall back to bot practice against self
        setMatch({ mode: 'ranked', game: body.game || 'reflex', duel_id: null, bot: true });
      } else {
        if (!hasSeenGame(body.game)) setRules(body.game);
        setMatch({ mode: 'ranked', game: body.game, duel_id: body.duel_id, opponent: body.opponent });
      }
    } catch (e) { toast(e.message || 'Matchmaking failed', 'bad'); }
  }

  async function findStaked(stake) {
    try {
      haptic('medium');
      const r = await Endpoints.arenaStakedOpen(stake, null);
      const body = r.data || r;
      if (!hasSeenGame(body.game)) setRules(body.game);
      setMatch({ mode: 'staked', game: body.game, duel_id: body.duel_id, stake: body.stake });
    } catch (e) { toast(e.message || 'Could not stake', 'bad'); }
  }

  async function onGameDone(score, payload) {
    if (!match) return;
    try {
      if (match.mode === 'ranked' && match.duel_id) {
        const r = await Endpoints.arenaRankedResolve(match.duel_id, payload || {});
        const body = r.data || r;
        toast(body.won ? 'Victory!' : 'Defeat', body.won ? 'good' : 'bad');
      } else if (match.mode === 'staked' && match.duel_id) {
        const r = await Endpoints.arenaStakedResolve(match.duel_id, payload || {});
        const body = r.data || r;
        toast(body.won ? `Victory! +${body.payout}` : 'Defeat', body.won ? 'good' : 'bad');
      } else {
        toast(`Score: ${score}`, 'info');
      }
      reload();
    } catch (e) { toast(e.message || 'Resolve failed', 'bad'); }
    finally { setMatch(null); }
  }

  if (match) {
    const Game = GAME_COMPONENTS[match.game] || EmberReflex;
    return (
      <>
        {rules && <RulesOverlay slug={rules} open onClose={() => setRules(null)} />}
        <Game onDone={onGameDone} onExit={() => setMatch(null)} />
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
        <span className="chip gold"><Icon name="crown" size={12} /> {user.rank_rating || 1000}</span>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        {['ranked', 'staked', 'war'].map((t) => (
          <button key={t}
            onClick={() => { haptic('select'); t === 'war' ? nav('/arena/war') : setTab(t); }}
            className="chip"
            style={{
              flex: 1, justifyContent: 'center',
              borderColor: tab === t ? 'var(--ember-400)' : 'var(--glass-brd)',
              color: tab === t ? 'var(--ember-200)' : 'var(--ink-dim)',
              background: tab === t ? 'rgba(255,122,24,.14)' : 'var(--glass-bg)'
            }}
          >{t === 'ranked' ? 'Ranked' : t === 'staked' ? 'Staked' : 'War'}</button>
        ))}
      </div>

      {tab === 'ranked' && (
        <div className="glass card">
          <b style={{ fontSize: 15 }}>Ranked duel</b>
          <p className="tiny" style={{ marginTop: 6 }}>
            Free matchmaking against a player near your rank. Win to climb.
          </p>
          <Button variant="primary" block style={{ marginTop: 14 }} onClick={findRanked}>
            <Icon name="swords" size={16} /> Find a fight
          </Button>
        </div>
      )}

      {tab === 'staked' && (
        <div className="glass card">
          <b style={{ fontSize: 15 }}>Staked duel</b>
          <p className="tiny" style={{ marginTop: 6 }}>
            Both players stake Sparks. Winner takes 95%. You have {fmt(user.sparks || 0)} Sparks.
          </p>
          <div className="row" style={{ gap: 8, marginTop: 14 }}>
            {[50, 200, 1000].map((s) => (
              <Button key={s} variant="primary" block onClick={() => findStaked(s)}>{s}</Button>
            ))}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <>
          <div className="sec-h"><h3>Recent</h3><span className="line" /></div>
          {recent.slice(0, 5).map((m) => (
            <div key={m.id} className="glass card">
              <div className="row between">
                <b style={{ fontSize: 13 }}>{m.game_slug}</b>
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