// TRIBES-FILE: web/src/screens/Store.jsx
// PHASE: 4 — Rise of the Eternal Flame (The Forge Market)
//
// Monetization hub. Chiefs spend Stars to unlock one-time branding perks
// (custom name, circular icon, premium banner) then edit that branding for
// free. Also links out to emoji unlocks and paid message pinning.
//
// The header is painted by a hand-written <canvas> ember field (EmberForge)
// — rising sparks + a molten glow — so the screen has its own distinctive
// look rather than reusing a shared banner.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { Endpoints } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import IconCropper from '../components/IconCropper.jsx';
import { toast } from '../components/Toast.jsx';

/* ---------- animated ember backdrop (canvas) ---------- */
function EmberForge() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const reduced = document.documentElement.getAttribute('data-fx') === 'reduced';
    const ctx = c.getContext('2d');
    let raf = 0, w = 0, h = 0, sparks = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function size() {
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn() {
      return {
        x: Math.random() * w,
        y: h + Math.random() * 20,
        r: 0.6 + Math.random() * 1.8,
        vy: 0.25 + Math.random() * 0.9,
        vx: (Math.random() - 0.5) * 0.35,
        life: 0, max: 120 + Math.random() * 120,
        hue: 20 + Math.random() * 22,
      };
    }
    size();
    const N = reduced ? 22 : 60;
    for (let i = 0; i < N; i++) { const s = spawn(); s.y = Math.random() * h; sparks.push(s); }

    function frame() {
      ctx.clearRect(0, 0, w, h);
      // molten floor glow
      const g = ctx.createRadialGradient(w / 2, h + 10, 10, w / 2, h + 10, h * 0.9);
      g.addColorStop(0, 'rgba(255,120,30,0.35)');
      g.addColorStop(0.5, 'rgba(180,50,10,0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      for (const s of sparks) {
        s.life++; s.y -= s.vy; s.x += s.vx;
        const t = 1 - s.life / s.max;
        if (s.life >= s.max || s.y < -6) { Object.assign(s, spawn()); continue; }
        ctx.beginPath();
        ctx.fillStyle = `hsla(${s.hue}, 100%, ${55 + t * 15}%, ${Math.max(0, t) * 0.9})`;
        ctx.shadowColor = 'rgba(255,140,40,0.9)'; ctx.shadowBlur = 8;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(frame);
    }
    if (reduced) { frame(); cancelAnimationFrame(raf); }
    else raf = requestAnimationFrame(frame);
    const onR = () => size();
    window.addEventListener('resize', onR);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onR); };
  }, []);
  return <canvas ref={ref} className="store-ember" aria-hidden="true" />;
}

const PERK_META = {
  name:   { icon: 'scroll', title: 'Custom Tribe Name', blurb: 'Rename the tribe and dress it in forged fonts & glowing styles.' },
  icon:   { icon: 'shield', title: 'Custom Tribe Icon', blurb: 'Upload a crest and crop it to a perfect circle.' },
  banner: { icon: 'flag',   title: 'Premium Banner',    blurb: 'Unlock premium banner styling for the Longhouse.' },
};

