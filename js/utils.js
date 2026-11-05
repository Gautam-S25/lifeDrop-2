/* utils.js — tiny shared helpers (loaded first) */
(function (w) {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* Escape user-provided text before putting it into innerHTML */
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  /* localStorage wrapper that never throws */
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    }
  };

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fmtDate(d, opts) {
    return new Date(d).toLocaleDateString('en-IN', opts || { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function ago(ts) {
    const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return m + ' min ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' hr ago';
    return Math.floor(h / 24) + ' d ago';
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* Toast notifications */
  function toast(message, type, ms) {
    const box = $('#toasts');
    if (!box) return;
    const icons = { success: '✅', error: '⚠️', info: '💬' };
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.innerHTML = '<span aria-hidden="true">' + (icons[type] || icons.info) + '</span><p></p>';
    el.querySelector('p').textContent = message;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => {
      el.classList.remove('in');
      el.classList.add('out');
      setTimeout(() => el.remove(), 400);
    }, ms || 3400);
  }

  w.LD = Object.assign(w.LD || {}, { $, $$, esc, store, reduceMotion, fmtDate, ago, hash, toast });
})(window);
