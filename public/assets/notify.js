/* =====================================================================
   TRIBES — Dynamic Island notification helper.
   notify({ title, msg, icon, severity, action, duration, progress, onTap })
===================================================================== */
(function(){
'use strict';

function ensureRoot(){
  let root = document.getElementById('notifyRoot');
  if (!root){
    root = document.createElement('div');
    root.id = 'notifyRoot';
    root.className = 'notify-root';
    document.body.appendChild(root);
  }
  return root;
}

function notify(opts){
  opts = opts || {};
  const {
    title = '', msg = '', icon = 'bell', severity = 'default',
    action = null, duration = 4000, onTap = null, progress = null,
  } = opts;

  const root = ensureRoot();
  const el = document.createElement('div');
  el.className = 'notify sev-' + severity;

  const actionHtml = action
    ? '<button class="notify-action" type="button">' + escapeHtml(action.label || 'Open') + '</button>'
    : '';
  const progressHtml = progress
    ? '<div class="notify-progress"><i style="width:100%"></i></div>'
    : '';

  el.innerHTML =
    '<div class="notify-ico"><span data-icon="' + icon + '"></span></div>' +
    '<div class="notify-body">' +
      '<div class="notify-title">' + escapeHtml(title) + '</div>' +
      (msg ? '<div class="notify-msg">' + escapeHtml(msg) + '</div>' : '') +
    '</div>' +
    actionHtml +
    progressHtml;

  root.appendChild(el);

  if (window.hydrateIcons) window.hydrateIcons();

  if (action && action.onClick){
    const btn = el.querySelector('.notify-action');
    if (btn) btn.addEventListener('click', e => {
      e.stopPropagation();
      try { action.onClick(handle); } catch(err){ console.warn(err); }
      handle.close();
    });
  }

  el.addEventListener('click', e => {
    if (e.target.closest('.notify-action')) return;
    if (onTap) onTap(handle);
    else handle.compact();
  });

  let progressTimer = null;
  if (progress && progress.total > 0){
    const bar = el.querySelector('.notify-progress > i');
    const startedAt = Date.now();
    progressTimer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.max(0, 1 - elapsed / progress.total);
      if (bar) bar.style.width = (pct * 100).toFixed(1) + '%';
      if (pct <= 0) clearInterval(progressTimer);
    }, progress.interval || 200);
  }

  let compactTimer = null;
  if (duration > 0){
    compactTimer = setTimeout(() => handle.compact(), duration);
  }

  const handle = {
    el,
    close(){
      clearTimeout(compactTimer);
      clearInterval(progressTimer);
      el.classList.add('out');
      setTimeout(() => el.remove(), 340);
    },
    compact(){
      clearTimeout(compactTimer);
      if (el.classList.contains('compact')) return;
      el.classList.add('compact');
      if (duration > 0){
        compactTimer = setTimeout(() => handle.close(), 3000);
      }
    },
    expand(){
      el.classList.remove('compact');
      clearTimeout(compactTimer);
      if (duration > 0) compactTimer = setTimeout(() => handle.compact(), duration);
    },
  };

  const all = root.querySelectorAll('.notify');
  if (all.length > 4) all[0].remove();

  return handle;
}

function escapeHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

window.notify = notify;

})();