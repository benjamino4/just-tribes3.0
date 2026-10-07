/* ═══════════════════════════════════════════════════════════ */
/* ADMIN PANEL — Full logic                                     */
/* Auth, navigation, all CRUD views, AI console, broadcast      */
/* ═══════════════════════════════════════════════════════════ */

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

// ─── Auth ───────────────────────────────────────────────────
const initData = tg?.initData || '';
const urlSecret = new URLSearchParams(location.search).get('secret') || '';
const SECRET = urlSecret || sessionStorage.getItem('admin_secret') || '';
if (urlSecret) sessionStorage.setItem('admin_secret', urlSecret);

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
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:40px;text-align:center;font-family:-apple-system,sans-serif;color:#8A8178;">
        <div>
          <div style="font-size:32px;margin-bottom:16px;">🔒</div>
          <div style="font-size:16px;font-weight:600;color:#1A1A1A;margin-bottom:8px;">Forbidden</div>
          <div style="font-size:14px;">Open this page from the admin Telegram account, or add ?secret=YOUR_SECRET to the URL.</div>
        </div>
      </div>`;
    throw new Error('forbidden');
  }
  if (res.status === 429) {
    alert('Too many attempts. Try again in a minute.');
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
  } catch (e) {
    console.error(e);
  }
}

// ─── Dashboard ──────────────────────────────────────────────
async function loadDashboard() {
  try {
    const { users, picks, quests_completed, open_challenges, recent } = await api('/stats');

    document.getElementById('stat-users').textContent = users;
    document.getElementById('stat-picks').textContent = picks;
    document.getElementById('stat-quests').textContent = quests_completed;
    document.getElementById('stat-open').textContent = open_challenges;

    const list = document.getElementById('recent-list');
    if (!recent.length) {
      list.innerHTML = `<div class="empty">No challenges yet.</div>`;
      return;
    }
    list.innerHTML = recent.map(r => `
      <div class="list-item">
        <div>
          <div class="title">${escapeHtml(r.question)}</div>
          <div class="meta">${r.challenge_date} · winner: ${r.winner_id || '—'}</div>
        </div>
        <span class="badge ${r.status}">${r.status}</span>
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

