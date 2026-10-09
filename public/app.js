import { randomQuote } from './quotes.js';

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
tg?.setHeaderColor('#08080A');
tg?.setBackgroundColor('#08080A');
// Stop Telegram's own vertical swipe-to-close from fighting the card gestures.
try { tg?.disableVerticalSwipes?.(); } catch {}

// ─── State ──────────────────────────────────────────────────
const state = {
  user: null,
  challenge: null,
  quests: [],
  board: [],
  myPick: null,
  tab: 'home',
  // Antechamber (invite-gate) state
  phase: 'open',      // 'gate' | 'standby' | 'open'
  ante: null,         // { phase, enabled, threshold, claimed, remaining, referralBase }
  oathbound: 0,       // how many souls I've brought in
  mainBooted: false,  // guard so we only wire the tab app once
};

// ─── API ────────────────────────────────────────────────────
async function api(path, options = {}) {
  const initData = tg?.initData || '';
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Init-Data': initData,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.error || 'request_failed'), err);
  }
  return res.json();
}

function haptic(type = 'light') {
  try {
    if (type === 'success') tg?.HapticFeedback.notificationOccurred('success');
    else if (type === 'error') tg?.HapticFeedback.notificationOccurred('error');
    else tg?.HapticFeedback.impactOccurred(type);
  } catch {}
}

// ─── Splash ─────────────────────────────────────────────────
function runSplash() {
  const splash = document.getElementById('splash');
  const quoteEl = document.getElementById('splash-quote');
  const authorEl = document.getElementById('splash-author');

  const quote = randomQuote();

  let html = '';
  let idx = 0;
  for (const word of quote.text.split(' ')) {
    html += `<span class="w" style="animation-delay:${600 + idx * 90}ms">${escapeHtml(word)}</span> `;
    idx++;
  }
  quoteEl.innerHTML = html.trim();
  authorEl.textContent = `— ${quote.author}`;

  const readMs = Math.max(2800, quote.text.length * 45);
  setTimeout(() => {
    splash.classList.add('exit');
    setTimeout(() => {
      splash.classList.add('hidden');
      boot();
    }, 720);
  }, readMs);
}

// ─── Tab bar ────────────────────────────────────────────────
function setupTabBar() {
  const tabbar = document.getElementById('tabbar');
  const viewport = document.getElementById('tab-viewport');
  const panes = {
    home: viewport.querySelector('[data-pane="home"]'),
    board: viewport.querySelector('[data-pane="board"]'),
  };

  function setPaneHeight() {
    const active = viewport.querySelector('.tab-pane.active');
    if (active) viewport.style.height = active.offsetHeight + 'px';
  }

  function switchTab(next, dir = null) {
    if (state.tab === next) return;
    const prev = state.tab;
    state.tab = next;
    tabbar.dataset.active = next;

    document.querySelectorAll('.tab-item').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === next);
    });

    const from = panes[prev];
    const to = panes[next];
    const goRight = dir ? dir === 'right' : (next === 'board');

    to.classList.remove('from-left', 'from-right', 'leaving-left', 'leaving-right');
    to.classList.add(goRight ? 'from-right' : 'from-left');
    void to.offsetWidth;
    to.classList.remove('from-right', 'from-left');
    to.classList.add('active');

    from.classList.remove('active');
    from.classList.add(goRight ? 'leaving-left' : 'leaving-right');

    setTimeout(() => {
      from.classList.remove('leaving-left', 'leaving-right');
      setPaneHeight();
    }, 420);
  }

  document.querySelectorAll('.tab-item').forEach(btn => {
    btn.addEventListener('click', () => {
      haptic('light');
      switchTab(btn.dataset.tab);
    });
  });

  let sx = 0, sy = 0, tracking = false;
  viewport.addEventListener('touchstart', (e) => {
    // Don't let a horizontal card swipe also flip the tab pages.
    if (e.target.closest('.deck')) { tracking = false; return; }
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  viewport.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0 && state.tab === 'home') switchTab('board', 'right');
    if (dx > 0 && state.tab === 'board') switchTab('home', 'left');
  }, { passive: true });

  // Activate the starting pane. The HTML ships with NO pane marked active,
  // and inactive panes are opacity:0 — that's why Home looked blank until a
  // tab switch. Make the current tab visible up front.
  panes[state.tab].classList.add('active');
  tabbar.dataset.active = state.tab;

  // Keep the viewport height in sync with whatever the active pane renders,
  // including content that arrives async (challenge, board) or after fonts load.
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => setPaneHeight());
    ro.observe(panes.home);
    ro.observe(panes.board);
  }

  requestAnimationFrame(setPaneHeight);
  window.addEventListener('resize', setPaneHeight);

  return { setPaneHeight };
}

// ─── Render: user header ────────────────────────────────────
function renderUser() {
  const name = state.user?.first_name || state.user?.username || 'Guest';
  document.getElementById('user-name').textContent = name;
  document.getElementById('points').textContent = state.user?.points ?? 0;
  document.getElementById('streak').textContent = state.user?.streak ?? 0;

  // Primordial chip beside the name for the founding few.
  const nameEl = document.getElementById('user-name');
  const host = nameEl?.parentElement;
  if (host) {
    const existing = host.querySelector('.prim-chip');
    if (state.user?.is_primordial) {
      const no = state.user.primordial_no ? String(state.user.primordial_no).padStart(3, '0') : '';
      if (existing) {
        existing.textContent = `Primordial Nº${no}`;
      } else {
        const chip = document.createElement('span');
        chip.className = 'prim-chip';
        chip.textContent = `Primordial Nº${no}`;
        nameEl.insertAdjacentElement('afterend', chip);
      }
    } else if (existing) {
      existing.remove();
    }
  }
}

