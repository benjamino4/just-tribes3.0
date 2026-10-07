import { quoteOfTheDay } from './quotes.js';

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
tg?.setHeaderColor('#05070C');
tg?.setBackgroundColor('#05070C');

// ─── State ──────────────────────────────────────────────────
const state = {
  user: null,
  challenge: null,
  quests: [],
  board: [],
  myPick: null,
  stats: null,
};

// ─── API helper ────────────────────────────────────────────
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

// ─── Haptics ───────────────────────────────────────────────
function haptic(type = 'light') {
  try {
    if (type === 'success') tg?.HapticFeedback.notificationOccurred('success');
    else if (type === 'error') tg?.HapticFeedback.notificationOccurred('error');
    else tg?.HapticFeedback.impactOccurred(type);
  } catch {}
}

// ─── Entry animation (per-char reveal) ─────────────────────
function runEntryAnimation() {
  const entry = document.getElementById('entry');
  const quoteEl = document.getElementById('quote-text');
  const authorEl = document.getElementById('quote-author');

  const q = quoteOfTheDay();

  let html = '';
  let idx = 0;
  for (const ch of q.text) {
    if (ch === ' ') {
      html += ' ';
    } else {
      html += `<span class="char" style="animation-delay:${900 + idx * 28}ms">${escapeHtml(ch)}</span>`;
      idx++;
    }
  }
  quoteEl.innerHTML = html;

  authorEl.textContent = `— ${q.author}`;

  const readingMs = Math.max(2600, q.text.length * 42);
  setTimeout(() => {
    entry.classList.add('exit');
    setTimeout(() => {
      entry.classList.add('hidden');
      document.getElementById('home').classList.remove('hidden');
    }, 700);
  }, readingMs);
}

// ─── Render: User header ───────────────────────────────────
function renderUser() {
  const name = state.user?.first_name || state.user?.username || 'Guest';
  document.getElementById('user-name').textContent = name;
  document.getElementById('points').textContent = state.user?.points ?? 0;

  const streakEl = document.getElementById('streak');
  if (streakEl) streakEl.textContent = state.user?.streak ?? 0;
}

