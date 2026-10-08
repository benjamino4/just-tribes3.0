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
      document.getElementById('app').classList.remove('hidden');
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
const QUEST_GLYPH = { x_follow: '✕', task: '◆', research: '◇', terms: '§', link: '◈' };
function questGlyph(t) { return QUEST_GLYPH[t] || QUEST_GLYPH.link; }

function renderQuests() {
  const mount = document.getElementById('quests-mount');
  if (!state.quests.length) { mount.innerHTML = ''; return; }

  mount.innerHTML = `
    <div class="section-label">Side Quests</div>
    ${state.quests.map(q => `
      <div class="quest" data-id="${q.id}">
        <div class="quest-icon">${questGlyph(q.action_type)}</div>
        <div class="quest-body">
          <div class="quest-title">${escapeHtml(q.title)}${q.requires_terms ? ' <span class="quest-flag">§ T&amp;C</span>' : ''}</div>
          <div class="quest-desc">${escapeHtml(q.description)}</div>
        </div>
        <div class="quest-reward">+${q.reward}</div>
      </div>
    `).join('')}
  `;

  mount.querySelectorAll('.quest').forEach(el => {
    el.addEventListener('click', () => onQuestClick(el.dataset.id));
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

async function onQuestClick(questId) {
  const quest = state.quests.find(q => String(q.id) === String(questId));
  if (!quest) return;
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

  try {
    const res = await api(`/api/quests/${questId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ agreed }),
    });
    haptic('success');
    if (state.user) state.user.points += res.reward || quest.reward;
    renderUser();
    document.querySelector('.points-pill')?.classList.add('pulse');
    setTimeout(() => document.querySelector('.points-pill')?.classList.remove('pulse'), 600);
    state.quests = state.quests.filter(q => String(q.id) !== String(questId));
    renderQuests();
  } catch (err) {
    if (err.error === 'done') {
      state.quests = state.quests.filter(q => String(q.id) !== String(questId));
      renderQuests();
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
  const nameOf = u => u.first_name || u.username || 'Anon';
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  mount.innerHTML = `
    <div class="podium">
      ${podiumOrder.map((u) => {
        const realRank = top3.indexOf(u) + 1;
        return `
          <div class="podium-slot" data-rank="${realRank}">
            <div class="podium-rank">${realRank === 1 ? 'Champion' : realRank === 2 ? 'Runner-up' : 'Third'}</div>
            <div class="podium-name">${escapeHtml(nameOf(u))}</div>
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
            <div class="board-name">${escapeHtml(nameOf(u))}</div>
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

// ─── Boot ───────────────────────────────────────────────────
async function boot() {
  setupTabBar();

  try {
    const [meRes, todayRes, questsRes, boardRes] = await Promise.all([
      api('/api/me').catch(() => ({ user: null })),
      api('/api/today').catch(() => ({ challenge: null })),
      api('/api/quests').catch(() => ({ quests: [] })),
      api('/api/board').catch(() => ({ board: [] })),
    ]);

    state.user = meRes.user;
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