export default function Store() {
  const nav = useNavigate();
  const M = useMotionConfig();
  const { reload } = useApp();

  const [s, setS] = useState(null);
  const [busy, setBusy] = useState('');
  const [cropOpen, setCropOpen] = useState(false);

  // name editor draft
  const [name, setName] = useState('');
  const [font, setFont] = useState('default');
  const [style, setStyle] = useState('plain');

  const refresh = useCallback(async () => {
    try {
      const r = await Endpoints.store();
      setS(r);
      if (r.tribe) {
        setName(r.tribe.name || '');
        setFont(r.tribe.name_font || 'default');
        setStyle(r.tribe.name_style || 'plain');
      }
    } catch (e) { toast(e.message || 'Could not open the Market', 'bad'); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const tribe = s?.tribe;
  const perks = tribe?.perks || {};
  const styleColor = (id) => (s?.styles || []).find((x) => x.id === id)?.color;
  const fontCss = (id) => (s?.fonts || []).find((x) => x.id === id)?.css || 'var(--font-display)';

  async function buy(perk) {
    if (!s?.is_chief) return toast('Only the Chief may buy perks', 'info');
    const price = s.prices['perk_' + perk];
    setBusy('perk_' + perk);
    haptic('medium');
    try {
      const r = await Endpoints.storeBuyPerk(perk);
      if (r.already) toast('Already unlocked', 'info');
      else toast(`${PERK_META[perk].title} unlocked \u2014 \u2212${r.spent} Stars`, 'good');
      await refresh(); await reload();
    } catch (e) {
      toast(e.need ? `Need ${e.need} Stars` : (e.message || 'Purchase failed'), 'bad');
    } finally { setBusy(''); }
  }

  async function saveName() {
    const clean = name.trim();
    if (clean.length < 3) return toast('Name too short', 'bad');
    setBusy('name'); haptic('light');
    try {
      await Endpoints.storeSetName(clean, font, style);
      toast('Tribe renamed', 'good');
      await refresh(); await reload();
    } catch (e) { toast(e.message || 'Could not save name', 'bad'); }
    finally { setBusy(''); }
  }

  async function saveIcon(dataUrl) {
    setBusy('icon');
    try {
      await Endpoints.storeSetIcon(dataUrl);
      toast('Crest raised', 'good');
      setCropOpen(false);
      await refresh(); await reload();
    } catch (e) { toast(e.message || 'Could not save icon', 'bad'); }
    finally { setBusy(''); }
  }

  async function clearIcon() {
    setBusy('icon');
    try { await Endpoints.storeSetIcon(''); toast('Crest removed', 'info'); await refresh(); await reload(); }
    catch (e) { toast(e.message || 'Failed', 'bad'); }
    finally { setBusy(''); }
  }

  async function saveBanner(id) {
    setBusy('banner');
    try { await Endpoints.storeSetBanner(id); toast('Banner restyled', 'good'); await refresh(); await reload(); }
    catch (e) { toast(e.message || 'Failed', 'bad'); }
    finally { setBusy(''); }
  }

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}
      className="store-screen">

      <header className="store-hero glass">
        <EmberForge />
        <div className="store-hero-in">
          <div>
            <h1 className="display store-title">The Forge Market</h1>
            <p className="store-sub">Spend Stars to brand your tribe in living fire.</p>
          </div>
          <div className="store-bal" title="Your Stars">
            <Icon name="star" /> <b>{s?.stars ?? '\u2014'}</b>
          </div>
        </div>
      </header>

      {s && !s.in_tribe && (
        <div className="glass card store-empty">
          <p>Join a tribe first to brand it.</p>
          <Button onClick={() => nav('/longhouse')}>Find a tribe</Button>
        </div>
      )}

      {s && s.in_tribe && (
        <>
          {/* ---------- perks ---------- */}
          <section className="store-sec">
            <h2 className="store-h2">Branding Perks <span>one-time unlock</span></h2>
            <div className="perk-grid">
              {['name', 'icon', 'banner'].map((p) => {
                const owned = !!perks[p];
                const meta = PERK_META[p];
                return (
                  <div key={p} className={'perk-card glass' + (owned ? ' owned' : '')}>
                    <div className="perk-ico"><Icon name={meta.icon} /></div>
                    <div className="perk-body">
                      <h3>{meta.title}</h3>
                      <p>{meta.blurb}</p>
                    </div>
                    <div className="perk-cta">
                      {owned ? (
                        <span className="perk-owned"><Icon name="check" /> Owned</span>
                      ) : (
                        <Button disabled={!s.is_chief || busy === 'perk_' + p}
                          onClick={() => buy(p)}>
                          <Icon name="star" /> {s.prices['perk_' + p]}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {!s.is_chief && <p className="store-note">Only your Chief can buy and apply these.</p>}
          </section>

          {/* ---------- name editor ---------- */}
          <section className={'store-sec' + (perks.name ? '' : ' locked')}>
            <h2 className="store-h2">Tribe Name {!perks.name && <span>locked</span>}</h2>
            <div className="glass card name-editor">
              <div className="name-preview" style={{ fontFamily: fontCss(font), color: styleColor(style) || 'var(--ink)' }}>
                {name.trim() || 'Your Tribe'}
              </div>
              <input className="name-input" value={name} maxLength={s.name_max_len}
                disabled={!perks.name || !s.is_chief}
                onChange={(e) => setName(e.target.value)} placeholder="New tribe name" />
              <div className="picker-row">
                <label>Font</label>
                <div className="chips">
                  {(s.fonts || []).map((f) => (
                    <button key={f.id} type="button"
                      className={'chip' + (font === f.id ? ' on' : '')}
                      disabled={!perks.name || !s.is_chief}
                      style={{ fontFamily: f.css }}
                      onClick={() => setFont(f.id)}>{f.name}</button>
                  ))}
                </div>
              </div>
              <div className="picker-row">
                <label>Style</label>
                <div className="chips">
                  {(s.styles || []).map((st) => (
                    <button key={st.id} type="button"
                      className={'chip' + (style === st.id ? ' on' : '')}
                      disabled={!perks.name || !s.is_chief}
                      style={st.color ? { color: st.color, borderColor: st.color } : undefined}
                      onClick={() => setStyle(st.id)}>{st.name}</button>
                  ))}
                </div>
              </div>
              <Button disabled={!perks.name || !s.is_chief || busy === 'name'} onClick={saveName}>
                {busy === 'name' ? 'Saving\u2026' : 'Save name'}
              </Button>
            </div>
          </section>

          {/* ---------- icon cropper ---------- */}
          <section className={'store-sec' + (perks.icon ? '' : ' locked')}>
            <h2 className="store-h2">Tribe Crest {!perks.icon && <span>locked</span>}</h2>
            <div className="glass card crest-editor">
              <div className="crest-current">
                <div className="crest-ring">
                  {tribe?.icon_url
                    ? <img src={tribe.icon_url} alt="tribe crest" />
                    : <Icon name="tribe" />}
                </div>
                <span>Current crest</span>
              </div>
              {perks.icon && s.is_chief ? (
                cropOpen ? (
                  <IconCropper initial={tribe?.icon_url} busy={busy === 'icon'}
                    onCropped={saveIcon} onCancel={() => setCropOpen(false)} />
                ) : (
                  <div className="crest-actions">
                    <Button onClick={() => setCropOpen(true)}>Upload / crop crest</Button>
                    {tribe?.icon_url && (
                      <button className="link-btn" disabled={busy === 'icon'} onClick={clearIcon}>Remove crest</button>
                    )}
                  </div>
                )
              ) : (
                <p className="store-note">Unlock the crest perk to upload a circular icon.</p>
              )}
            </div>
          </section>

          {/* ---------- banner styling ---------- */}
          <section className={'store-sec' + (perks.banner ? '' : ' locked')}>
            <h2 className="store-h2">Banner Style {!perks.banner && <span>locked</span>}</h2>
            <div className="glass card">
              <div className="chips">
                {[{ id: 'plain', name: 'Plain' }, ...(s.styles || []).filter((x) => x.id !== 'plain')].map((st) => (
                  <button key={st.id} type="button"
                    className={'chip' + (tribe?.banner_style === st.id ? ' on' : '')}
                    disabled={!perks.banner || !s.is_chief || busy === 'banner'}
                    style={st.color ? { color: st.color, borderColor: st.color } : undefined}
                    onClick={() => saveBanner(st.id)}>{st.name}</button>
                ))}
              </div>
            </div>
          </section>

          {/* ---------- links to other paid features ---------- */}
          <section className="store-sec">
            <h2 className="store-h2">More from the Forge</h2>
            <div className="link-grid">
              <button className="glass link-card" onClick={() => nav('/forge')}>
                <Icon name="gem" /><span>Unlock Emojis</span>
              </button>
              <button className="glass link-card" onClick={() => nav('/kiva')}>
                <Icon name="flag" /><span>Pin a Message\u00a0\u00b7\u00a0{s.prices.pin_message}\u2605</span>
              </button>
              <button className="glass link-card" onClick={() => nav('/post')}>
                <Icon name="star" /><span>Buy Stars</span>
              </button>
            </div>
          </section>
        </>
      )}
    </motion.div>
  );
}
