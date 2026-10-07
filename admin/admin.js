/* ═══════════════════════════════════════════════════════════ */
/* ADMIN PANEL — Neo-tactical console                           */
/* ═══════════════════════════════════════════════════════════ */

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
tg?.setHeaderColor('#05070C');
tg?.setBackgroundColor('#05070C');

// ─── Auth ───────────────────────────────────────────────────
const initData = tg?.initData || '';
const urlSecret = new URLSearchParams(location.search).get('secret') || '';
const SECRET = urlSecret || sessionStorage.getItem('admin_secret') || '';
if (urlSecret) sessionStorage.setItem('admin_secret', urlSecret);

// ─── Toast system ───────────────────────────────────────────
function ensureToastStack() {
  let stack = document.getElementById('toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toast-stack';
    document.body.appendChild(stack);
  }
  return stack;
}

function toast(message, type = 'info', ms = 3200) {
  const stack = ensureToastStack();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, ms);
}

// ─── API helper ─────────────────────────────────────────────
async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Init-Data': initData,
  };
  if (SECRET) headers['X-Admin-Secret'] = SECRET;

  const res = await fetch(`/api/admin${path}`, { ...options, headers });

  if (res.status === 403) {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:40px;text-align:center;font-family:-apple-system,sans-serif;color:#6B7A94;background:#05070C;">
        <div>
          <div style="font-size:42px;margin-bottom:18px;filter:drop-shadow(0 0 20px #00F0FF);">🔒</div>
          <div style="font-size:18px;font-weight:800;color:#E8F1FF;margin-bottom:10px;letter-spacing:-0.01em;">ACCESS DENIED</div>
          <div style="font-size:13px;font-family:ui-monospace,monospace;letter-spacing:0.06em;">OPEN FROM THE ADMIN TELEGRAM ACCOUNT · OR ADD ?secret=YOUR_SECRET</div>
        </div>
      </div>`;
    throw new Error('forbidden');
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

// ─── Navigation ─────────────────────────────────────────────
function switchView(viewName) {
  document.querySelectorAll('.nav-item, .mobile-nav-item')
    .forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view')
    .forEach(v => v.classList.remove('active'));

  document.querySelectorAll(`[data-view="${viewName}"]`)
    .forEach(b => b.classList.add('active'));

  const view = document.getElementById(`view-${viewName}`);
  if (view) view.classList.add('active');

  loadView(viewName);
}

document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    switchView(btn.dataset.view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
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

// ─── Count-up helper ────────────────────────────────────────
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
let dashboardTimer = null;

async function loadDashboard() {
  try {
    const { users, picks, quests_completed, open_challenges, recent } = await api('/stats');

    countUp(document.getElementById('stat-users'), users);
    countUp(document.getElementById('stat-picks'), picks);
    countUp(document.getElementById('stat-quests'), quests_completed);
    countUp(document.getElementById('stat-open'), open_challenges);

    const list = document.getElementById('recent-list');
    if (!recent.length) {
      list.innerHTML = `<div class="empty">NO CHALLENGES YET</div>`;
      return;
    }
    list.innerHTML = recent.map((r, i) => `
      <div class="list-item" style="--i:${i}">
        <div>
          <div class="title">${escapeHtml(r.question)}</div>
          <div class="meta">${r.challenge_date} · WINNER: ${r.winner_id || '—'}</div>
        </div>
        <span class="badge ${r.status}">${r.status}</span>
      </div>
    `).join('');

    // Auto-refresh while dashboard is visible
    clearTimeout(dashboardTimer);
    dashboardTimer = setTimeout(() => {
      const view = document.getElementById('view-dashboard');
      if (view?.classList.contains('active') && !document.hidden) loadDashboard();
    }, 30000);
  } catch (e) { console.error(e); }
}

// ─── Challenges ─────────────────────────────────────────────
async function loadChallenges() {
  const { challenges } = await api('/challenges');
  const el = document.getElementById('challenges-list');

  if (!challenges.length) {
    el.innerHTML = `<div class="empty">NO CHALLENGES YET</div>`;
    return;
  }

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
        ${(c.options || []).length} OPTIONS · ${c.pick_count} PICKS · ${c.use_ai ? 'AI JUDGE' : 'MANUAL'}
      </div>
      <div class="card-foot">
        <button class="btn-ghost" data-action="view" data-id="${c.id}">View</button>
        ${c.status !== 'revealed'
          ? `<button class="btn-primary" data-action="resolve" data-id="${c.id}">Resolve</button>`
          : ''}
        <button class="btn-danger" data-action="delete" data-id="${c.id}">Delete</button>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('[data-action="delete"]').forEach(b => {
    b.addEventListener('click', () => deleteChallenge(b.dataset.id));
  });
  el.querySelectorAll('[data-action="resolve"]').forEach(b => {
    b.addEventListener('click', () => openResolve(b.dataset.id));
  });
  el.querySelectorAll('[data-action="view"]').forEach(b => {
    b.addEventListener('click', () => viewChallenge(b.dataset.id));
  });
}

async function deleteChallenge(id) {
  if (!confirm('Delete this challenge and all its picks?')) return;
  try {
    await api(`/challenges/${id}`, { method: 'DELETE' });
    toast('Challenge deleted', 'success');
    loadChallenges();
  } catch (e) {
    toast('Delete failed: ' + e.message, 'error');
  }
}

async function viewChallenge(id) {
  const { challenge, picks } = await api(`/challenges/${id}`);
  const total = picks.reduce((s, p) => s + p.count, 0);
  const report = picks.map(p => {
    const pct = total ? Math.round((p.count / total) * 100) : 0;
    return `${p.choice}: ${pct}% (${p.count})`;
  }).join('\n');

  const options = (challenge.options || [])
    .map(o => `${o.id}: ${o.text}`)
    .join('\n');

  toast(
`${challenge.question}

Options:
${options}

Current picks:
${report || 'No picks yet'}

Winner: ${challenge.winner_id || 'not set'}`,
    'info', 8000
  );
}

// ─── Resolve ────────────────────────────────────────────────
async function openResolve(id) {
  const { challenge } = await api(`/challenges/${id}`);
  const modal = document.getElementById('modal-resolve');
  const body = document.getElementById('resolve-body');

  body.innerHTML = `
    <p style="margin-bottom:16px;color:var(--text-muted);font-size:13px;line-height:1.5;">
      ${escapeHtml(challenge.question)}
    </p>
    <label>Outcome text (what actually happened)</label>
    <textarea id="resolve-outcome" rows="3">${escapeHtml(challenge.outcome_text || '')}</textarea>
    <div class="row">
      <button class="btn-primary" id="btn-resolve-ai">Let AIs decide</button>
      <span style="color:var(--text-muted);font-size:12px;font-family:var(--mono);">OR PICK MANUALLY</span>
    </div>
    <div id="resolve-options" class="row" style="margin-top:12px;"></div>
    <div id="resolve-report" style="margin-top:16px;"></div>
  `;

  const optionsEl = document.getElementById('resolve-options');
  optionsEl.innerHTML = (challenge.options || []).map(o =>
    `<button class="btn-ghost" data-winner="${o.id}">${o.id}: ${escapeHtml(o.text)}</button>`
  ).join('');

  optionsEl.querySelectorAll('[data-winner]').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm(`Set winner to ${b.dataset.winner}?`)) return;
      try {
        await api(`/challenges/${id}/resolve`, {
          method: 'POST',
          body: JSON.stringify({ winner_id: b.dataset.winner }),
        });
        toast('Winner set', 'success');
        modal.close();
        loadChallenges();
      } catch (e) {
        toast('Resolve failed: ' + e.message, 'error');
      }
    });
  });

  document.getElementById('btn-resolve-ai').addEventListener('click', async () => {
    const outcome = document.getElementById('resolve-outcome').value.trim();
    if (!outcome) return toast('Enter the outcome first.', 'warn');

    try {
      await api(`/challenges/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ outcome_text: outcome }),
      });
    } catch (e) {
      toast('Save failed: ' + e.message, 'error');
      return;
    }

    const report = document.getElementById('resolve-report');
    report.innerHTML = '<div class="empty"><span class="spinner"></span> ASKING AIs…</div>';

    try {
      const res = await api(`/challenges/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      report.innerHTML = `
        <div class="ai-responses">
          ${(res.ai_votes || []).map(v => `
            <div class="ai-card provider-${v.provider}">
              <div class="ai-model">${v.provider} · ${v.model}</div>
              <div class="ai-winner">${escapeHtml(v.winner_id)}</div>
              <div class="ai-reason">${escapeHtml(v.reason || '')}</div>
            </div>
          `).join('')}
        </div>
        <div class="panel" style="margin-top:12px;">
          <strong style="color:var(--cyan);">MAJORITY WINNER: ${escapeHtml(res.winner_id)}</strong>
        </div>
      `;

      toast('Resolved by AI: ' + res.winner_id, 'success');

      setTimeout(() => {
        modal.close();
        loadChallenges();
      }, 2200);
    } catch (e) {
      report.innerHTML = `<div class="empty">ERROR: ${escapeHtml(e.message)}</div>`;
      toast('AI resolve failed: ' + e.message, 'error');
    }
  });

  modal.showModal();
}

// ─── New Challenge ──────────────────────────────────────────
document.getElementById('btn-new-challenge')?.addEventListener('click', () => {
  const modal = document.getElementById('modal-challenge');
  const form = document.getElementById('form-challenge');
  form.reset();
  document.getElementById('modal-ch-title').textContent = 'New Challenge';
  form.dataset.id = '';
  form.querySelector('[name="challenge_date"]').value =
    new Date().toISOString().split('T')[0];
  form.querySelector('[name="reveal_at"]').value =
    new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 16);
  modal.showModal();
});

document.getElementById('form-challenge')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);

  const options = fd.get('options_raw').split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const [id, ...rest] = line.split('|');
      return { id: id.trim(), text: rest.join('|').trim() };
    });

  if (options.length < 2) return toast('Need at least 2 options.', 'warn');

  const payload = {
    challenge_date: fd.get('challenge_date'),
    question: fd.get('question'),
    options,
    outcome_text: fd.get('outcome_text') || null,
    use_ai: form.querySelector('[name="use_ai"]').checked,
    reveal_at: new Date(fd.get('reveal_at')).toISOString(),
  };

  try {
    if (form.dataset.id) {
      await api(`/challenges/${form.dataset.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      toast('Challenge updated', 'success');
    } else {
      await api('/challenges', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast('Challenge created', 'success');
    }
    document.getElementById('modal-challenge').close();
    loadChallenges();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
});

// ─── Quests ─────────────────────────────────────────────────
async function loadQuests() {
  const { quests } = await api('/quests');
  const el = document.getElementById('quests-list');

  if (!quests.length) {
    el.innerHTML = `<div class="empty">NO QUESTS YET</div>`;
    return;
  }

  el.innerHTML = quests.map((q, i) => `
    <div class="card" style="--i:${i}">
      <div class="card-head">
        <div>
          <div class="card-title">${escapeHtml(q.title)}</div>
          <div class="card-date">+${q.reward} PTS</div>
        </div>
        <span class="badge ${q.is_active ? 'active' : 'inactive'}">
          ${q.is_active ? 'active' : 'inactive'}
        </span>
      </div>
      <div class="card-body">${escapeHtml(q.description || '—')}</div>
      <div class="card-body" style="font-size:11px;">
        ${q.completions} COMPLETIONS
        ${q.action_url ? ` · <a href="${escapeHtml(q.action_url)}" target="_blank" style="color:var(--cyan);">LINK</a>` : ''}
      </div>
      <div class="card-foot">
        <button class="btn-ghost" data-action="toggle" data-id="${q.id}">
          ${q.is_active ? 'Deactivate' : 'Activate'}
        </button>
        <button class="btn-danger" data-action="delete" data-id="${q.id}">Delete</button>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('[data-action="toggle"]').forEach(b => {
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await api(`/quests/${b.dataset.id}/toggle`, { method: 'PATCH' });
        toast('Quest toggled', 'success');
        loadQuests();
      } catch (e) {
        toast('Toggle failed: ' + e.message, 'error');
        b.disabled = false;
      }
    });
  });

  el.querySelectorAll('[data-action="delete"]').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm('Delete this quest?')) return;
      try {
        await api(`/quests/${b.dataset.id}`, { method: 'DELETE' });
        toast('Quest deleted', 'success');
        loadQuests();
      } catch (e) {
        toast('Delete failed: ' + e.message, 'error');
      }
    });
  });
}

document.getElementById('btn-new-quest')?.addEventListener('click', () => {
  const modal = document.getElementById('modal-quest');
  const form = document.getElementById('form-quest');
  form.reset();
  document.getElementById('modal-quest-title').textContent = 'New Quest';
  form.dataset.id = '';
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
    expires_at: fd.get('expires_at')
      ? new Date(fd.get('expires_at')).toISOString()
      : null,
  };
  try {
    await api('/quests', { method: 'POST', body: JSON.stringify(payload) });
    toast('Quest created', 'success');
    document.getElementById('modal-quest').close();
    loadQuests();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
});

// ─── AI Console ─────────────────────────────────────────────
document.getElementById('btn-ask-all')?.addEventListener('click', async () => {
  await runAsk('all', document.getElementById('ai-prompt').value.trim());
});
document.getElementById('btn-ask-groq')?.addEventListener('click', async () => {
  await runAsk('one', document.getElementById('ai-prompt').value.trim(), 0);
});
document.getElementById('btn-ask-cerebras')?.addEventListener('click', async () => {
  await runAsk('one', document.getElementById('ai-prompt').value.trim(), 1);
});
document.getElementById('btn-ask-gemini')?.addEventListener('click', async () => {
  await runAsk('one', document.getElementById('ai-prompt').value.trim(), 2);
});

async function runAsk(mode, prompt, providerIndex) {
  if (!prompt) return toast('Enter a prompt.', 'warn');
  const out = document.getElementById('ai-responses');
  out.innerHTML = '<div class="empty"><span class="spinner"></span> ASKING…</div>';

  try {
    let responses;
    if (mode === 'all') {
      const res = await api('/ai/ask-all', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      });
      responses = res.responses;
    } else {
      const res = await api('/ai/ask-one', {
        method: 'POST',
        body: JSON.stringify({ prompt, providerIndex }),
      });
      responses = res.response ? [res.response] : [];
    }

    if (!responses.length) {
      out.innerHTML = '<div class="empty">NO AI RESPONDED</div>';
      toast('No AI responded', 'warn');
      return;
    }

    out.innerHTML = responses.map(r => `
      <div class="ai-card provider-${r.provider || 'unknown'}">
        <div class="ai-model">${r.provider || 'unknown'} · ${r.model || '—'}</div>
        <div class="ai-winner">${escapeHtml(r.winner_id || '—')}</div>
        <div class="ai-reason">${escapeHtml(r.reason || '')}</div>
        <div class="ai-reason" style="margin-top:6px;font-size:10px;font-family:var(--mono);">
          CONFIDENCE: ${r.confidence ?? '—'}
        </div>
      </div>
    `).join('');

    toast(`Got ${responses.length} response(s)`, 'success');
    loadAiHistory();
  } catch (err) {
    out.innerHTML = `<div class="empty">ERROR: ${escapeHtml(err.message)}</div>`;
    toast('AI request failed: ' + err.message, 'error');
  }
}

async function loadAiHistory() {
  const { history } = await api('/ai/history');
  const el = document.getElementById('ai-history');
  if (!history.length) {
    el.innerHTML = `<div class="empty">NO PROMPTS YET</div>`;
    return;
  }
  el.innerHTML = history.map((h, i) => `
    <div class="list-item" style="--i:${i}">
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
  const { users } = await api(
    `/users${search ? `?search=${encodeURIComponent(search)}` : ''}`
  );
  const tbody = document.getElementById('users-tbody');

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">NO USERS</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr>
      <td class="num">${u.telegram_id}</td>
      <td>${escapeHtml(u.first_name || u.username || '—')}</td>
      <td class="num">${u.points}</td>
      <td class="num">${u.streak}</td>
      <td>${new Date(u.created_at).toLocaleDateString()}</td>
      <td>
        <button class="btn-ghost" data-edit="${u.telegram_id}" data-points="${u.points}">
          Edit
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-edit]').forEach(b => {
    b.addEventListener('click', async () => {
      const next = prompt('New points value:', b.dataset.points);
      if (next === null) return;
      try {
        await api(`/users/${b.dataset.edit}/points`, {
          method: 'PATCH',
          body: JSON.stringify({ points: Number(next) }),
        });
        toast('Points updated', 'success');
        loadUsers();
      } catch (e) {
        toast('Update failed: ' + e.message, 'error');
      }
    });
  });
}

