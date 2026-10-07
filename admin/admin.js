const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
tg?.setHeaderColor('#F2EFE9');
tg?.setBackgroundColor('#F2EFE9');

// Read auth from the URL. The FAB passed both params through the navigation.
const params = new URLSearchParams(location.search);
const adminToken = params.get('t') || window.__AURUM_T || '';
const initData = tg?.initData || params.get('i') || window.__AURUM_I || '';

if (!adminToken || !initData) {
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:40px;text-align:center;font-family:-apple-system,sans-serif;color:#8A7F70;background:#F2EFE9;">
      <div>
        <div style="font-size:42px;margin-bottom:18px;">🔒</div>
        <div style="font-size:18px;font-weight:800;color:#14100C;margin-bottom:10px;">Not found</div>
      </div>
    </div>`;
  throw new Error('no_auth');
}

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Init-Data': initData,
    'X-Admin-Token': adminToken,
  };

  const res = await fetch(`/api/admin${path}`, { ...options, headers });

  if (res.status === 404) {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:40px;text-align:center;font-family:-apple-system,sans-serif;color:#8A7F70;background:#F2EFE9;">
        <div>
          <div style="font-size:42px;margin-bottom:18px;">🔒</div>
          <div style="font-size:18px;font-weight:800;color:#14100C;margin-bottom:10px;">Not found</div>
        </div>
      </div>`;
    throw new Error('not_found');
  }
  if (res.status === 429) {
    toast('Too many attempts. Try again in a minute.', 'warn');
    throw new Error('rate_limited');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'request_failed');
  }
  return res.json();
}