// ─── Render: challenge ──────────────────────────────────────
function renderChallenge() {
  const mount = document.getElementById('challenge-mount');
  const ch = state.challenge;

  if (!ch) {
    mount.innerHTML = `<div class="empty">No challenge today<br/>come back tomorrow</div>`;
    return;
  }

  const revealTime = new Date(ch.reveal_at);
  const now = new Date();
  const revealed = ch.status === 'revealed' && ch.winner_id;
  const closed = ch.status === 'closed' || (now >= revealTime && !ch.winner_id);

  if (revealed) return renderRevealed(mount, ch);

  if (closed) {
    mount.innerHTML = `
      <div class="day-badge">Day ${dayIndex()}</div>
      <h2 class="q">${escapeHtml(ch.question)}</h2>
      <div class="sealed">
        <div class="sealed-ring"></div>
        <div class="sealed-icon">◈</div>
        <div class="sealed-title">Sealed</div>
        <div class="sealed-text">Entries closed. Results drop shortly.</div>
      </div>
    `;
    return;
  }

  if (state.myPick) {
    mount.innerHTML = `
      <div class="day-badge">Day ${dayIndex()}</div>
      <h2 class="q">${escapeHtml(ch.question)}</h2>
      <div class="sealed">
        <div class="sealed-ring"></div>
        <div class="sealed-icon">◈</div>
        <div class="sealed-title">Called it</div>
        <div class="sealed-text">You locked in <strong>${escapeHtml(state.myPick.choice.toUpperCase())}</strong>. The AIs will rank every path at reveal time — the sharpest one pays the most.</div>
        <div class="sealed-time">Reveal · ${formatTime(revealTime)}</div>
      </div>
    `;
    return;
  }

  const options = ch.options || [];
  mount.innerHTML = `
    <div class="day-badge">Day ${dayIndex()}</div>
    <h2 class="q">${escapeHtml(ch.question)}</h2>
    <div class="deck" id="deck"></div>
    <div class="deck-pager" id="deck-pager">
      ${options.map((_, i) => `<div class="deck-dot ${i === 0 ? 'active' : ''}"></div>`).join('')}
    </div>
    <div class="empty" style="padding:0;font-size:10px;">
      Swipe to browse · tap a card to lock it in
    </div>
  `;

  buildDeck(options);
}

function buildDeck(options) {
  const deck = document.getElementById('deck');
  const pager = document.getElementById('deck-pager');
  const COLORS = ['gold', 'mint', 'coral', 'lav', 'paper'];

  let activeIdx = 0;
  const cards = options.map((opt, i) => {
    const card = document.createElement('div');
    card.className = 'deck-card';
    card.dataset.id = opt.id;
    card.dataset.color = COLORS[i % COLORS.length];
    card.style.zIndex = String(100 - i);
    card.innerHTML = `
      <div class="card-letter">${escapeHtml(opt.id.toUpperCase())}</div>
      <div class="card-text">${escapeHtml(opt.text)}</div>
      <div class="card-hint">
        <span>${i + 1} / ${options.length}</span>
        <span class="lock">Lock In</span>
      </div>
    `;
    return card;
  });

  function layout() {
    cards.forEach((card, i) => {
      const offset = i - activeIdx;
      if (offset < 0) {
        card.style.transform = `translateX(-120%) rotate(-20deg)`;
        card.style.opacity = '0';
        card.style.pointerEvents = 'none';
      } else if (offset === 0) {
        card.style.transform = `translateY(0) rotate(0deg) scale(1)`;
        card.style.opacity = '1';
        card.style.pointerEvents = 'auto';
      } else if (offset === 1) {
        card.style.transform = `translateY(10px) scale(0.96) rotate(2deg)`;
        card.style.opacity = '0.7';
        card.style.pointerEvents = 'none';
      } else if (offset === 2) {
        card.style.transform = `translateY(18px) scale(0.92) rotate(-2deg)`;
        card.style.opacity = '0.4';
        card.style.pointerEvents = 'none';
      } else {
        card.style.transform = `translateY(24px) scale(0.88)`;
        card.style.opacity = '0';
        card.style.pointerEvents = 'none';
      }
    });
    pager.querySelectorAll('.deck-dot').forEach((d, i) => {
      d.classList.toggle('active', i === activeIdx);
    });
  }

  cards.forEach((card, i) => {
    deck.appendChild(card);
    if (i === 0) layout();

    const opt = options[i];      // <-- was out of scope before; taps threw ReferenceError
    let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false, moved = false;
    const TAP_SLOP = 8;    // movement under this = a tap, not a drag
    const SWIPE = 80;      // movement over this = advance to next card

    card.addEventListener('pointerdown', (e) => {
      if (i !== activeIdx) return;
      if (e.target.closest('.lock')) return;
      dragging = true;
      moved = false;
      dx = 0; dy = 0;
      sx = e.clientX;
      sy = e.clientY;
      card.classList.add('dragging');
      try { card.setPointerCapture?.(e.pointerId); } catch {}
    });

    card.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      dx = e.clientX - sx;
      dy = e.clientY - sy;
      if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) moved = true;
      card.style.transform = `translate(${dx}px, ${dy * 0.4}px) rotate(${dx * 0.06}deg)`;
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      card.classList.remove('dragging');
      // Horizontal fling = browse to the next card.
      if (moved && Math.abs(dx) > SWIPE) {
        const dir = dx > 0 ? 1 : -1;
        card.style.transform = `translate(${dir * 520}px, ${dy}px) rotate(${dir * 28}deg)`;
        card.style.opacity = '0';
        haptic('light');
        setTimeout(() => {
          activeIdx = (activeIdx + 1) % cards.length;
          dx = 0; dy = 0;
          layout();
        }, 240);
      } else {
        // Snap back. (A clean tap is handled by the click listener below.)
        dx = 0; dy = 0;
        layout();
      }
    }

    card.addEventListener('pointerup', endDrag);
    card.addEventListener('pointercancel', () => {
      dragging = false;
      dx = 0; dy = 0;
      card.classList.remove('dragging');
      layout();
    });

    // Tap-to-lock. `click` is the dependable "tap" signal in Telegram's WebView:
    // with touch-action:pan-y a tap can arrive as pointercancel (never pointerup),
    // but a genuine tap still fires click.
    card.addEventListener('click', (e) => {
      if (e.target.closest('.lock')) return;   // its own button handles it
      if (i !== activeIdx) return;
      if (moved) { moved = false; return; }    // that was a drag, not a tap
      haptic('medium');
      commitPick(opt.id);
    });

    card.querySelector('.lock').addEventListener('click', (e) => {
      e.stopPropagation();
      haptic('medium');
      commitPick(opt.id);
    });
  });

  layout();
}