// ─── Render: Challenge ─────────────────────────────────────
function renderChallenge() {
  const wrap = document.getElementById('challenge-wrap');
  const ch = state.challenge;

  if (!ch) {
    wrap.innerHTML = `<div class="empty-state">NO CHALLENGE TODAY · COME BACK TOMORROW</div>`;
    return;
  }

  const revealTime = new Date(ch.reveal_at);
  const now = new Date();
  const isRevealed = ch.status === 'revealed' || (ch.winner_id && now >= revealTime);
  const isClosed = ch.status === 'closed' || (now >= revealTime && !ch.winner_id);

  if (isRevealed && ch.winner_id) {
    renderRevealed(wrap, ch);
    return;
  }

  if (isClosed) {
    wrap.innerHTML = `
      <div class="challenge-day">DAY ${dayIndex()}</div>
      <div class="challenge-question">${escapeHtml(ch.question)}</div>
      <div class="sealed-card">
        <span class="sealed-icon">◈</span>
        <div class="sealed-title">Locked</div>
        <div class="sealed-text">Entries are closed. The result will be revealed shortly.</div>
      </div>
    `;
    return;
  }

  if (state.myPick) {
    wrap.innerHTML = `
      <div class="challenge-day">DAY ${dayIndex()}</div>
      <div class="challenge-question">${escapeHtml(ch.question)}</div>
      <div class="sealed-card">
        <span class="sealed-icon">◈</span>
        <div class="sealed-title">Sealed</div>
        <div class="sealed-text">Your choice has been recorded. The AIs will judge at the reveal time.</div>
        <div class="sealed-time">REVEAL · ${formatTime(revealTime)}</div>
      </div>
    `;
    return;
  }

  const options = ch.options || [];
  wrap.innerHTML = `
    <div class="challenge-day">DAY ${dayIndex()}</div>
    <div class="challenge-question">${escapeHtml(ch.question)}</div>
    <div class="options-list" id="options-list">
      ${options.map(o => `
        <div class="option-card" data-id="${escapeAttr(o.id)}">
          <div class="option-id">${escapeHtml(o.id.toUpperCase())}</div>
          <div class="option-text">${escapeHtml(o.text)}</div>
        </div>
      `).join('')}
    </div>
    <div class="sealed-time" style="text-align:center;margin-top:18px;">
      CLOSES · ${formatTime(revealTime)}
    </div>
  `;

  document.querySelectorAll('.option-card').forEach(card => {
    card.addEventListener('click', (e) => {
      spawnRipple(card, e);
      onPick(card.dataset.id);
    });
    // Subtle parallax tilt on pointer move
    card.addEventListener('pointermove', (e) => {
      if (card.classList.contains('disabled') || card.classList.contains('selected')) return;
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(600px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg) scale(1.008)`;
    });
    card.addEventListener('pointerleave', () => {
      card.style.transform = '';
    });
  });
}

function spawnRipple(card, e) {
  const rect = card.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2.2;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left}px`;
  ripple.style.top = `${e.clientY - rect.top}px`;
  card.appendChild(ripple);
  setTimeout(() => ripple.remove(), 650);
}

// ─── Reveal view ───────────────────────────────────────────
function renderRevealed(wrap, ch) {
  const options = ch.options || [];
  const myChoice = state.myPick?.choice;
  const correct = myChoice === ch.winner_id;

  wrap.innerHTML = `
    <div class="challenge-day">DAY ${dayIndex()} · RESULT</div>
    <div class="result-banner ${correct ? 'correct' : 'wrong'}">
      ${correct ? '✓ YOU CALLED IT' : '✗ NOT THIS TIME'}
    </div>
    <div class="challenge-question">${escapeHtml(ch.question)}</div>
    <div class="options-list" id="options-list">
      ${options.map(o => {
        let cls = 'option-card disabled';
        if (o.id === ch.winner_id) cls += ' winner';
        else if (o.id === myChoice) cls += ' loser';
        return `
          <div class="${cls}" data-id="${escapeAttr(o.id)}">
            <div class="option-id">${escapeHtml(o.id.toUpperCase())}</div>
            <div class="option-text">${escapeHtml(o.text)}</div>
          </div>
        `;
      }).join('')}
    </div>
    ${ch.ai_reason ? `<div class="ai-reason">${escapeHtml(ch.ai_reason)}</div>` : ''}
    <div class="stats-block" id="stats-block">
      <div class="stats-title">HOW EVERYONE CHOSE</div>
      <div id="stats-content"><div class="loading"></div></div>
    </div>
  `;

  const winnerEl = wrap.querySelector('.option-card.winner');
  if (winnerEl) {
    spawnBurst(winnerEl);
    setTimeout(() => spawnBurst(winnerEl), 220);
  }

  if (correct) {
    haptic('success');
    spawnConfetti();
  } else {
    haptic('error');
  }

  loadStats(ch.id);
}

// ─── Burst particles on winning option ─────────────────────
function spawnBurst(el) {
  const ring = document.createElement('span');
  ring.className = 'burst-ring';
  el.appendChild(ring);
  setTimeout(() => ring.remove(), 950);

  for (let i = 0; i < 10; i++) {
    const dot = document.createElement('span');
    dot.className = 'burst-dot';
    const angle = (i / 10) * Math.PI * 2;
    const dist = 60 + Math.random() * 40;
    dot.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    dot.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    dot.style.left = '50%';
    dot.style.top = '50%';
    el.appendChild(dot);
    setTimeout(() => dot.remove(), 850);
  }
}

// ─── Confetti on correct pick ──────────────────────────────
function spawnConfetti() {
  const colors = ['#00F0FF', '#FFB800', '#FF006E', '#00FF88'];
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  for (let i = 0; i < 28; i++) {
    const p = document.createElement('span');
    p.className = 'confetti-piece';
    p.style.background = colors[i % colors.length];
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    p.style.boxShadow = `0 0 10px ${colors[i % colors.length]}`;
    const angle = Math.random() * Math.PI * 2;
    const dist = 120 + Math.random() * 220;
    p.style.setProperty('--cx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--cy', `${Math.sin(angle) * dist + 120}px`);
    p.style.setProperty('--cr', `${Math.random() * 720 - 360}deg`);
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1900);
  }
}

// ─── Stats ─────────────────────────────────────────────────
async function loadStats(challengeId) {
  try {
    const { stats } = await api(`/api/challenge/${challengeId}/stats`);
    const container = document.getElementById('stats-content');
    if (!container) return;
    if (!stats.length) {
      container.innerHTML = `<div class="empty-state">NO PICKS RECORDED</div>`;
      return;
    }
    container.innerHTML = stats.map((s, i) => `
      <div class="stat-row" style="--i:${i}">
        <span class="stat-label">${escapeHtml(s.choice.toUpperCase())}</span>
        <div class="stat-bar">
          <div class="stat-fill" style="--target:${s.percent}%"></div>
        </div>
        <span class="stat-pct">${s.percent}%</span>
      </div>
    `).join('');
  } catch {
    const c = document.getElementById('stats-content');
    if (c) c.innerHTML = '';
  }
}

// ─── Pick handler ──────────────────────────────────────────
async function onPick(choiceId) {
  if (state.myPick) return;

  document.querySelectorAll('.option-card').forEach(c => {
    c.style.pointerEvents = 'none';
    c.classList.add('disabled');
  });

  const chosen = document.querySelector(`.option-card[data-id="${choiceId}"]`);
  if (chosen) {
    chosen.classList.remove('disabled');
    chosen.classList.add('selected');
  }
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

    setTimeout(() => {
      const wrap = document.getElementById('challenge-wrap');
      wrap.style.animation = 'sealFlip 0.6s cubic-bezier(0.4,0,0.2,1)';
      setTimeout(() => {
        renderChallenge();
        wrap.style.animation = '';
      }, 300);
    }, 500);
  } catch (err) {
    if (err.error === 'already_picked') {
      state.myPick = { choice: choiceId };
      renderChallenge();
      return;
    }
    haptic('error');
    alert('Could not submit. Try again.');
    renderChallenge();
  }
}

// ─── Quests ────────────────────────────────────────────────
function renderQuests() {
  const wrap = document.getElementById('quests-wrap');
  if (!state.quests.length) {
    wrap.innerHTML = '';
    return;
  }

  wrap.innerHTML = `
    <div class="section-title">SIDE QUESTS</div>
    ${state.quests.map((q, i) => `
      <div class="quest-card" data-id="${q.id}" style="--i:${i}">
        <div class="quest-icon">🎯</div>
        <div class="quest-body">
          <div class="quest-title">${escapeHtml(q.title)}</div>
          <div class="quest-desc">${escapeHtml(q.description)}</div>
        </div>
        <div class="quest-reward">+${q.reward}</div>
      </div>
    `).join('')}
  `;

  document.querySelectorAll('.quest-card').forEach(card => {
    card.addEventListener('click', () => onQuestClick(card.dataset.id));
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

  if (quest.verify_text) {
    const ok = confirm(quest.verify_text);
    if (!ok) return;
  }

  try {
    const res = await api(`/api/quests/${questId}/complete`, { method: 'POST' });
    haptic('success');
    if (state.user) state.user.points += res.reward || quest.reward;
    renderUser();
    state.quests = state.quests.filter(q => String(q.id) !== String(questId));
    renderQuests();
  } catch (err) {
    if (err.error === 'done') {
      state.quests = state.quests.filter(q => String(q.id) !== String(questId));
      renderQuests();
    } else {
      haptic('error');
    }
  }
}

// ─── Leaderboard ───────────────────────────────────────────
function renderBoard() {
  const el = document.getElementById('board-list');
  if (!state.board.length) {
    el.innerHTML = `<div class="empty-state">BE THE FIRST TO CALL IT</div>`;
    return;
  }

  el.innerHTML = state.board.map((u, i) => {
    const rank = i + 1;
    const isMe = String(u.telegram_id) === String(state.user?.telegram_id);
    const topClass = rank <= 3 ? `top-${rank}` : '';
    return `
      <div class="board-row ${topClass} ${isMe ? 'me' : ''}">
        <div class="board-rank">${rank}</div>
        <div class="board-name">${escapeHtml(u.first_name || u.username || 'Anon')}</div>
        <div class="board-points">${u.points}</div>
      </div>
    `;
  }).join('');
}

// ─── Floating Admin FAB ────────────────────────────────────
function renderAdminFab() {
  if (!state.user?.is_admin) return;
  if (document.getElementById('admin-fab')) return;

  const fab = document.createElement('button');
  fab.id = 'admin-fab';
  fab.setAttribute('aria-label', 'Admin panel');
  fab.innerHTML = '◈';

  // Restore position
  const saved = JSON.parse(localStorage.getItem('admin_fab_pos') || 'null');
  const defaultPos = {
    x: window.innerWidth - 70,
    y: window.innerHeight - 130,
  };
  let pos = saved || defaultPos;
  pos.x = Math.min(Math.max(8, pos.x), window.innerWidth - 60);
  pos.y = Math.min(Math.max(8, pos.y), window.innerHeight - 60);

  fab.style.left = pos.x + 'px';
  fab.style.top = pos.y + 'px';

  let dragging = false;
  let moved = false;
  let startX = 0, startY = 0;
  let offsetX = 0, offsetY = 0;
  let lastTap = 0;

  function pointerDown(e) {
    dragging = true;
    moved = false;
    fab.classList.add('dragging');
    const rect = fab.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    fab.setPointerCapture?.(e.pointerId);
  }

  function pointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
    pos.x = e.clientX - offsetX;
    pos.y = e.clientY - offsetY;
    pos.x = Math.min(Math.max(4, pos.x), window.innerWidth - 56);
    pos.y = Math.min(Math.max(4, pos.y), window.innerHeight - 56);
    fab.style.left = pos.x + 'px';
    fab.style.top = pos.y + 'px';
  }

  function pointerUp() {
    if (!dragging) return;
    dragging = false;
    fab.classList.remove('dragging');

    // Snap to nearest horizontal edge
    const mid = window.innerWidth / 2;
    pos.x = pos.x + 26 < mid ? 16 : window.innerWidth - 68;
    pos.y = Math.min(Math.max(16, pos.y), window.innerHeight - 68);
    fab.style.transition = 'left 260ms cubic-bezier(0.2,0.9,0.2,1), top 260ms cubic-bezier(0.2,0.9,0.2,1)';
    fab.style.left = pos.x + 'px';
    fab.style.top = pos.y + 'px';
    localStorage.setItem('admin_fab_pos', JSON.stringify(pos));
    setTimeout(() => { fab.style.transition = ''; }, 280);

    // Tap detection
    if (!moved) {
      const now = Date.now();
      if (now - lastTap < 300) {
        // Double-tap: reset position
        pos = { ...defaultPos };
        fab.style.left = pos.x + 'px';
        fab.style.top = pos.y + 'px';
        localStorage.setItem('admin_fab_pos', JSON.stringify(pos));
        haptic('light');
        lastTap = 0;
        return;
      }
      lastTap = now;
      setTimeout(() => {
        if (Date.now() - lastTap >= 300 && lastTap !== 0) {
          openAdminPanel();
          lastTap = 0;
        }
      }, 310);
    }
  }

  fab.addEventListener('pointerdown', pointerDown);
  fab.addEventListener('pointermove', pointerMove);
  fab.addEventListener('pointerup', pointerUp);
  fab.addEventListener('pointercancel', pointerUp);

  document.body.appendChild(fab);
}

function openAdminPanel() {
  haptic('success');
  // The admin panel authenticates via X-Init-Data, so no secret needed
  // if this user's Telegram ID matches ADMIN_TELEGRAM_ID.
  const url = `${location.origin}/admin-console`;
  if (tg?.openLink) tg.openLink(url, { try_instant_view: false });
  else window.open(url, '_blank');
}

// ─── Helpers ───────────────────────────────────────────────
function dayIndex() {
  const start = new Date('2026-01-01');
  const diff = Math.floor((Date.now() - start) / 86400000);
  return diff + 1;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttr(s) { return escapeHtml(s); }

// ─── Boot ──────────────────────────────────────────────────
async function boot() {
  runEntryAnimation();

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
    renderAdminFab();
  } catch (e) {
    console.error(e);
  }
}

if (tg) {
  tg.onEvent('themeChanged', () => {});
  setTimeout(boot, 100);
} else {
  window.addEventListener('load', boot);
}