// ─── Challenges ─────────────────────────────────────────────
async function loadChallenges() {
  const { challenges } = await api('/challenges');
  const el = document.getElementById('challenges-list');

  if (!challenges.length) {
    el.innerHTML = `<div class="empty">No challenges yet. Create one.</div>`;
    return;
  }

  el.innerHTML = challenges.map(c => `
    <div class="card">
      <div class="card-head">
        <div>
          <div class="card-date">${c.challenge_date}</div>
          <div class="card-title">${escapeHtml(c.question)}</div>
        </div>
        <span class="badge ${c.status}">${c.status}</span>
      </div>
      <div class="card-body">
        ${(c.options || []).length} options ·
        ${c.pick_count} picks ·
        ${c.use_ai ? 'AI judge' : 'Manual judge'}
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
  await api(`/challenges/${id}`, { method: 'DELETE' });
  loadChallenges();
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

  alert(
`${challenge.question}

Options:
${options}

Current picks:
${report || 'No picks yet'}

Winner: ${challenge.winner_id || 'not set'}

AI reason: ${challenge.ai_reason || '—'}`
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
      <span style="color:var(--text-muted);font-size:12px;">or pick manually below</span>
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
      if (!confirm(`Set winner to ${b.dataset.winner}? This cannot be undone.`)) return;
      await api(`/challenges/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ winner_id: b.dataset.winner }),
      });
      modal.close();
      loadChallenges();
    });
  });

  document.getElementById('btn-resolve-ai').addEventListener('click', async () => {
    const outcome = document.getElementById('resolve-outcome').value.trim();
    if (!outcome) return alert('Enter the outcome first.');

    await api(`/challenges/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ outcome_text: outcome }),
    });

    const report = document.getElementById('resolve-report');
    report.innerHTML = '<div class="empty"><span class="spinner"></span> Asking AIs…</div>';

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
        <strong>Majority winner: ${escapeHtml(res.winner_id)}</strong>
      </div>
    `;

    setTimeout(() => {
      modal.close();
      loadChallenges();
    }, 2000);
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

  if (options.length < 2) return alert('Need at least 2 options.');

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
    } else {
      await api('/challenges', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    document.getElementById('modal-challenge').close();
    loadChallenges();
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

// ─── Quests ─────────────────────────────────────────────────
async function loadQuests() {
  const { quests } = await api('/quests');
  const el = document.getElementById('quests-list');

  if (!quests.length) {
    el.innerHTML = `<div class="empty">No quests yet.</div>`;
    return;
  }

  el.innerHTML = quests.map(q => `
    <div class="card">
      <div class="card-head">
        <div>
          <div class="card-title">${escapeHtml(q.title)}</div>
          <div class="card-date">+${q.reward} pts</div>
        </div>
        <span class="badge ${q.is_active ? 'active' : 'inactive'}">
          ${q.is_active ? 'active' : 'inactive'}
        </span>
      </div>
      <div class="card-body">${escapeHtml(q.description || '—')}</div>
      <div class="card-body" style="font-size:12px;">
        ${q.completions} completions
        ${q.action_url ? ` · <a href="${escapeHtml(q.action_url)}" target="_blank" style="color:var(--brand);">link</a>` : ''}
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
      await api(`/quests/${b.dataset.id}/toggle`, { method: 'PATCH' });
      loadQuests();
    });
  });

  el.querySelectorAll('[data-action="delete"]').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm('Delete this quest?')) return;
      await api(`/quests/${b.dataset.id}`, { method: 'DELETE' });
      loadQuests();
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
    document.getElementById('modal-quest').close();
    loadQuests();
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

// ─── AI Console ─────────────────────────────────────────────
document.getElementById('btn-ask-all')?.addEventListener('click', async () => {
  const prompt = document.getElementById('ai-prompt').value.trim();
  await runAsk('all', prompt);
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
  if (!prompt) return alert('Enter a prompt.');
  const out = document.getElementById('ai-responses');
  out.innerHTML = '<div class="empty"><span class="spinner"></span> Asking…</div>';

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
      out.innerHTML = '<div class="empty">No AI responded.</div>';
      return;
    }

    out.innerHTML = responses.map(r => `
      <div class="ai-card provider-${r.provider || 'unknown'}">
        <div class="ai-model">${r.provider || 'unknown'} · ${r.model || '—'}</div>
        <div class="ai-winner">${escapeHtml(r.winner_id || '—')}</div>
        <div class="ai-reason">${escapeHtml(r.reason || '')}</div>
        <div class="ai-reason" style="margin-top:6px;font-size:11px;">
          confidence: ${r.confidence ?? '—'}
        </div>
      </div>
    `).join('');

    loadAiHistory();
  } catch (err) {
    out.innerHTML = `<div class="empty">Error: ${escapeHtml(err.message)}</div>`;
  }
}

async function loadAiHistory() {
  const { history } = await api('/ai/history');
  const el = document.getElementById('ai-history');
  if (!history.length) {
    el.innerHTML = `<div class="empty">No prompts yet.</div>`;
    return;
  }
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
  const { users } = await api(
    `/users${search ? `?search=${encodeURIComponent(search)}` : ''}`
  );
  const tbody = document.getElementById('users-tbody');

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">No users.</td></tr>`;
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
      await api(`/users/${b.dataset.edit}/points`, {
        method: 'PATCH',
        body: JSON.stringify({ points: Number(next) }),
      });
      loadUsers();
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
  if (!message) return;
  if (!confirm('Send this to every user?')) return;
  try {
    const res = await api('/broadcast', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    alert(`Sent: ${res.sent}\nFailed: ${res.failed}`);
    document.getElementById('broadcast-msg').value = '';
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

// ─── Logout ─────────────────────────────────────────────────
function doLogout() {
  sessionStorage.removeItem('admin_secret');
  location.reload();
}
document.getElementById('btn-logout')?.addEventListener('click', doLogout);
document.getElementById('btn-logout-mobile')?.addEventListener('click', doLogout);

// ─── Modal close buttons ────────────────────────────────────
document.querySelectorAll('[data-close]').forEach(b => {
  b.addEventListener('click', () => b.closest('dialog').close());
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

// Show admin identity
const who = document.getElementById('admin-who');
if (tg?.initDataUnsafe?.user) {
  who.textContent = tg.initDataUnsafe.user.first_name
    || tg.initDataUnsafe.user.username
    || 'Admin';
} else if (SECRET) {
  who.textContent = 'via secret';
}