function toast(msg, type = 'info') {
  let stack = document.getElementById('toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toast-stack';
    stack.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
    document.body.appendChild(stack);
  }
  const el = document.createElement('div');
  el.style.cssText = `
    background:${type === 'error' ? '#C33A28' : type === 'success' ? '#1D7B48' : '#14100C'};
    color:#F2EFE9;padding:14px 18px;border-radius:100px;
    font-family:ui-rounded,sans-serif;font-size:13px;font-weight:800;
    box-shadow:4px 4px 0 #14100C;border:2px solid #14100C;`;
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ─── Nav ────────────────────────────────────────────────────
function switchView(name) {
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll(`[data-view="${name}"]`).forEach(b => b.classList.add('active'));
  document.getElementById(`view-${name}`)?.classList.add('active');
  loadView(name);
}

document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

async function loadView(name) {
  try {
    if (name === 'dashboard') await loadDashboard();
    if (name === 'challenges') await loadChallenges();
    if (name === 'quests') await loadQuests();
    if (name === 'ai') await loadAiHistory();
    if (name === 'users') await loadUsers();
  } catch (e) { console.error(e); }
}

function countUp(el, target, ms = 800) {
  const start = Number(el.textContent) || 0;
  const diff = target - start;
  const t0 = performance.now();
  function step(t) {
    const p = Math.min(1, (t - t0) / ms);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + diff * eased);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ─── Dashboard ──────────────────────────────────────────────
async function loadDashboard() {
  try {
    const { users, picks, quests_completed, open_challenges, recent } = await api('/stats');
    countUp(document.getElementById('stat-users'), users);
    countUp(document.getElementById('stat-picks'), picks);
    countUp(document.getElementById('stat-quests'), quests_completed);
    countUp(document.getElementById('stat-open'), open_challenges);

    const list = document.getElementById('recent-list');
    if (!recent.length) { list.innerHTML = '<div class="empty">No challenges yet</div>'; return; }
    list.innerHTML = recent.map(r => `
      <div class="list-item">
        <div>
          <div class="title">${escapeHtml(r.question)}</div>
          <div class="meta">${r.challenge_date} · winner: ${r.winner_id || '—'}</div>
        </div>
        <span class="badge ${r.status}">${r.status}</span>
      </div>
    `).join('');
  } catch (e) { console.error(e); }
}

// ─── Challenges ─────────────────────────────────────────────
async function loadChallenges() {
  const { challenges } = await api('/challenges');
  const el = document.getElementById('challenges-list');
  if (!challenges.length) { el.innerHTML = '<div class="empty">No challenges yet</div>'; return; }

  el.innerHTML = challenges.map((c, i) => `
    <div class="card" style="--i:${i}">
      <div class="card-head">
        <div>
          <div class="card-date">${c.challenge_date}</div>
          <div class="card-title">${escapeHtml(c.question)}</div>
        </div>
        <span class="badge ${c.status}">${c.status}</span>
      </div>
      <div class="card-body">
        ${(c.options || []).length} options · ${c.pick_count} picks · ${c.use_ai ? 'AI ranked' : 'Manual'}
      </div>
      <div class="card-foot">
        ${c.status !== 'revealed'
          ? `<button class="btn-primary" data-action="resolve" data-id="${c.id}">Resolve</button>`
          : ''}
        <button class="btn-danger" data-action="delete" data-id="${c.id}">Delete</button>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('[data-action="delete"]').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm('Delete this challenge?')) return;
      try {
        await api(`/challenges/${b.dataset.id}`, { method: 'DELETE' });
        toast('Deleted', 'success');
        loadChallenges();
      } catch (e) { toast(e.message, 'error'); }
    });
  });
  el.querySelectorAll('[data-action="resolve"]').forEach(b => {
    b.addEventListener('click', () => openResolve(b.dataset.id));
  });
}

// ─── Resolve ────────────────────────────────────────────────
async function openResolve(id) {
  const { challenge } = await api(`/challenges/${id}`);
  const modal = document.getElementById('modal-resolve');
  const body = document.getElementById('resolve-body');

  body.innerHTML = `
    <p style="margin-bottom:16px;color:var(--ink-soft);font-size:13px;line-height:1.5;">
      ${escapeHtml(challenge.question)}
    </p>
    <label>Outcome text</label>
    <textarea id="resolve-outcome" rows="3">${escapeHtml(challenge.outcome_text || '')}</textarea>
    <div class="row">
      <button class="btn-primary" id="btn-resolve-ai">Let AIs rank</button>
    </div>
    <div id="resolve-report" style="margin-top:16px;"></div>
  `;

  document.getElementById('btn-resolve-ai').onclick = async () => {
    const outcome = document.getElementById('resolve-outcome').value.trim();
    if (!outcome) return toast('Enter outcome', 'error');

    try {
      await api(`/challenges/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ outcome_text: outcome }),
      });
    } catch (e) { return toast(e.message, 'error'); }

    const report = document.getElementById('resolve-report');
    report.innerHTML = '<div class="empty">Asking AIs…</div>';

    try {
      const res = await api(`/challenges/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      report.innerHTML = `
        <div class="ai-responses">
          ${(res.ai_votes || []).map(v => `
            <div class="ai-card provider-${v.provider}">
              <div class="ai-model">${v.provider}</div>
              <div class="ai-reason" style="font-family:var(--font-mono);font-size:11px;">
                ${(v.ranking || []).join(' › ')}
              </div>
            </div>
          `).join('')}
        </div>
        <div class="panel" style="margin-top:12px;">
          <strong>Consensus:</strong> ${res.ranking.join(' › ')}
        </div>
      `;
      toast('Resolved', 'success');
      setTimeout(() => { modal.close(); loadChallenges(); }, 2200);
    } catch (e) { report.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`; }
  };

  modal.showModal();
}

// ─── New Challenge ──────────────────────────────────────────
document.getElementById('btn-new-challenge')?.addEventListener('click', () => {
  const modal = document.getElementById('modal-challenge');
  const form = document.getElementById('form-challenge');
  form.reset();
  form.querySelector('[name="challenge_date"]').value = new Date().toISOString().split('T')[0];
  form.querySelector('[name="reveal_at"]').value = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 16);
  modal.showModal();
});

