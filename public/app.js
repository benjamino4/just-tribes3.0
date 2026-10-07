import { quoteOfTheDay } from './quotes.js';

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
tg?.setHeaderColor('#F7F4EF');
tg?.setBackgroundColor('#F7F4EF');

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

// ─── Quote Reveal (Entry) ──────────────────────────────────
function runEntryAnimation() {
  const entry = document.getElementById('entry');
  const quoteEl = document.getElementById('quote-text');
  const authorEl = document.getElementById('quote-author');

  const q = quoteOfTheDay();

  // Split into words, stagger reveal
  quoteEl.innerHTML = q.text
    .split(' ')
    .map((w, i) => `<span class="word" style="animation-delay:${1200 + i * 70}ms">${w}</span>`)
    .join(' ');

  authorEl.textContent = `— ${q.author}`;

  // Exit after reading time (scaled to quote length)
  const readingMs = Math.max(2400, q.text.length * 55);
  setTimeout(() => {
    entry.classList.add('exit');
    setTimeout(() => {
      entry.classList.add('hidden');
      document.getElementById('home').classList.remove('hidden');
    }, 600);
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
    wrap.innerHTML = `<div class="empty-state">No challenge today. Come back tomorrow.</div>`;
    return;
  }

  const revealTime = new Date(ch.reveal_at);
  const now = new Date();
  const isRevealed = ch.status === 'revealed' || (ch.winner_id && now >= revealTime);
  const isClosed = ch.status === 'closed' || (now >= revealTime && !ch.winner_id);

  // ── Already revealed ─────────────────────────────────
  if (isRevealed && ch.winner_id) {
    renderRevealed(wrap, ch);
    return;
  }

  // ── Closed but not revealed ──────────────────────────
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

  // ── Already picked: sealed state ─────────────────────
  if (state.myPick) {
    wrap.innerHTML = `
      <div class="challenge-day">DAY ${dayIndex()}</div>
      <div class="challenge-question">${escapeHtml(ch.question)}</div>
      <div class="sealed-card">
        <span class="sealed-icon">◈</span>
        <div class="sealed-title">Sealed</div>
        <div class="sealed-text">Your choice has been recorded. The AIs will judge at the reveal time.</div>
        <div class="sealed-time">Reveal · ${formatTime(revealTime)}</div>
      </div>
    `;
    return;
  }

  // ── Open: user can pick ──────────────────────────────
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
    <div class="sealed-time" style="text-align:center;margin-top:16px;">
      Closes at ${formatTime(revealTime)}
    </div>
  `;

  document.querySelectorAll('.option-card').forEach(card => {
    card.addEventListener('click', () => onPick(card.dataset.id));
  });
}

// ─── Reveal view ───────────────────────────────────────────
function renderRevealed(wrap, ch) {
  const options = ch.options || [];
  const myChoice = state.myPick?.choice;
  const correct = myChoice === ch.winner_id;

  wrap.innerHTML = `
    <div class="challenge-day">DAY ${dayIndex()} · RESULT</div>
    <div class="result-banner ${correct ? 'correct' : 'wrong'}">
      ${correct ? '✓ You called it' : '✗ Not this time'}
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
      <div class="stats-title">How everyone chose</div>
      <div id="stats-content"><div class="loading"></div></div>
    </div>
  `;

  // Amber burst on the winning card
  const winnerEl = wrap.querySelector('.option-card.winner');
  if (winnerEl) {
    const burst = document.createElement('div');
    burst.className = 'burst';
    winnerEl.appendChild(burst);
    setTimeout(() => burst.remove(), 900);
  }

  // Haptics
  if (correct) haptic('success');
  else haptic('error');

  // Load stats
  loadStats(ch.id);
}

// ─── Stats fetch and render ────────────────────────────────
async function loadStats(challengeId) {
  try {
    const { stats, total } = await api(`/api/challenge/${challengeId}/stats`);
    const container = document.getElementById('stats-content');
    if (!container) return;
    if (!stats.length) {
      container.innerHTML = `<div class="empty-state">No picks recorded.</div>`;
      return;
    }
    container.innerHTML = stats.map(s => `
      <div class="stat-row">
        <span class="stat-label">${escapeHtml(s.choice.toUpperCase())}</span>
        <div class="stat-bar">
          <div class="stat-fill" style="width:${s.percent}%"></div>
        </div>
        <span class="stat-pct">${s.percent}%</span>
      </div>
    `).join('');
  } catch (e) {
    const c = document.getElementById('stats-content');
    if (c) c.innerHTML = '';
  }
}

// ─── Pick handler ──────────────────────────────────────────
async function onPick(choiceId) {
  if (state.myPick) return;

  // Freeze UI
  document.querySelectorAll('.option-card').forEach(c => {
    c.style.pointerEvents = 'none';
    c.classList.add('disabled');
  });

  // Visual selection
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

    // Seal animation
    setTimeout(() => {
      const wrap = document.getElementById('challenge-wrap');
      wrap.style.animation = 'sealFlip 0.6s cubic-bezier(0.4,0,0.2,1)';
      setTimeout(() => {
        renderChallenge();
        wrap.style.animation = '';
      }, 300);
    }, 400);
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
    <div class="section-title">Side Quests</div>
    ${state.quests.map(q => `
      <div class="quest-card" data-id="${q.id}">
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

  // Open sponsor link if present
  if (quest.action_url) {
    if (tg?.openLink) tg.openLink(quest.action_url);
    else window.open(quest.action_url, '_blank');
  }

  // If verify_text present, confirm completion
  if (quest.verify_text) {
    const ok = confirm(quest.verify_text);
    if (!ok) return;
  }

  try {
    const res = await api(`/api/quests/${questId}/complete`, { method: 'POST' });
    haptic('success');
    // Optimistically update user points
    if (state.user) state.user.points += res.reward || quest.reward;
    renderUser();
    // Remove from list
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

// ─── Leaderboard ("The Circle") ────────────────────────────
function renderBoard() {
  const el = document.getElementById('board-list');
  if (!state.board.length) {
    el.innerHTML = `<div class="empty-state">Be the first to call it.</div>`;
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

    // Fetch my pick for today's challenge if there is one
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

// Wait for Telegram to be fully ready before boot
if (tg) {
  tg.onEvent('themeChanged', () => {});
  setTimeout(boot, 100);
} else {
  window.addEventListener('load', boot);
}