document.getElementById('user-search')?.addEventListener(
  'input',
  debounce(loadUsers, 300)
);

// ─── Broadcast ──────────────────────────────────────────────
document.getElementById('btn-broadcast')?.addEventListener('click', async () => {
  const message = document.getElementById('broadcast-msg').value.trim();
  if (!message) return toast('Enter a message.', 'warn');
  if (!confirm('Send this to every user?')) return;
  try {
    const res = await api('/broadcast', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    toast(`Sent: ${res.sent} · Failed: ${res.failed}`, 'success', 5000);
    document.getElementById('broadcast-msg').value = '';
  } catch (err) {
    toast('Broadcast failed: ' + err.message, 'error');
  }
});

// ─── Logout ─────────────────────────────────────────────────
function doLogout() {
  sessionStorage.removeItem('admin_secret');
  location.reload();
}
document.getElementById('btn-logout')?.addEventListener('click', doLogout);
document.getElementById('btn-logout-mobile')?.addEventListener('click', doLogout);

// ─── Modal close ────────────────────────────────────────────
document.querySelectorAll('[data-close]').forEach(b => {
  b.addEventListener('click', () => b.closest('dialog').close());
});

// ─── Keyboard shortcuts ─────────────────────────────────────
const VIEW_KEYS = ['dashboard', 'challenges', 'quests', 'ai', 'users', 'broadcast'];
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select')) return;
  const n = Number(e.key);
  if (n >= 1 && n <= VIEW_KEYS.length) {
    switchView(VIEW_KEYS[n - 1]);
    return;
  }
  if (e.key === 'n' || e.key === 'N') {
    const active = document.querySelector('.view.active')?.id;
    if (active === 'view-challenges') document.getElementById('btn-new-challenge')?.click();
    if (active === 'view-quests') document.getElementById('btn-new-quest')?.click();
  }
});

// ─── Helpers ────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ─── Boot ───────────────────────────────────────────────────
loadDashboard();

const who = document.getElementById('admin-who');
if (tg?.initDataUnsafe?.user) {
  who.textContent = tg.initDataUnsafe.user.first_name
    || tg.initDataUnsafe.user.username
    || 'Admin';
} else if (SECRET) {
  who.textContent = 'via secret';
}