async function commitPick(choiceId) {
  if (state.myPick) return;
  haptic('medium');

  try {
    await api('/api/pick', {
      method: 'POST',
      body: JSON.stringify({
        challengeId: state.challenge.id,
        choice: choiceId,
      }),
    });
    state.myPick = { choice: choiceId };
    showRevealOverlay(choiceId);
    setTimeout(() => renderChallenge(), 400);
  } catch (err) {
    if (err.error === 'already_picked') {
      state.myPick = { choice: choiceId };
      renderChallenge();
      return;
    }
    haptic('error');
    alert('Could not submit. Try again.');
  }
}

function showRevealOverlay(choiceId) {
  const overlay = document.getElementById('reveal-overlay');
  const timeEl = document.getElementById('reveal-time');
  const subEl = document.getElementById('reveal-sub');

  const revealTime = new Date(state.challenge.reveal_at);
  timeEl.textContent = `Reveal at ${formatTime(revealTime)}`;
  subEl.textContent = 'You locked in ' + choiceId.toUpperCase() +
    '. The AIs are ranking every path. The best call pays the most.';

  overlay.classList.remove('hidden');

  document.getElementById('reveal-btn').onclick = () => {
    haptic('light');
    overlay.classList.add('hidden');
  };
}

async function renderRevealed(mount, ch) {
  mount.innerHTML = `<div class="empty"><span class="loader"></span></div>`;

  try {
    const { challenge, distribution, total, pointsMap } = await api(`/api/challenge/${ch.id}/breakdown`);
    const ranking = challenge.ranking || [];
    const optionsById = Object.fromEntries((challenge.options || []).map(o => [o.id, o]));
    const myChoice = state.myPick?.choice;
    const myRank = ranking.find(r => r.id === myChoice);
    const amBest = myRank?.rank === 1;

    if (amBest && myRank.points > 0) {
      const seenKey = `hubris_reward_${ch.id}`;
      if (!sessionStorage.getItem(seenKey)) {
        sessionStorage.setItem(seenKey, '1');
        setTimeout(() => showRewardOverlay('Best Call', myRank.points), 400);
      }
    }

    mount.innerHTML = `
      <div class="day-badge">Day ${dayIndex()} · Result</div>
      <h2 class="q">${escapeHtml(challenge.question)}</h2>

      <div class="result-card">
        <div class="result-head">
          <div class="result-q">${escapeHtml(challenge.outcome_text || 'Outcome recorded.')}</div>
          <div class="result-badge ${amBest ? 'best' : myRank?.rank === ranking.length ? 'low' : 'mid'}">
            ${myRank ? (amBest ? 'Best' : `#${myRank.rank}`) : '—'}
          </div>
        </div>

        <div class="result-options">
          ${ranking.map((r, i) => {
            const opt = optionsById[r.id] || { text: r.id };
            const dist = distribution[r.id] || { percent: 0, count: 0 };
            const mine = r.id === myChoice;
            return `
              <div class="result-row ${r.rank === 1 ? 'best' : ''} ${mine ? 'mine' : ''}" style="--i:${i}">
                <div class="result-letter">${escapeHtml(r.id.toUpperCase())}</div>
                <div class="result-info">
                  <div class="result-text">${escapeHtml(opt.text)}</div>
                  <div class="result-meta">
                    <span>Rank #${r.rank}</span>
                    <span>+${r.points} Ichor</span>
                    <span>${dist.count} picks</span>
                  </div>
                  <div class="result-bar">
                    <div class="result-bar-fill" style="--w:${dist.percent}%"></div>
                  </div>
                </div>
                <div class="result-pct">${dist.percent}%</div>
              </div>
            `;
          }).join('')}
        </div>

        ${(challenge.show_reason && challenge.ai_reason) ? `
          <div class="result-reason">
            <strong>Why</strong>
            ${escapeHtml(challenge.ai_reason)}
          </div>
        ` : ''}
      </div>
    `;
  } catch (e) {
    mount.innerHTML = `<div class="empty">Could not load result</div>`;
    console.error(e);
  }
}

function showRewardOverlay(label, points) {
  const overlay = document.getElementById('reward-overlay');
  const canvas = document.getElementById('reward-canvas');
  document.getElementById('reward-label').textContent = label;
  document.getElementById('reward-points').textContent = `+${points}`;
  document.getElementById('reward-sub').textContent = 'Ichor added to your vault';

  overlay.classList.remove('hidden');
  overlay.classList.add('active');
  haptic('success');

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);

  const COLORS = ['#FFFFFF', '#D8D8DE', '#9A9AA6', '#6A6A78', '#C4C4CE'];
  const parts = [];
  const W = window.innerWidth;
  const H = window.innerHeight;
  const cx = W / 2;
  const cy = H / 2;

  for (let i = 0; i < 90; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 6 + Math.random() * 12;
    parts.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      w: 6 + Math.random() * 8,
      h: 6 + Math.random() * 8,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.4,
      life: 1,
    });
  }

  let raf;
  function tick() {
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of parts) {
      p.vy += 0.45;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 0.008;
      if (p.life > 0 && p.y < H + 40) {
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
    }
    if (alive) {
      raf = requestAnimationFrame(tick);
    } else {
      setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('active');
        cancelAnimationFrame(raf);
      }, 300);
    }
  }
  tick();

  setTimeout(() => {
    overlay.classList.add('hidden');
    overlay.classList.remove('active');
    cancelAnimationFrame(raf);
  }, 3200);
}

// ─── Quests ─────────────────────────────────────────────────
const QUEST_ICON = {
  x_follow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>',
  task: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5 11-12"/></svg>',
  research: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.6-4.6"/></svg>',
  terms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 13h5M10 17h5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 14.5l5-5"/><path d="M10.5 7H8a4 4 0 0 0 0 8h2.5"/><path d="M13.5 17H16a4 4 0 0 0 0-8h-2.5"/></svg>',
};
function questIcon(t) { return QUEST_ICON[t] || QUEST_ICON.link; }
const PROOF_HINT = { username: 'Submit username', link: 'Submit a link', screenshot: 'Submit a screenshot' };

function renderQuests() {
  const mount = document.getElementById('quests-mount');
  if (!state.quests.length) { mount.innerHTML = ''; return; }

  mount.innerHTML = `
    <div class="section-label">Side Quests</div>
    <div class="quest-list">
    ${state.quests.map(q => {
      const pending = q.my_status === 'pending';
      const rejected = q.my_status === 'rejected';
      const needsProof = q.proof_type && q.proof_type !== 'none';
      const tags = [];
      if (q.requires_terms) tags.push('§ T&amp;C');
      if (needsProof) tags.push('▣ ' + (PROOF_HINT[q.proof_type] || 'Proof'));
      return `
      <article class="quest${pending ? ' is-pending' : ''}${rejected ? ' is-rejected' : ''}" data-id="${q.id}">
        <span class="quest-liquid" aria-hidden="true"></span>
        <span class="quest-sheen" aria-hidden="true"></span>
        <div class="quest-icon">${questIcon(q.action_type)}</div>
        <div class="quest-body">
          <div class="quest-title">${escapeHtml(q.title)}</div>
          <div class="quest-desc">${escapeHtml(q.description)}</div>
          ${tags.length ? `<div class="quest-tags">${tags.map(t => `<span class="quest-tag">${t}</span>`).join('')}</div>` : ''}
        </div>
        <div class="quest-reward">+${q.reward}<span>Ichor</span></div>
        ${pending ? '<div class="quest-stamp">⧖ Pending review</div>' : ''}
        ${rejected ? '<div class="quest-stamp retry">✗ Rejected · tap to retry</div>' : ''}
      </article>`;
    }).join('')}
    </div>
  `;

  mount.querySelectorAll('.quest').forEach(el => {
    el.addEventListener('click', () => onQuestClick(el.dataset.id));
  });
}

// ─ small UI helpers ─
let _toastTimer = null;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
function pulsePill() {
  const p = document.querySelector('.points-pill');
  if (!p) return;
  p.classList.add('pulse');
  setTimeout(() => p.classList.remove('pulse'), 600);
}
function shakeEl(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

// Downscale a chosen screenshot to a compact JPEG data URL for review.
function downscaleImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      let qf = quality, out = canvas.toDataURL('image/jpeg', qf);
      while (out.length > 860000 && qf > 0.4) { qf -= 0.12; out = canvas.toDataURL('image/jpeg', qf); }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')); };
    img.src = url;
  });
}

// Dynamically-built, fully-escaped Terms & Conditions consent sheet.
// Resolves true only when the player explicitly taps "I agree".
function showTermsOverlay(quest) {
  return new Promise(resolve => {
    const back = document.createElement('div');
    back.className = 'terms-overlay';

    const sheet = document.createElement('div');
    sheet.className = 'terms-sheet';

    const h = document.createElement('div');
    h.className = 'terms-head';
    h.textContent = 'Terms & Conditions';

    const sub = document.createElement('div');
    sub.className = 'terms-sub';
    sub.textContent = quest.title;

    const body = document.createElement('div');
    body.className = 'terms-body';
    body.textContent = quest.terms_text || 'By continuing you agree to the terms of this quest.';

    const actions = document.createElement('div');
    actions.className = 'terms-actions';

    const decline = document.createElement('button');
    decline.className = 'terms-btn ghost';
    decline.textContent = 'Decline';

    const agree = document.createElement('button');
    agree.className = 'terms-btn primary';
    agree.textContent = 'I agree';

    const close = (val) => {
      back.classList.remove('active');
      setTimeout(() => back.remove(), 220);
      resolve(val);
    };
    decline.addEventListener('click', () => { haptic('light'); close(false); });
    agree.addEventListener('click', () => { haptic('success'); close(true); });
    back.addEventListener('click', (e) => { if (e.target === back) close(false); });

    actions.appendChild(decline);
    actions.appendChild(agree);
    sheet.appendChild(h);
    sheet.appendChild(sub);
    sheet.appendChild(body);
    sheet.appendChild(actions);
    back.appendChild(sheet);
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add('active'));
  });
}

// Proof submission sheet: text field for username/link, file picker for screenshot.
function showProofSheet(quest) {
  return new Promise(resolve => {
    const type = quest.proof_type;
    const back = document.createElement('div');
    back.className = 'terms-overlay';
    const sheet = document.createElement('div');
    sheet.className = 'terms-sheet proof-sheet';

    const h = document.createElement('div');
    h.className = 'terms-head';
    h.textContent = 'Submit proof';
    const sub = document.createElement('div');
    sub.className = 'terms-sub';
    sub.textContent = quest.title;

    const field = document.createElement('div');
    field.className = 'proof-field';
    let getValue = () => null;

    if (type === 'screenshot') {
      const drop = document.createElement('label');
      drop.className = 'proof-drop';
      drop.innerHTML = '<span class="proof-drop-ic">▣</span><span class="proof-drop-tx">Tap to choose a screenshot</span>';
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*'; input.hidden = true;
      const preview = document.createElement('img');
      preview.className = 'proof-preview'; preview.hidden = true;
      let dataUrl = null;
      input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        try {
          dataUrl = await downscaleImage(file, 1000, 0.82);
          preview.src = dataUrl; preview.hidden = false;
          drop.querySelector('.proof-drop-tx').textContent = 'Change screenshot';
        } catch { toast('Could not read that image'); }
      });
      drop.appendChild(input); drop.appendChild(preview);
      field.appendChild(drop);
      getValue = () => dataUrl ? { image: dataUrl } : null;
    } else {
      const input = document.createElement('input');
      input.type = type === 'link' ? 'url' : 'text';
      input.className = 'proof-input';
      input.placeholder = type === 'link' ? 'https://… link to your post' : '@yourusername';
      input.autocomplete = 'off'; input.spellcheck = false;
      field.appendChild(input);
      getValue = () => { const v = input.value.trim(); return v ? { value: v } : null; };
      setTimeout(() => input.focus(), 350);
    }

    const note = document.createElement('div');
    note.className = 'proof-note';
    note.textContent = 'An admin reviews your submission before Ichor is awarded.';

    const actions = document.createElement('div');
    actions.className = 'terms-actions';
    const cancel = document.createElement('button');
    cancel.className = 'terms-btn ghost'; cancel.textContent = 'Cancel';
    const submit = document.createElement('button');
    submit.className = 'terms-btn primary'; submit.textContent = 'Submit';

    const close = (val) => { back.classList.remove('active'); setTimeout(() => back.remove(), 220); resolve(val); };
    cancel.addEventListener('click', () => { haptic('light'); close(null); });
    submit.addEventListener('click', () => {
      const v = getValue();
      if (!v) { haptic('error'); shakeEl(sheet); return; }
      haptic('success'); close(v);
    });
    back.addEventListener('click', (e) => { if (e.target === back) close(null); });

    actions.appendChild(cancel); actions.appendChild(submit);
    sheet.appendChild(h); sheet.appendChild(sub); sheet.appendChild(field); sheet.appendChild(note); sheet.appendChild(actions);
    back.appendChild(sheet); document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add('active'));
  });
}

async function onQuestClick(questId) {
  const quest = state.quests.find(q => String(q.id) === String(questId));
  if (!quest) return;

  // Already submitted — waiting on an admin. Don't let them resubmit.
  if (quest.my_status === 'pending') { haptic('light'); toast('Awaiting admin review…'); return; }
  haptic('light');

  if (quest.action_url) {
    if (tg?.openLink) tg.openLink(quest.action_url);
    else window.open(quest.action_url, '_blank');
  }
  if (quest.verify_text && !confirm(quest.verify_text)) return;

  // Legal gate: quests flagged requires_terms must get explicit consent first.
  let agreed = false;
  if (quest.requires_terms) {
    agreed = await showTermsOverlay(quest);
    if (!agreed) return;
  }

  // Proof gate: collect the admin-chosen evidence before completing.
  const needsProof = quest.proof_type && quest.proof_type !== 'none';
  let proof = {};
  if (needsProof) {
    proof = await showProofSheet(quest);
    if (!proof) return; // cancelled
  }

  try {
    const res = await api(`/api/quests/${questId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ agreed, proof_value: proof.value, proof_image: proof.image }),
    });

    // Pending review: keep the card, flip it to a pending state, no award yet.
    if (res.status === 'pending') {
      haptic('success');
      quest.my_status = 'pending';
      renderQuests();
      toast('Submitted — pending admin review');
      return;
    }

    // Approved immediately (no-proof quest): award + remove.
    haptic('success');
    if (state.user) state.user.points += res.reward || quest.reward;
    renderUser();
    pulsePill();
    state.quests = state.quests.filter(q => String(q.id) !== String(questId));
    renderQuests();
    toast('+' + (res.reward || quest.reward) + ' Ichor');
  } catch (err) {
    if (err.error === 'done') {
      quest.my_status = 'pending';
      renderQuests();
    } else if (err.error === 'proof_required') {
      haptic('error'); toast('This quest needs proof to continue');
    } else haptic('error');
  }
}