document.getElementById('form-challenge')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const options = fd.get('options_raw').split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [id, ...rest] = line.split('|');
    return { id: id.trim(), text: rest.join('|').trim() };
  });
  if (options.length < 2) return toast('Need at least 2 options', 'error');

  const payload = {
    challenge_date: fd.get('challenge_date'),
    question: fd.get('question'),
    options,
    outcome_text: fd.get('outcome_text') || null,
    use_ai: e.target.querySelector('[name="use_ai"]').checked,
    reveal_at: new Date(fd.get('reveal_at')).toISOString(),
  };

  try {
    await api('/challenges', { method: 'POST', body: JSON.stringify(payload) });
    toast('Created', 'success');
    document.getElementById('modal-challenge').close();
    loadChallenges();
  } catch (err) { toast(err.message, 'error'); }
});

// ─── Quests ─────────────────────────────────────────────────
async function loadQuests() {
  const { quests } = await api('/quests');
  const el = document.getElementById('quests-list');
  if (!quests.length) { el.innerHTML = '<div class="empty">No quests yet</div>'; return; }
  el.innerHTML = quests.map((q, i) => `
    <div class="card" style="--i:${i}">
      <div class="card-head">
        <div>
          <div class="card-title">${escapeHtml(q.title)}</div>
          <div class="card-date">+${q.reward} pts</div>
        </div>
        <span class="badge ${q.is_active ? 'active' : 'inactive'}">${q.is_active ? 'Active' : 'Off'}</span>
      </div>
      <div class="card-body">${escapeHtml(q.description || '—')}</div>
      <div class="card-body" style="font-size:11px;">${q.completions} completions</div>
      <div class="card-foot">
        <button class="btn-ghost" data-action="toggle" data-id="${q.id}">${q.is_active ? 'Deactivate' : 'Activate'}</button>
        <button class="btn-danger" data-action="delete" data-id="${q.id}">Delete</button>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('[data-action="toggle"]').forEach(b => {
    b.onclick = async () => {
      try { await api(`/quests/${b.dataset.id}/toggle`, { method: 'PATCH' }); loadQuests(); }
      catch (e) { toast(e.message, 'error'); }
    };
  });
  el.querySelectorAll('[data-action="delete"]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Delete?')) return;
      try { await api(`/quests/${b.dataset.id}`, { method: 'DELETE' }); loadQuests(); }
      catch (e) { toast(e.message, 'error'); }
    };
  });
}

document.getElementById('btn-new-quest')?.addEventListener('click', () => {
  const modal = document.getElementById('modal-quest');
  document.getElementById('form-quest').reset();
  modal.showModal();
});

document.getElementById('form-quest')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = {
    title: fd.get('title'),
    description: fd.get('description'),
    reward: Number(fd.get('reward')),
    action_url: fd.get('action_url') || null,
    verify_text: fd.get('verify_text') || null,
    expires_at: fd.get('expires_at') ? new Date(fd.get('expires_at')).toISOString() : null,
  };
  try {
    await api('/quests', { method: 'POST', body: JSON.stringify(payload) });
    toast('Created', 'success');
    document.getElementById('modal-quest').close();
    loadQuests();
  } catch (err) { toast(err.message, 'error'); }
});

// ─── AI Console ─────────────────────────────────────────────
document.getElementById('btn-ask-all')?.addEventListener('click', () => runAsk('all'));
document.getElementById('btn-ask-groq')?.addEventListener('click', () => runAsk('one', 0));
document.getElementById('btn-ask-cerebras')?.addEventListener('click', () => runAsk('one', 1));
document.getElementById('btn-ask-gemini')?.addEventListener('click', () => runAsk('one', 2));

async function runAsk(mode, providerIndex) {
  const prompt = document.getElementById('ai-prompt').value.trim();
  if (!prompt) return toast('Enter prompt', 'error');
  const out = document.getElementById('ai-responses');
  out.innerHTML = '<div class="empty">Asking…</div>';
  try {
    const res = mode === 'all'
      ? await api('/ai/ask-all', { method: 'POST', body: JSON.stringify({ prompt }) })
      : await api('/ai/ask-one', { method: 'POST', body: JSON.stringify({ prompt, providerIndex }) });
    const responses = mode === 'all' ? res.responses : (res.response ? [res.response] : []);
    out.innerHTML = responses.map(r => `
      <div class="ai-card provider-${r.provider}">
        <div class="ai-model">${r.provider} · ${r.model || ''}</div>
        <div class="ai-reason">${escapeHtml(r.reason || JSON.stringify(r).slice(0, 200))}</div>
      </div>
    `).join('');
    loadAiHistory();
  } catch (e) { out.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`; }
}

