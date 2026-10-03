// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/screens/Tribe.jsx
// PURPOSE: The seven-seat circle, Pyre, roster, Kiva entry.
// DEPENDS ON: SeatCircle, api, store
// ═══════════════════════════════════════════════════════════════════
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { V } from '../lib/motion.js';
import { fmt } from '../lib/format.js';
import { Endpoints } from '../lib/api.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import SeatCircle from '../components/SeatCircle.jsx';
import { toast } from '../components/Toast.jsx';

export default function Tribe() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const tribe = data?.tribe;
  const seats = data?.seats || [];

  if (!tribe) {
    return (
      <motion.div variants={V.page} initial="initial" animate="animate" className="col" style={{ gap: 12 }}>
        <div className="glass card" style={{ textAlign: 'center', padding: 28 }}>
          <Icon name="tribe" size={48} style={{ color: 'var(--gold-300)' }} />
          <h2 className="display" style={{ fontSize: 22, marginTop: 12 }}>No tribe yet</h2>
          <p className="tiny" style={{ marginTop: 8, marginBottom: 16 }}>
            Join a tribe to unlock the Kiva, the Pyre, and the Warband.
          </p>
          <Button variant="primary" block onClick={() => nav('/')}>Back to Hearth</Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" className="col" style={{ gap: 12 }}>
      <div className="row between" style={{ margin: '2px 2px 0' }}>
        <div className="row" style={{ gap: 10 }}>
          <h2 className="display" style={{ fontSize: 22 }}>{tribe.name}</h2>
          <Hint slug="tribe" text="Your tribe has 7 seats. Rank determines them weekly. The Kiva is chat. The Pyre is the treasury." />
        </div>
      </div>

      <div className="glass card" style={{ padding: 20 }}>
        <SeatCircle seats={seats} />
      </div>

      <div className="row" style={{ gap: 10 }}>
        <div className="glass card grow" style={{ textAlign: 'center' }}>
          <span className="tiny">Level</span>
          <b style={{ fontSize: 22 }}>{tribe.level}</b>
        </div>
        <div className="glass card grow" style={{ textAlign: 'center' }}>
          <span className="tiny">Members</span>
          <b style={{ fontSize: 22 }}>{tribe.members}</b>
        </div>
        <div className="glass card grow" style={{ textAlign: 'center' }}>
          <span className="tiny">Kinship</span>
          <b style={{ fontSize: 22 }}>{fmt(tribe.kinship_total)}</b>
        </div>
      </div>

      <div className="glass card">
        <div className="row between">
          <b>Pyre</b>
          <span className="chip tabular">{fmt(tribe.treasury)}</span>
        </div>
        <Button
          variant="primary" block style={{ marginTop: 12 }}
          onClick={async () => {
            try {
              await Endpoints.tribeDonate(500);
              toast('+500 stoked', 'good');
              reload();
            } catch (e) { toast(e.message || 'Failed', 'bad'); }
          }}
        >Stoke +500</Button>
      </div>

      <Button variant="primary" block onClick={() => nav('/tribe/kiva')}>
        <Icon name="hearth" size={18} /> The Kiva
      </Button>
    </motion.div>
  );
}