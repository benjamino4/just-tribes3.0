import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, Button } from '../../components/UI.jsx';
import Icon from '../../components/Icon.jsx';
import { toast } from '../../components/Toast.jsx';
import { fmt } from '../../lib/format.js';
import { haptic } from '../../lib/telegram.js';

const SEED = [
  { id: 1, name: 'Kael', role: 'Chief',  online: true,  ember: 42000, banned: false, blessed: false },
  { id: 2, name: 'Mira', role: 'Head',   online: true,  ember: 31500, banned: false, blessed: true },
  { id: 3, name: 'Doon', role: 'Elder',  online: false, ember: 22100, banned: false, blessed: false },
  { id: 4, name: 'Vex',  role: 'Hunter', online: true,  ember: 19800, banned: false, blessed: false },
  { id: 5, name: 'Ora',  role: 'Kin',    online: false, ember: 9400,  banned: true,  blessed: false },
];

export default function UsersTab() {
  const [users, setUsers] = useState(SEED);
  const [q, setQ] = useState('');
  const list = users.filter((u) => u.name.toLowerCase().includes(q.toLowerCase()));
  const online = users.filter((u) => u.online).length;

  const mut = (id, patch, msg) => { setUsers((us) => us.map((u) => u.id === id ? { ...u, ...patch } : u)); haptic('success'); if (msg) toast(msg, 'good'); };

  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row between" style={{ padding: '0 2px' }}>
        <span className="tiny">{users.length} keepers · <b style={{ color: 'var(--good)' }}>{online} online</b></span>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search keepers…"
        style={{ width: '100%', padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.06)', border: '1px solid var(--glass-brd)', color: 'var(--ink)', fontSize: 14 }} />
      {list.map((u, i) => (
        <motion.div key={u.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
          <Card style={{ opacity: u.banned ? 0.6 : 1 }}>
            <div className="row between">
              <div className="row">
                <span className="crest-art" style={{ position: 'relative' }}><b style={{ fontSize: 14 }}>{u.name[0]}</b>
                  <span style={{ position: 'absolute', right: -1, bottom: -1, width: 10, height: 10, borderRadius: 99, border: '2px solid var(--bg-2)', background: u.online ? 'var(--good)' : 'var(--ink-faint)' }} /></span>
                <div className="col" style={{ gap: 1 }}>
                  <b className="row" style={{ gap: 5, fontSize: 14 }}>{u.name}{u.blessed && <Icon name="crown" size={13} style={{ color: 'var(--gold)' }} />}</b>
                  <span className="tiny">{u.role} · {fmt(u.ember)} Ember{u.banned ? ' · banned' : ''}</span>
                </div>
              </div>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <Button variant={u.banned ? 'primary' : 'ghost'} block onClick={() => mut(u.id, { banned: !u.banned }, u.banned ? `${u.name} unbanned` : `${u.name} banned`)}>
                <Icon name="ban" size={14} /> {u.banned ? 'Unban' : 'Ban'}
              </Button>
              <Button variant={u.blessed ? 'ghost' : 'primary'} block onClick={() => mut(u.id, { blessed: !u.blessed }, u.blessed ? `Blessing revoked` : `${u.name} blessed — payments bypassed`)}>
                <Icon name="crown" size={14} /> {u.blessed ? 'Unbless' : 'Bless'}
              </Button>
            </div>
          </Card>
        </motion.div>
      ))}
      <p className="tiny" style={{ color: 'var(--ink-faint)', padding: '4px 2px' }}>“Admin blessing” lets a user buy Star items without paying — useful for testers, mods, and giveaways.</p>
    </div>
  );
}