// ─── Leaderboard ────────────────────────────────────────────
function renderBoard() {
  const mount = document.getElementById('board-mount');
  if (!state.board.length) {
    mount.innerHTML = `<div class="empty">Be the first to call it</div>`;
    return;
  }

  const top3 = state.board.slice(0, 3);
  const rest = state.board.slice(3);
  const myId = String(state.user?.telegram_id);
  const nameOf = u => u.handle || u.first_name || u.username || 'Anon';
  const primMark = u => u.is_primordial
    ? `<span class="board-prim" title="Primordial Nº${u.primordial_no ? String(u.primordial_no).padStart(3,'0') : ''}">⧉</span>`
    : '';
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  mount.innerHTML = `
    <div class="podium">
      ${podiumOrder.map((u) => {
        const realRank = top3.indexOf(u) + 1;
        return `
          <div class="podium-slot" data-rank="${realRank}">
            <div class="podium-rank">${realRank === 1 ? 'Champion' : realRank === 2 ? 'Runner-up' : 'Third'}</div>
            <div class="podium-name">${escapeHtml(nameOf(u))}${primMark(u)}</div>
            <div class="podium-pts">${u.points}</div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="board-list">
      ${rest.map((u, i) => {
        const rank = i + 4;
        const isMe = String(u.telegram_id) === myId;
        return `
          <div class="board-row ${isMe ? 'me' : ''} ${rank <= 10 ? 'top' : ''}" style="--i:${i}">
            <div class="board-rank">${rank}</div>
            <div class="board-name">${escapeHtml(nameOf(u))}${primMark(u)}</div>
            <div class="board-points">${u.points}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ─── Helpers ────────────────────────────────────────────────
function dayIndex() {
  const start = new Date('2026-01-01');
  return Math.floor((Date.now() - start) / 86400000) + 1;
}
function formatTime(d) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Copy to clipboard with graceful fallbacks (Telegram WebView + old Androids).
async function copyText(txt) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(txt);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

// Build this soul's invite link from the Antechamber referral base + Sigil.
function referralLink() {
  const base = state.ante?.referralBase || '';
  const sigil = state.user?.sigil || '';
  if (!base || !sigil) return '';
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}startapp=${encodeURIComponent(sigil)}`;
}

// ─── The Antechamber (invite-gate screen) ────────────────────────
// Full-screen gate shown before the gates open. Two faces:
//   'gate'    → a newcomer must carve a unique handle to claim a Primordial seat
//   'standby' → claimed; show the Primordial badge, Sigil, invite link + progress
function enterAntechamber() {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('antechamber').classList.remove('hidden');
  renderAntechamber();
}

function renderAntechamber() {
  const mount = document.getElementById('antechamber-mount');
  const a = state.ante || {};
  if (state.phase === 'standby') {
    mount.innerHTML = standbyHtml(a);
    wireStandby();
  } else {
    mount.innerHTML = gateHtml(a);
    wireGate();
  }
}

function progressHtml(a) {
  const claimed = a.claimed ?? 0;
  const threshold = a.threshold ?? 0;
  const pct = threshold > 0 ? Math.min(100, Math.round((claimed / threshold) * 100)) : 0;
  const remaining = a.remaining ?? Math.max(0, threshold - claimed);
  return `
    <div class="ante-progress">
      <div class="ante-progress-head">
        <span>${claimed} sworn</span>
        <span>${remaining > 0 ? remaining + ' until the gates open' : 'gates opening…'}</span>
      </div>
      <div class="ante-bar"><div class="ante-bar-fill" style="width:${pct}%"></div></div>
    </div>`;
}

function gateHtml(a) {
  const seat = (a.claimed ?? 0) + 1;
  return `
    <div class="ante-eyebrow">The Antechamber</div>
    <h1 class="ante-title">You stand before<br/>the sealed gates</h1>
    <p class="ante-sub">Only the first few are admitted. Carve your handle into the stone and claim your seat among the Primordials.</p>
    <div class="ante-seat">Next seat · <strong>Primordial Nº${String(seat).padStart(3, '0')}</strong></div>
    <div class="ante-field">
      <input id="ante-handle" class="ante-input" type="text" inputmode="text"
             autocomplete="off" autocapitalize="off" spellcheck="false"
             maxlength="20" placeholder="your unique handle" />
      <div id="ante-hint" class="ante-hint">3–20 chars · letters, numbers, _ · must be unique</div>
    </div>
    <button id="ante-claim" class="ante-pill" type="button">
      <span class="ante-pill-txt">Carve your Sigil</span>
      <span class="ante-pill-arrow">⟡</span>
    </button>
    ${progressHtml(a)}`;
}

function standbyHtml(a) {
  const u = state.user || {};
  const no = u.primordial_no ? String(u.primordial_no).padStart(3, '0') : '???';
  const link = referralLink();
  return `
    <div class="ante-eyebrow">Welcome, Primordial</div>
    <div class="prim-badge">
      <div class="prim-badge-ring"></div>
      <div class="prim-badge-label">Primordial</div>
      <div class="prim-badge-no">Nº${no}</div>
      <div class="prim-badge-handle">@${escapeHtml(u.handle || u.username || 'nameless')}</div>
    </div>
    <p class="ante-sub">Your seat is secured. The gates stay sealed until enough souls are sworn in — bring them, and open the world sooner.</p>
    ${progressHtml(a)}
    <div class="ante-oath">
      <div class="ante-oath-num">${state.oathbound}</div>
      <div class="ante-oath-label">Oathbound by your Sigil</div>
    </div>
    <div class="copy-pills">
      <button id="copy-sigil" class="copy-pill" type="button">
        <span class="copy-pill-k">Sigil</span>
        <span class="copy-pill-v">${escapeHtml(u.sigil || '—')}</span>
        <span class="copy-pill-ico">⧉</span>
      </button>
      <button id="copy-link" class="copy-pill wide" type="button" ${link ? '' : 'disabled'}>
        <span class="copy-pill-k">Invite link</span>
        <span class="copy-pill-v mono">${escapeHtml(link || 'unavailable')}</span>
        <span class="copy-pill-ico">⧉</span>
      </button>
    </div>`;
}

function validHandle(h) {
  return /^[A-Za-z0-9_]{3,20}$/.test(h);
}

function wireGate() {
  const input = document.getElementById('ante-handle');
  const btn = document.getElementById('ante-claim');
  const hint = document.getElementById('ante-hint');
  if (!input || !btn) return;

  const refresh = () => {
    const ok = validHandle(input.value.trim());
    btn.classList.toggle('ready', ok);
  };
  input.addEventListener('input', refresh);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
  setTimeout(() => input.focus(), 300);

  btn.addEventListener('click', async () => {
    const handle = input.value.trim();
    if (!validHandle(handle)) {
      hint.textContent = 'Pick 3–20 chars: letters, numbers or _';
      hint.classList.add('err');
      shakeEl(input);
      haptic('error');
      return;
    }
    btn.classList.add('busy');
    btn.disabled = true;
    try {
      await claimPrimordial(handle);
    } finally {
      btn.classList.remove('busy');
      btn.disabled = false;
    }
  });
}

function wireStandby() {
  const u = state.user || {};
  const sigilBtn = document.getElementById('copy-sigil');
  const linkBtn = document.getElementById('copy-link');
  sigilBtn?.addEventListener('click', async () => {
    if (await copyText(u.sigil || '')) { toast('Sigil copied'); haptic('success'); pulseEl(sigilBtn); }
    else { toast('Copy failed'); haptic('error'); }
  });
  linkBtn?.addEventListener('click', async () => {
    const link = referralLink();
    if (link && await copyText(link)) { toast('Invite link copied'); haptic('success'); pulseEl(linkBtn); }
    else { toast('Copy failed'); haptic('error'); }
  });
}

function pulseEl(el) {
  if (!el) return;
  el.classList.add('copied');
  setTimeout(() => el.classList.remove('copied'), 700);
}

// Carve the handle → claim a Primordial seat. 409 = handle already taken.
async function claimPrimordial(handle) {
  const hint = document.getElementById('ante-hint');
  try {
    const res = await api('/api/antechamber/claim', {
      method: 'POST',
      body: JSON.stringify({ handle }),
    });
    state.user = res.user || state.user;
    state.ante = res.antechamber || state.ante;
    state.oathbound = res.oathbound ?? state.oathbound;
    state.phase = state.ante?.phase || 'standby';
    haptic('success');
    if (state.phase === 'open') {
      toast('The gates open — welcome');
      await enterMainApp();
    } else {
      toast('Your seat is sworn');
      renderAntechamber();
    }
  } catch (e) {
    haptic('error');
    if (e.error === 'handle_taken' || e.status === 409) {
      if (hint) { hint.textContent = 'That handle is already carved — choose another'; hint.classList.add('err'); }
      const input = document.getElementById('ante-handle');
      if (input) shakeEl(input);
    } else {
      toast(e.error === 'invalid_handle' ? 'That handle is not allowed' : 'Could not claim — try again');
    }
  }
}

// ─── Referral card (shown in the main app home pane) ──────────────────
function renderReferral() {
  const mount = document.getElementById('referral-mount');
  if (!mount) return;
  const u = state.user || {};
  const sigil = u.sigil;
  if (!sigil) { mount.innerHTML = ''; return; }
  const link = referralLink();
  mount.innerHTML = `
    <div class="referral-card">
      <div class="referral-head">
        <div class="referral-title">Your Sigil</div>
        <div class="referral-oath"><strong>${state.oathbound}</strong> Oathbound</div>
      </div>
      <div class="copy-pills">
        <button id="ref-copy-sigil" class="copy-pill" type="button">
          <span class="copy-pill-k">Code</span>
          <span class="copy-pill-v">${escapeHtml(sigil)}</span>
          <span class="copy-pill-ico">⧉</span>
        </button>
        <button id="ref-copy-link" class="copy-pill wide" type="button" ${link ? '' : 'disabled'}>
          <span class="copy-pill-k">Invite link</span>
          <span class="copy-pill-v mono">${escapeHtml(link || 'unavailable')}</span>
          <span class="copy-pill-ico">⧉</span>
        </button>
      </div>
    </div>`;
  const sb = document.getElementById('ref-copy-sigil');
  const lb = document.getElementById('ref-copy-link');
  sb?.addEventListener('click', async () => {
    if (await copyText(sigil)) { toast('Sigil copied'); haptic('success'); pulseEl(sb); }
    else { toast('Copy failed'); haptic('error'); }
  });
  lb?.addEventListener('click', async () => {
    if (link && await copyText(link)) { toast('Invite link copied'); haptic('success'); pulseEl(lb); }
    else { toast('Copy failed'); haptic('error'); }
  });
}

// ─── Boot ───────────────────────────────────────────────────
// ─── Device tilt + shake (iOS liquid-glass parallax / shake-to-roll) ─────────
// Tilt feeds --mx/--my onto :root so the quest sheen tracks the gyroscope.
// Shake jiggles the quest cards with haptic feedback. On iOS 13+ the motion
// APIs need a user-gesture permission grant, so we lazily request it on the
// first tap and fall back silently when unavailable (Android/desktop just
// get the plain static glass).
let _motionReady = false;
function initLiveMotion() {
  if (_motionReady) return;
  _motionReady = true;

  const root = document.documentElement;
  let mx = 0, my = 0, tx = 0, ty = 0, raf = 0;
  const ease = () => {
    mx += (tx - mx) * 0.12; my += (ty - my) * 0.12;
    root.style.setProperty('--mx', mx.toFixed(3));
    root.style.setProperty('--my', my.toFixed(3));
    raf = (Math.abs(tx - mx) > 0.001 || Math.abs(ty - my) > 0.001) ? requestAnimationFrame(ease) : 0;
  };
  const nudge = () => { if (!raf) raf = requestAnimationFrame(ease); };

  function onOrient(e) {
    if (e.gamma == null || e.beta == null) return;
    tx = Math.max(-1, Math.min(1, e.gamma / 35));        // left/right ±35°
    ty = Math.max(-1, Math.min(1, (e.beta - 45) / 35));  // front/back around 45°
    nudge();
  }

  // Shake detection via total acceleration spikes with a cooldown.
  let lastShake = 0;
  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    const now = Date.now();
    if (mag > 24 && now - lastShake > 900) {
      lastShake = now;
      haptic('medium');
      document.querySelectorAll('.quest').forEach(shakeEl);
    }
  }

  const attach = () => {
    window.addEventListener('deviceorientation', onOrient, { passive: true });
    window.addEventListener('devicemotion', onMotion, { passive: true });
  };

  const DOE = window.DeviceOrientationEvent, DME = window.DeviceMotionEvent;
  const needGrant = (DOE && typeof DOE.requestPermission === 'function') ||
                    (DME && typeof DME.requestPermission === 'function');
  if (needGrant) {
    const req = async () => {
      try {
        if (DOE && typeof DOE.requestPermission === 'function') await DOE.requestPermission();
        if (DME && typeof DME.requestPermission === 'function') await DME.requestPermission();
        attach();
      } catch {}
      window.removeEventListener('pointerdown', req);
    };
    window.addEventListener('pointerdown', req, { once: true });
  } else {
    attach();
  }
}

async function boot() {
  initLiveMotion();

  // The Antechamber gate decides everything: read /api/me FIRST, then route.
  let meRes;
  try {
    meRes = await api('/api/me');
  } catch (e) {
    console.error(e);
    meRes = { user: null, oathbound: 0, antechamber: null };
  }

  state.user = meRes.user;
  state.oathbound = meRes.oathbound || 0;
  state.ante = meRes.antechamber || null;
  state.phase = state.ante?.phase || 'open';

  if (state.phase === 'open') {
    await enterMainApp();
  } else {
    enterAntechamber();
  }
}

// Reveal the real tab app and load its content. Wires the tab bar once.
async function enterMainApp() {
  state.phase = 'open';
  document.getElementById('antechamber').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  if (!state.mainBooted) {
    state.mainBooted = true;
    setupTabBar();
  }

  try {
    const [todayRes, questsRes, boardRes] = await Promise.all([
      api('/api/today').catch(() => ({ challenge: null })),
      api('/api/quests').catch(() => ({ quests: [] })),
      api('/api/board').catch(() => ({ board: [] })),
    ]);

    state.challenge = todayRes.challenge;
    state.quests = questsRes.quests || [];
    state.board = boardRes.board || [];

    if (state.challenge) {
      try {
        const { pick } = await api(`/api/me/pick?challengeId=${state.challenge.id}`);
        state.myPick = pick;
      } catch {}
    }

    renderUser();
    renderChallenge();
    renderQuests();
    renderReferral();
    renderBoard();
  } catch (e) {
    console.error(e);
  }
}

if (tg) {
  setTimeout(runSplash, 80);
} else {
  window.addEventListener('load', runSplash);
}