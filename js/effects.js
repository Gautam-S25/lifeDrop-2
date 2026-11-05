/* effects.js — animations & visual effects (no dependencies) */
(function (w) {
  'use strict';
  const { $, $$, reduceMotion } = w.LD;

  const fmt = (n) => Number(n).toLocaleString('en-IN');

  /* ---------- Reveal on scroll ---------- */
  let revealIO = null;
  function observe(root) {
    const els = $$('[data-reveal]:not(.in)', root || document);
    if (reduceMotion || !('IntersectionObserver' in w)) {
      els.forEach((e) => e.classList.add('in'));
      return;
    }
    if (!revealIO) {
      revealIO = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('in');
            revealIO.unobserve(en.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    }
    els.forEach((e) => {
      if (e.dataset.delay) e.style.setProperty('--d', e.dataset.delay + 'ms');
      revealIO.observe(e);
    });
  }

  /* ---------- Animated numbers ---------- */
  function animateNumber(el, to, dur) {
    const from = parseInt(String(el.textContent).replace(/\D/g, ''), 10) || 0;
    if (reduceMotion || from === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const ms = dur || 1800;
    const ease = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
    (function step(now) {
      const p = Math.min(1, (now - t0) / ms);
      el.textContent = fmt(Math.round(from + (to - from) * ease(p)));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  function counters() {
    const els = $$('[data-count]');
    if (!('IntersectionObserver' in w)) { els.forEach((e) => (e.textContent = fmt(e.dataset.count))); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          animateNumber(en.target, Number(en.target.dataset.count));
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.4 });
    els.forEach((e) => io.observe(e));
  }

  /* ---------- Scroll UI: progress bar, nav shadow, back-to-top, timeline ---------- */
  function scrollUI() {
    const bar = $('#progress');
    const nav = $('#nav');
    const top = $('#toTop');
    const tl = $('#timeline');
    const steps = tl ? $$('.step', tl) : [];
    let ticking = false;

    function update() {
      const st = w.scrollY;
      const max = document.documentElement.scrollHeight - w.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? st / max : 0) + ')';
      nav.classList.toggle('scrolled', st > 20);
      top.classList.toggle('show', st > 700);
      if (tl) {
        const r = tl.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (w.innerHeight * 0.75 - r.top) / r.height));
        tl.style.setProperty('--p', p.toFixed(3));
        steps.forEach((s, i) => s.classList.toggle('active', p > (i + 0.4) / steps.length));
      }
      ticking = false;
    }
    w.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    w.addEventListener('resize', update);
    top.addEventListener('click', () => w.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
    update();
  }

  /* ---------- Button ripple ---------- */
  function ripple() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn');
      if (!btn || reduceMotion) return;
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height);
      const s = document.createElement('span');
      s.className = 'ripple';
      s.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + (e.clientX - r.left - size / 2) + 'px;top:' + (e.clientY - r.top - size / 2) + 'px';
      btn.appendChild(s);
      setTimeout(() => s.remove(), 650);
    });
  }

  /* ---------- 3D tilt on cards ---------- */
  function tilt(root) {
    if (reduceMotion || (w.matchMedia && w.matchMedia('(hover: none)').matches)) return;
    $$('[data-tilt]', root || document).forEach((el) => {
      if (el._tilt) return;
      el._tilt = true;
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = 'perspective(900px) rotateY(' + x * 7 + 'deg) rotateX(' + -y * 7 + 'deg) translateY(-3px)';
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- Hero parallax (mouse) ---------- */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  function parallax() {
    const hero = $('#home');
    if (!hero || reduceMotion) return;
    const items = $$('[data-depth]', hero);
    hero.addEventListener('mousemove', (e) => {
      const r = hero.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) / r.width - 0.5;
      mouse.ty = (e.clientY - r.top) / r.height - 0.5;
    });
    hero.addEventListener('mouseleave', () => { mouse.tx = 0; mouse.ty = 0; });
    (function loop() {
      mouse.x += (mouse.tx - mouse.x) * 0.08;
      mouse.y += (mouse.ty - mouse.y) * 0.08;
      items.forEach((el) => {
        const d = Number(el.dataset.depth);
        el.style.transform = 'translate3d(' + mouse.x * d + 'px,' + mouse.y * d + 'px,0)';
      });
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- Floating blood-cell particles ---------- */
  function particles() {
    const canvas = $('#heroCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const hero = canvas.parentElement;
    let W = 0, H = 0, cells = [], raf = 0, visible = true;

    function make(initial) {
      const r = 8 + Math.random() * 24;
      return {
        x: Math.random() * W, y: initial ? Math.random() * H : H + r * 2, r,
        vx: (Math.random() - 0.5) * 0.25, vy: -(0.15 + Math.random() * 0.45),
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.012,
        a: 0.1 + Math.random() * 0.24, z: 0.3 + Math.random() * 0.9
      };
    }
    function resize() {
      const dpr = Math.min(w.devicePixelRatio || 1, 2);
      const r = hero.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(48, W / 30));
      cells = Array.from({ length: n }, () => make(true));
    }
    function drawCell(c) {
      ctx.save();
      ctx.translate(c.x + mouse.x * c.z * 60, c.y + mouse.y * c.z * 60);
      ctx.rotate(c.rot);
      ctx.globalAlpha = c.a;
      const g = ctx.createRadialGradient(0, 0, c.r * 0.2, 0, 0, c.r);
      g.addColorStop(0, 'rgba(255,120,135,.95)');
      g.addColorStop(1, 'rgba(190,20,45,.95)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, c.r, c.r * 0.78, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = 'rgba(120,0,20,.35)';
      ctx.beginPath(); ctx.ellipse(0, 0, c.r * 0.45, c.r * 0.32, 0, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      cells.forEach((c, i) => {
        c.x += c.vx; c.y += c.vy; c.rot += c.vr;
        if (c.y < -c.r * 2) cells[i] = make(false);
        drawCell(c);
      });
      raf = visible && !document.hidden ? requestAnimationFrame(frame) : 0;
    }
    function start() { if (!raf && !reduceMotion) raf = requestAnimationFrame(frame); }

    resize();
    if (reduceMotion) { cells.forEach(drawCell); } else { start(); }
    w.addEventListener('resize', () => { resize(); if (reduceMotion) cells.forEach(drawCell); });
    document.addEventListener('visibilitychange', start);
    if ('IntersectionObserver' in w) {
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) start(); }).observe(hero);
    }
  }

  /* ---------- Typewriter headline ---------- */
  function typed(el, words) {
    if (!el) return;
    if (reduceMotion) { el.textContent = words[0]; return; }
    let wi = 0, i = 0, del = false;
    (function tick() {
      const word = words[wi];
      el.textContent = word.slice(0, i);
      if (!del && i === word.length) { del = true; return setTimeout(tick, 1700); }
      if (del && i === 0) { del = false; wi = (wi + 1) % words.length; return setTimeout(tick, 320); }
      i += del ? -1 : 1;
      setTimeout(tick, del ? 45 : 95);
    })();
  }

  /* ---------- Confetti burst ---------- */
  function confetti() {
    if (reduceMotion) return;
    const cv = document.createElement('canvas');
    cv.className = 'confetti';
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    const dpr = Math.min(w.devicePixelRatio || 1, 2);
    const W = (cv.width = w.innerWidth * dpr);
    const H = (cv.height = w.innerHeight * dpr);
    const colors = ['#d6213a', '#ff5d70', '#ffd6da', '#ffffff', '#9e1027', '#ffb347'];
    const pieces = Array.from({ length: 150 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.55,
      vx: (Math.random() - 0.5) * 16 * dpr, vy: (-Math.random() * 15 - 5) * dpr,
      s: (5 + Math.random() * 7) * dpr, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
      c: colors[(Math.random() * colors.length) | 0], shape: Math.random() < 0.5
    }));
    const t0 = performance.now();
    (function frame(now) {
      const t = now - t0;
      ctx.clearRect(0, 0, W, H);
      pieces.forEach((p) => {
        p.vy += 0.38 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, 1 - t / 3200);
        ctx.fillStyle = p.c;
        if (p.shape) ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        else { ctx.beginPath(); ctx.arc(0, 0, p.s / 2.4, 0, 6.2832); ctx.fill(); }
        ctx.restore();
      });
      if (t < 3300) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  }

  function init() {
    observe(document);
    counters();
    scrollUI();
    ripple();
    tilt(document);
    parallax();
    particles();
    typed($('#typed'), ['hope', 'life', 'time', 'a future']);
  }

  w.LD.fx = { init, observe, animateNumber, tilt, confetti };
})(window);
