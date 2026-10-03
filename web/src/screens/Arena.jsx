import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { Endpoints } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import { toast } from '../components/Toast.jsx';
import GameHost from '../components/GameHost.jsx';

export default function Arena() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const user = data?.user || {};
  const [match, setMatch] = useState(null);
  const [games, setGames] = useState([]);

  useEffect(() => {
    Endpoints.games().then((r) => setGames((r.data || r).games || [])).catch(() => {});
  }, []);

  async function findRanked() {
    try {
      haptic('medium');
      const r = await Endpoints.arenaRankedFind();
      const body = r.data || r;
      setMatch({
        duel_id: body.duel_id,
        game: body.game,
        opponent: body.opponent,
        opponent_type: body.opponent_type
      });
    } catch (e) { toast(e.message || 'Matchmaking failed', 'bad'); }
  }

  async function onGameDone(payload) {
    if (!match) return;
    try {
      const r = await Endpoints.arenaRankedResolve(match.duel_id, payload);
      const body = r.data || r;
      toast(body.won ? 'Victory!' : 'Defeat', body.won ? 'good' : 'bad');
      reload();
    } catch (e) { toast(e.message || 'Resolve failed', 'bad'); }
    finally { setMatch(null); }
  }

  if (match) {
    return <GameHost game={match.game} opponent={match.opponent} onDone={onGameDone} onExit={() => setMatch(null)} />;
  }

  return (
    <motion.div className="col" style={{ gap: 12 }}>
      <div className="row between">
        <h2 className="display" style={{ fontSize: 22 }}>Arena</h2>
        <span className="chip gold">
          {user.rank_tier?.emoji} {user.rank_tier?.title || 'Kin'}
        </span>
      </div>

      <div className="glass card">
        <b style={{ fontSize: 15 }}>Ranked duel</b>
        <p className="tiny" style={{ marginTop: 6 }}>
          Free matchmaking. The arena picks your game and rival — win to climb the ranks.
        </p>
        <button className="btn primary block" style={{ marginTop: 14 }} onClick={findRanked}>
          ⚔️ Find a fight
        </button>
      </div>

      <button className="btn ghost block" onClick={() => nav('/arena/war')}>
        ⚔️ Enter the War Room
      </button>

      {games.length > 0 && (
        <>
          <div className="sec-h"><h3>Games</h3><span className="line" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {games.map((g) => (
              <div key={g.slug} className="glass card" style={{ padding: 12 }}>
                <b style={{ fontSize: 13 }}>{g.name}</b>
                <p className="tiny" style={{ marginTop: 4 }}>{g.description}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}