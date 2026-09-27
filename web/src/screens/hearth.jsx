import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V, staggerParent, SECTION_MOTION } from '../lib/motion.js';
import Campfire from '../components/Campfire.jsx';
import Icon from '../components/Icon.jsx';
import { fmt, shortTime } from '../lib/format.js';

function Glass({ children, hero, className = '', style, ...rest }) {
  return (
    <div className={`glass card ${hero ? 'hero' : ''} ${className}`} style={style} {...rest}>
      {children}
    </div>
  );
}

function Button({ children, variant = '', size = '', block, ...rest }) {
  return (
    <motion.button
      className={`btn ${variant} ${size} ${block ? 'block' : ''}`}
      whileTap={{ scale: 0.955 }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

function Bar({ value = 0, max = 100, good }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return <div className={`bar ${good ? 'good' : ''}`}><i style={{ width: pct + '%' }} /></div>;
}

export default function Hearth() {
  const { data } = useApp();
  const M = useMotionConfig();
  const user = data?.user || {};
  const tribe = data?.tribe;
  const daily = data?.daily || [];
  const bonfire = data?.bonfire;
  const war = data?.war;
  const streak = user.streak || 0;

  return (
    <motion.div
      className="col"
      style={{ gap: 4 }}
      initial={SECTION_MOTION.hearth.initial}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={M.ember}
    >
      {bonfire?.active && (
        <motion.div
          className="glass"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={M.buoyant}
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--r-md)',
            display: 'flex', alignItems: 'center', gap: 10,
            borderColor: 'rgba(255,180,100,.4)',
          }}
        >
          <Icon name="bolt" size={18} style={{ color: 'var(--gold)' }} />
          <div className="grow">
            <b style={{ fontSize: 14 }}>{bonfire.title}</b>
            <div className="tiny">x{bonfire.multiplier} · ends in {shortTime(bonfire.ends_in_ms)}</div>
          </div>
        </motion.div>
      )}

      <Glass hero style={{ paddingTop: 8, textAlign: 'center', overflow: 'hidden' }}>
        <Campfire streak={streak} lit />
        <h2 className="display" style={{ fontSize: 22, marginTop: 4 }}>
          The Hearth
        </h2>
        <p className="tiny" style={{ margin: '4px 0 14px' }}>
          Feed it daily · <b style={{ color: 'var(--ember-200)' }}>{streak} days</b>
        </p>
        <div style={{ margin: '0 8px 12px' }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <span className="tiny">Streak to next reward</span>
            <span className="tiny tabular">{streak % 7}/7</span>
          </div>
          <Bar value={streak % 7} max={7} />
        </div>
        <Button variant="primary" size="lg" block haptic="heavy">
          <Icon name="fire" size={20} />
          Feed the Fire · +120
        </Button>
      </Glass>

      <Glass>
        <div className="row between">
          <div className="row">
            <span className="crest-art" style={{ background: 'linear-gradient(180deg,#3a3630,#1c1a17)' }}>
              <Icon name="ash" size={18} style={{ color: 'var(--ash)' }} />
            </span>
            <div className="col" style={{ gap: 1 }}>
              <b>Gather the Ash</b>
              <span className="tiny">A pool is ready to collect</span>
            </div>
          </div>
          <Button variant="primary">Collect</Button>
        </div>
      </Glass>

      {war?.active && (
        <Glass>
          <div className="row between" style={{ marginBottom: 8 }}>
            <b className="row" style={{ gap: 6 }}>
              <Icon name="bolt" size={16} style={{ color: 'var(--ember-400)' }} /> Tribe War
            </b>
            <span className="tiny">ends in {shortTime(war.ends_in_ms)}</span>
          </div>
          <div className="row between tiny" style={{ marginBottom: 4 }}>
            <span>You · {fmt(war.attacker_score)}</span>
            <span>{war.opponent} · {fmt(war.defender_score)}</span>
          </div>
          <Bar
            value={war.attacker_score}
            max={war.attacker_score + war.defender_score}
            good={war.attacker_score >= war.defender_score}
          />
        </Glass>
      )}

      <div className="sec-h">
        <h3>Daily Tasks</h3>
        <span className="line" />
      </div>

      <motion.div variants={staggerParent(0.05)} initial="initial" animate="animate">
        {daily.map(t => (
          <motion.div key={t.id} variants={V.item}>
            <Glass>
              <div className="row between">
                <div className="row">
                  <span className="crest-art" style={{
                    background: t.done
                      ? 'linear-gradient(180deg,#2a6b45,#164028)'
                      : 'linear-gradient(180deg,#3a3630,#1c1a17)',
                  }}>
                    <Icon name={t.done ? 'check' : 'spark'} size={18}
                          style={{ color: t.done ? 'var(--good)' : 'var(--gold)' }} />
                  </span>
                  <div className="col" style={{ gap: 1 }}>
                    <b style={{ fontSize: 14 }}>{t.title}</b>
                    <span className="tiny">Reward +{fmt(t.reward)} Ember</span>
                  </div>
                </div>
                {t.done
                  ? <span className="chip" style={{ color: 'var(--good)' }}>Done</span>
                  : <Button variant="ghost">Claim</Button>}
              </div>
            </Glass>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