async function loadAiHistory() {
  const { history } = await api('/ai/history');
  const el = document.getElementById('ai-history');
  if (!history.length) { el.innerHTML = '<div class="empty">No prompts yet</div>'; return; }
  el.innerHTML = history.map(h => `
    <div class="list-item">
      <div>
        <div class="title">${escapeHtml(h.prompt.slice(0, 80))}${h.prompt.length > 80 ? '…' : ''}</div>
        <div class="meta">${new Date(h.created_at).toLocaleString()}</div>
      </div>
    </div>
  `).join('');
}

// ─── Users ──────────────────────────────────────────────────
async function loadUsers() {
  const search = document.getElementById('user-search').value.trim();
  const { users } = await api(`/users${search ? `?search=${encodeURIComponent(search)}` : ''}`);
  const tbody = document.getElementById('users-tbody');
  if (!users.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No users</td></tr>'; return; }
  tbody.innerHTML = users.map(u => `
    <tr>
      <td class="num">${u.telegram_id}</td>
      <td>${escapeHtml(u.first_name || u.username || '—')}</td>
      <td class="num">${u.points}</td>
      <td class="num">${u.streak}</td>
      <td>${new Date(u.created_at).toLocaleDateString()}</td>
      <td><button class="btn-ghost" data-edit="${u.telegram_id}" data-points="${u.points}">Edit</button></td>
    </tr>
  `).join('');
  tbody.querySelectorAll('[data-edit]').forEach(b => {
    b.onclick = async () => {
      const next = prompt('New points:', b.dataset.points);
      if (next === null) return;
      try {
        await api(`/users/${b.dataset.edit}/points`, {
          method: 'PATCH',
          body: JSON.stringify({ points: Number(next) }),
        });
        toast('Updated', 'success');
        loadUsers();
      } catch (e) { toast(e.message, 'error'); }
    };
  });
}
document.getElementById('user-search')?.addEventListener('input', debounce(loadUsers, 300));

// ─── Broadcast ──────────────────────────────────────────────
document.getElementById('btn-broadcast')?.addEventListener('click', async () => {
  const message = document.getElementById('broadcast-msg').value.trim();
  if (!message) return toast('Enter message', 'error');
  if (!confirm('Send to all?')) return;
  try {
    const res = await api('/broadcast', { method: 'POST', body: JSON.stringify({ message }) });
    toast(`Sent ${res.sent}, failed ${res.failed}`, 'success');
    document.getElementById('broadcast-msg').value = '';
  } catch (e) { toast(e.message, 'error'); }
});

// ─── Logout ─────────────────────────────────────────────────
function doLogout() { location.href = location.origin; }
document.getElementById('btn-logout')?.addEventListener('click', doLogout);
document.getElementById('btn-logout-mobile')?.addEventListener('click', doLogout);

document.querySelectorAll('[data-close]').forEach(b => {
  b.onclick = () => b.closest('dialog').close();
});

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ─── Boot ───────────────────────────────────────────────────
loadDashboard();

const who = document.getElementById('admin-who');
if (tg?.initDataUnsafe?.user) {
  who.textContent = tg.initDataUnsafe.user.first_name
    || tg.initDataUnsafe.user.username
    || 'Admin';
} else {
  who.textContent = 'Admin';
}