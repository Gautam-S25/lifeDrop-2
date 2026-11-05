/* app.js — LifeDrop application logic */
(function () {
  'use strict';

  const { $, $$, esc, store, toast, ago, fmtDate, hash, reduceMotion, fx, data: D } = window.LD;

  const KEYS = {
    donors: 'lifedrop.donors',
    reqs: 'lifedrop.requests',
    helped: 'lifedrop.helped',
    theme: 'lifedrop.theme',
    admin: 'lifedrop.admin'
  };
  const ADMIN_PIN = '1234';
  const BASE_DONORS = 12480;
  const SLOT_CAPACITY = 6;

  /* ====================================================
     Shared helpers
     ==================================================== */
  const pad = (n) => String(n).padStart(2, '0');
  const getDonors = () => store.get(KEYS.donors, []);
  const saveDonors = (list) => store.set(KEYS.donors, list);
  const campById = (id) => D.camps.find((c) => c.id === id);
  const seatsBooked = (c) => c.booked + getDonors().filter((d) => d.campId === c.id).length;
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const smooth = reduceMotion ? 'auto' : 'smooth';

  function localISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function slotLabel(s) {
    const [h, m] = s.split(':').map(Number);
    return ((h % 12) || 12) + ':' + pad(m) + ' ' + (h >= 12 ? 'PM' : 'AM');
  }
  function campStart(c) {
    const d = new Date(c.date);
    const [h, m] = c.start.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  }
  function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: smooth, block: 'start' });
  }
  function download(content, filename, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* Build and download an .ics calendar file */
  function downloadICS(camp, slot) {
    const s = campStart(camp);
    const e = new Date(s);
    if (slot) {
      const [sh, sm] = slot.split(':').map(Number);
      s.setHours(sh, sm, 0, 0);
      e.setTime(s.getTime() + 3600e3);
    } else {
      const [eh, em] = camp.end.split(':').map(Number);
      e.setHours(eh, em, 0, 0);
    }
    const f = (d) => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00';
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LifeDrop//Blood Camp//EN', 'BEGIN:VEVENT',
      'UID:' + camp.id + '-' + f(s) + '@lifedrop', 'DTSTAMP:' + f(new Date()),
      'DTSTART:' + f(s), 'DTEND:' + f(e),
      'SUMMARY:Blood donation - ' + camp.name,
      'LOCATION:' + (camp.venue + ', ' + camp.city).replace(/,/g, '\\,'),
      'DESCRIPTION:Eat well\\, drink water and carry a photo ID.',
      'END:VEVENT', 'END:VCALENDAR'
    ];
    download(lines.join('\r\n'), camp.id + '-blood-camp.ics', 'text/calendar');
    toast('Calendar file downloaded', 'success');
  }

  /* ====================================================
     Theme
     ==================================================== */
  function initTheme() {
    const btn = $('#themeBtn');
    const apply = (t, save) => {
      document.documentElement.setAttribute('data-theme', t);
      btn.textContent = t === 'dark' ? '☀️' : '🌙';
      btn.setAttribute('aria-pressed', String(t === 'dark'));
      if (save) store.set(KEYS.theme, t);
      window.dispatchEvent(new Event('themechange'));
    };
    apply(document.documentElement.getAttribute('data-theme') || 'light', false);
    btn.addEventListener('click', () => {
      apply(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
    });
  }

  /* ====================================================
     Navigation (mobile menu + scroll-spy)
     ==================================================== */
  function initNav() {
    const burger = $('#burger');
    const links = $('#navLinks');
    const close = () => {
      links.classList.remove('open');
      burger.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    };
    burger.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      burger.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    const map = new Map($$('a', links).map((a) => [a.getAttribute('href').slice(1), a]));
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          map.forEach((a) => a.classList.remove('active'));
          const a = map.get(en.target.id);
          if (a) a.classList.add('active');
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      map.forEach((a, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
    }
  }

  /* ====================================================
     Stats (counters reflect locally registered donors)
     ==================================================== */
  function refreshStats(animate) {
    const donors = BASE_DONORS + getDonors().length;
    [['#statDonors', donors], ['#statLives', donors * 3]].forEach(([sel, val]) => {
      const el = $(sel);
      el.dataset.count = val;
      if (animate) fx.animateNumber(el, val, 900);
    });
  }

  /* ====================================================
     Countdown to the next camp
     ==================================================== */
  function initCountdown() {
    const now = Date.now();
    const upcoming = D.camps.slice().sort((a, b) => campStart(a) - campStart(b)).find((c) => campStart(c) > now) || D.camps[0];
    const target = campStart(upcoming);
    $('#cdName').textContent = upcoming.name + ' · ' + upcoming.city;
    const els = { d: $('#cdD'), h: $('#cdH'), m: $('#cdM'), s: $('#cdS') };
    function set(el, val) {
      const txt = pad(val);
      if (el.textContent !== txt) {
        el.textContent = txt;
        if (!reduceMotion) { el.classList.remove('tickin'); void el.offsetWidth; el.classList.add('tickin'); }
      }
    }
    function tick() {
      let diff = Math.max(0, target - Date.now());
      const d = Math.floor(diff / 864e5); diff -= d * 864e5;
      const h = Math.floor(diff / 36e5); diff -= h * 36e5;
      const m = Math.floor(diff / 6e4); diff -= m * 6e4;
      set(els.d, d); set(els.h, h); set(els.m, m); set(els.s, Math.floor(diff / 1000));
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ====================================================
     Blood group compatibility checker
     ==================================================== */
  function initCompat() {
    const grid = $('#cgGrid');
    const result = $('#cgResult');
    const tabs = $('.tabs');
    let mode = 'donate';
    let group = null;

    grid.innerHTML = D.groups.map((g) => '<button type="button" class="group-btn" data-g="' + g + '" aria-pressed="false">' + g.replace('-', '−') + '</button>').join('');

    function fact(g) {
      if (mode === 'donate') {
        if (g === 'O-') return 'Universal donor: your red cells can be given to patients of any blood group in an emergency.';
        if (g === 'AB+') return 'Your red cells can go to AB+ patients, but your plasma can help anyone — consider a plasma donation too.';
        const n = D.donateTo[g].length;
        return g + ' red cells can help patients of ' + n + ' different blood group' + (n > 1 ? 's' : '') + '.';
      }
      if (g === 'AB+') return 'Universal recipient: you can safely receive red cells from every blood group.';
      if (g === 'O-') return 'You can only receive O− red cells, which is why O− donors are so precious.';
      const n = D.receiveFrom[g].length;
      return 'You can receive red cells from ' + n + ' different blood group' + (n > 1 ? 's' : '') + '.';
    }

    function render() {
      if (!group) return;
      const list = mode === 'donate' ? D.donateTo[group] : D.receiveFrom[group];
      const star = (mode === 'donate' && group === 'O-') ? 'Universal donor' : (mode === 'receive' && group === 'AB+') ? 'Universal recipient' : '';
      result.innerHTML =
        '<h4>' + (mode === 'donate' ? '<b>' + group + '</b> can donate to' : '<b>' + group + '</b> can receive from') + '</h4>' +
        '<div class="res-chips">' + list.map((g, i) => '<span class="res-chip" style="animation-delay:' + i * 70 + 'ms">' + g.replace('-', '−') + '</span>').join('') + '</div>' +
        (star ? '<span class="badge">⭐ ' + star + '</span>' : '') +
        '<p class="fact">' + fact(group) + '</p>';
    }

    grid.addEventListener('click', (e) => {
      const b = e.target.closest('.group-btn');
      if (!b) return;
      group = b.dataset.g;
      $$('.group-btn', grid).forEach((x) => { const on = x === b; x.classList.toggle('sel', on); x.setAttribute('aria-pressed', String(on)); });
      render();
    });
    tabs.addEventListener('click', (e) => {
      const t = e.target.closest('.tab');
      if (!t) return;
      mode = t.dataset.mode;
      $$('.tab', tabs).forEach((x) => { const on = x === t; x.classList.toggle('active', on); x.setAttribute('aria-selected', String(on)); });
      tabs.classList.toggle('right', mode === 'receive');
      render();
    });
  }

  /* ====================================================
     Eligibility quiz
     ==================================================== */
  function initQuiz() {
    const body = $('#qBody');
    const bar = $('#qBar');
    const count = $('#qCount');
    let i = 0;
    let fails = [];

    function show() {
      if (i >= D.quiz.length) return finish();
      const q = D.quiz[i];
      count.textContent = 'Question ' + (i + 1) + ' of ' + D.quiz.length;
      bar.style.width = (i / D.quiz.length) * 100 + '%';
      body.innerHTML =
        '<div class="q-anim"><h3>' + esc(q.q) + '</h3><p class="muted">' + esc(q.hint) + '</p>' +
        '<div class="q-actions"><button class="btn btn-primary" data-ans="yes">Yes</button><button class="btn btn-ghost" data-ans="no">No</button></div></div>';
    }
    function finish() {
      bar.style.width = '100%';
      count.textContent = 'Your result';
      if (!fails.length) {
        body.innerHTML =
          '<div class="q-anim"><span class="result-ico">🎉</span><h3>You look eligible to donate!</h3>' +
          '<p class="muted">Great news — based on your answers you meet the common guidelines. The medical officer will do a final check at the camp.</p>' +
          '<div class="q-actions"><a class="btn btn-primary" href="#camps">Find a camp</a><button class="btn btn-ghost" data-restart>Retake</button></div></div>';
        fx.confetti();
      } else {
        body.innerHTML =
          '<div class="q-anim"><span class="result-ico">⏳</span><h3>Not just yet</h3>' +
          '<p class="muted">Based on your answers, it may be best to wait:</p>' +
          '<ul class="fail-list">' + fails.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ul>' +
          '<p class="muted small">You can still help by spreading the word or volunteering at a camp.</p>' +
          '<div class="q-actions"><button class="btn btn-primary" data-restart>Retake quiz</button></div></div>';
      }
    }
    body.addEventListener('click', (e) => {
      const ans = e.target.closest('[data-ans]');
      if (ans) {
        const q = D.quiz[i];
        if ((ans.dataset.ans === 'yes') !== q.ok) fails.push(q.fail);
        i++;
        show();
      } else if (e.target.closest('[data-restart]')) {
        i = 0; fails = [];
        show();
      }
    });
    show();
  }

  /* ====================================================
     Camps
     ==================================================== */
  function initCamps() {
    const grid = $('#campGrid');
    const search = $('#campSearch');
    const city = $('#campCity');
    const need = $('#campNeed');
    const sort = $('#campSort');

    function card(c, i) {
      const booked = Math.min(c.seats, seatsBooked(c));
      const pct = Math.round((booked / c.seats) * 100);
      const left = c.seats - booked;
      const d = new Date(c.date);
      return '<article class="card camp" data-reveal data-delay="' + (i % 6) * 70 + '">' +
        (left <= 0 ? '<span class="full-tag">FULL</span>' : '') +
        '<div class="camp-top"><div class="date-badge"><small>' + d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase() + '</small><b>' + d.getDate() + '</b></div>' +
        '<div><h3>' + esc(c.name) + '</h3><div class="muted small">' + fmtDate(c.date) + '</div></div></div>' +
        '<div class="camp-meta"><span>📍 ' + esc(c.venue) + ', ' + esc(c.city) + '</span><span>🕘 ' + slotLabel(c.start) + ' – ' + slotLabel(c.end) + '</span></div>' +
        '<div><div class="seat-row"><span>Seats filled</span><b>' + booked + ' / ' + c.seats + ' (' + pct + '%)</b></div>' +
        '<div class="seat-bar"><i data-w="' + pct + '"></i></div></div>' +
        '<div class="needs"><span>Needed:</span>' + c.needs.map((g) => '<span class="g">' + g.replace('-', '−') + '</span>').join('') + '</div>' +
        '<div class="camp-actions"><button class="btn btn-primary btn-sm" data-book="' + c.id + '"' + (left <= 0 ? ' disabled' : '') + '>Book slot</button>' +
        '<button class="btn btn-ghost btn-sm" data-ics="' + c.id + '">📅 Add</button></div></article>';
    }

    function render() {
      const q = search.value.trim().toLowerCase();
      let list = D.camps.filter((c) =>
        (!city.value || c.city === city.value) &&
        (!need.value || c.needs.includes(need.value)) &&
        (!q || (c.name + ' ' + c.venue + ' ' + c.city).toLowerCase().includes(q)));
      list = list.slice().sort(sort.value === 'seats'
        ? (a, b) => (b.seats - seatsBooked(b)) - (a.seats - seatsBooked(a))
        : (a, b) => a.date - b.date);

      grid.innerHTML = list.length
        ? list.map(card).join('')
        : '<div class="empty"><div style="font-size:2.6rem">🔎</div><p>No camps match your filters. Try clearing the search.</p></div>';

      fx.observe(grid);
      void grid.offsetWidth; /* force reflow so the width transition runs from 0 */
      $$('.seat-bar i', grid).forEach((el) => { el.style.width = el.dataset.w + '%'; });
    }

    const debounced = (() => { let t; return () => { clearTimeout(t); t = setTimeout(render, 150); }; })();
    search.addEventListener('input', debounced);
    [city, need, sort].forEach((el) => el.addEventListener('change', render));

    grid.addEventListener('click', (e) => {
      const book = e.target.closest('[data-book]');
      const ics = e.target.closest('[data-ics]');
      if (book) {
        const camp = campById(book.dataset.book);
        const sel = $('#fCamp');
        sel.value = camp.id;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        resetRegistration();
        scrollToId('register');
        toast('Selected: ' + camp.name + '. Now choose a slot!', 'info');
      } else if (ics) {
        downloadICS(campById(ics.dataset.ics));
      }
    });

    window.addEventListener('lifedrop:donors-changed', render);
    render();
  }

  /* ====================================================
     Live blood stock + trend chart
     ==================================================== */
  function initStock() {
    const grid = $('#stockGrid');
    const timeEl = $('#stockTime');
    const stock = D.stock.map((s) => Object.assign({}, s));
    const cls = (u) => (u < 20 ? 'crit' : u < 45 ? 'low' : 'ok');
    const lbl = (u) => (u < 20 ? 'Critical' : u < 45 ? 'Low' : 'Good');

    grid.innerHTML = stock.map((s) =>
      '<div class="bag ' + cls(s.u) + '" data-g="' + s.g + '" data-reveal>' +
      '<div class="vessel"><div class="fill"></div></div>' +
      '<b class="g">' + s.g.replace('-', '−') + '</b><div class="u"><span class="uv">' + s.u + '</span> units</div>' +
      '<span class="status">' + lbl(s.u) + '</span></div>').join('');
    fx.observe(grid);

    function paint() {
      stock.forEach((s) => {
        const el = $('.bag[data-g="' + s.g + '"]', grid);
        el.className = 'bag ' + cls(s.u) + ' in';
        $('.fill', el).style.height = s.u + '%';
        $('.uv', el).textContent = s.u;
        $('.status', el).textContent = lbl(s.u);
      });
      timeEl.textContent = 'Last updated ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' · sample data';
    }

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => {
        if (es[0].isIntersecting) { paint(); io.disconnect(); }
      }, { threshold: 0.25 });
      io.observe(grid);
    } else { paint(); }

    setInterval(() => {
      if (document.hidden) return;
      stock.forEach((s) => { s.u = clamp(s.u + rand(-2, 3), 3, 98); });
      paint();
    }, 5000);

    initTrend();
  }

  function initTrend() {
    const cv = $('#trendCanvas');
    const ctx = cv.getContext('2d');
    const data = D.weekly;
    const labels = D.weekLabels;
    let prog = reduceMotion ? 1 : 0;
    let hover = -1;
    let dims = { w: 0, h: 0 };
    const pad2 = { l: 34, r: 16, t: 22, b: 30 };

    const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    function size() {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = r.width * dpr;
      cv.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dims = { w: r.width, h: r.height };
    }
    function draw() {
      const { w, h } = dims;
      ctx.clearRect(0, 0, w, h);
      const max = Math.ceil((Math.max.apply(null, data) * 1.15) / 20) * 20;
      const x = (i) => pad2.l + ((w - pad2.l - pad2.r) * i) / (data.length - 1);
      const y = (v) => pad2.t + (h - pad2.t - pad2.b) * (1 - v / max);

      ctx.font = '12px system-ui, sans-serif';
      ctx.lineWidth = 1;
      ctx.strokeStyle = css('--border');
      ctx.fillStyle = css('--muted');
      ctx.textAlign = 'left';
      for (let g = 0; g <= 4; g++) {
        const v = (max * g) / 4;
        ctx.beginPath(); ctx.moveTo(pad2.l, y(v)); ctx.lineTo(w - pad2.r, y(v)); ctx.stroke();
        ctx.fillText(Math.round(v), 2, y(v) + 4);
      }
      ctx.textAlign = 'center';
      labels.forEach((l, i) => ctx.fillText(l, x(i), h - 8));

      const curve = () => {
        ctx.beginPath();
        ctx.moveTo(x(0), y(data[0]));
        for (let i = 1; i < data.length; i++) {
          const cx = (x(i - 1) + x(i)) / 2;
          ctx.bezierCurveTo(cx, y(data[i - 1]), cx, y(data[i]), x(i), y(data[i]));
        }
      };

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, pad2.l + (w - pad2.l - pad2.r) * prog + 3, h);
      ctx.clip();

      curve();
      ctx.lineTo(x(data.length - 1), y(0));
      ctx.lineTo(x(0), y(0));
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, pad2.t, 0, h - pad2.b);
      grad.addColorStop(0, 'rgba(214,33,58,.35)');
      grad.addColorStop(1, 'rgba(214,33,58,0)');
      ctx.fillStyle = grad;
      ctx.fill();

      curve();
      ctx.strokeStyle = css('--red');
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.stroke();

      data.forEach((v, i) => {
        ctx.beginPath();
        ctx.arc(x(i), y(v), i === hover ? 7 : 4.5, 0, 6.2832);
        ctx.fillStyle = css('--surface');
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = css('--red');
        ctx.stroke();
      });
      ctx.restore();

      if (hover >= 0 && prog >= 1) {
        const txt = data[hover] + ' donations';
        ctx.font = '600 13px system-ui, sans-serif';
        const tw = ctx.measureText(txt).width + 20;
        let bx = x(hover) - tw / 2;
        bx = clamp(bx, 4, w - tw - 4);
        const by = Math.max(2, y(data[hover]) - 42);
        ctx.fillStyle = css('--text');
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, tw, 26, 8); else ctx.rect(bx, by, tw, 26);
        ctx.fill();
        ctx.fillStyle = css('--bg');
        ctx.textAlign = 'center';
        ctx.fillText(txt, bx + tw / 2, by + 17);
      }
    }
    function animateIn() {
      const t0 = performance.now();
      (function step(now) {
        const p = Math.min(1, (now - t0) / 1400);
        prog = 1 - Math.pow(1 - p, 3);
        draw();
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }
    function pointer(clientX) {
      const r = cv.getBoundingClientRect();
      const rel = (clientX - r.left - pad2.l) / (r.width - pad2.l - pad2.r);
      const idx = clamp(Math.round(rel * (data.length - 1)), 0, data.length - 1);
      if (idx !== hover) { hover = idx; draw(); }
    }
    cv.addEventListener('mousemove', (e) => pointer(e.clientX));
    cv.addEventListener('touchstart', (e) => pointer(e.touches[0].clientX), { passive: true });
    cv.addEventListener('touchmove', (e) => pointer(e.touches[0].clientX), { passive: true });
    cv.addEventListener('mouseleave', () => { hover = -1; draw(); });
    window.addEventListener('resize', () => { size(); draw(); });
    window.addEventListener('themechange', draw);

    size();
    draw();
    if (!reduceMotion && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => {
        if (es[0].isIntersecting) { animateIn(); io.disconnect(); }
      }, { threshold: 0.3 });
      io.observe(cv);
    } else { prog = 1; draw(); }
  }

  /* ====================================================
     Emergency requests
     ==================================================== */
  function initRequests() {
    const list = $('#reqList');
    const filter = $('#reqFilter');
    const form = $('#reqForm');
    const err = $('#rqErr');

    function seed() {
      const now = Date.now();
      return [
        { id: 'r1', name: 'Anita R.', g: 'O-', units: 3, hospital: 'City General Hospital', city: 'Bengaluru', urgency: 'Critical', ts: now - 18 * 6e4, helpers: 4 },
        { id: 'r2', name: 'Baby of Sahana', g: 'B+', units: 1, hospital: 'Rainbow Children’s Hospital', city: 'Hyderabad', urgency: 'Urgent', ts: now - 2.1 * 36e5, helpers: 9 },
        { id: 'r3', name: 'Mohan Das', g: 'A-', units: 2, hospital: 'Apollo Speciality', city: 'Chennai', urgency: 'Urgent', ts: now - 5 * 36e5, helpers: 2 },
        { id: 'r4', name: 'Kavita P.', g: 'AB+', units: 2, hospital: 'Sunrise Hospital', city: 'Pune', urgency: 'Planned', ts: now - 26 * 36e5, helpers: 6 }
      ];
    }
    let reqs = store.get(KEYS.reqs, null);
    if (!reqs) { reqs = seed(); store.set(KEYS.reqs, reqs); }

    function render() {
      const g = filter.value;
      const rows = reqs.filter((r) => !g || r.g === g);
      list.innerHTML = rows.length ? rows.map((r) =>
        '<article class="req ' + esc(r.urgency) + '"><div class="req-g">' + esc(r.g).replace('-', '−') + '</div>' +
        '<div><h4>' + esc(r.name) + ' <span class="tag">' + esc(r.urgency) + '</span></h4>' +
        '<p>' + esc(r.units) + ' unit' + (r.units > 1 ? 's' : '') + ' · ' + esc(r.hospital) + ', ' + esc(r.city) + '</p>' +
        '<p class="helpers">🙋 ' + r.helpers + ' donor' + (r.helpers === 1 ? '' : 's') + ' responding · ' + ago(r.ts) + '</p></div>' +
        '<button class="btn btn-ghost btn-sm" data-help="' + esc(r.id) + '">I can help</button></article>').join('')
        : '<div class="empty"><p>No open requests for this blood group right now. 🎉</p></div>';
    }

    filter.addEventListener('change', render);
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-help]');
      if (!b) return;
      const helped = store.get(KEYS.helped, []);
      if (helped.includes(b.dataset.help)) { toast('You have already offered to help with this request.', 'info'); return; }
      const r = reqs.find((x) => x.id === b.dataset.help);
      if (!r) return;
      r.helpers++;
      helped.push(r.id);
      store.set(KEYS.helped, helped);
      store.set(KEYS.reqs, reqs);
      render();
      toast('Thank you! The hospital would be notified (demo).', 'success');
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#rqName').value.trim();
      const g = $('#rqGroup').value;
      const units = Number($('#rqUnits').value);
      const hospital = $('#rqHospital').value.trim();
      const cityV = $('#rqCity').value.trim();
      err.textContent = '';
      if (name.length < 2 || !g || !hospital || !cityV || !(units >= 1 && units <= 10)) {
        err.textContent = 'Please fill in every field (units: 1–10).';
        form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
        return;
      }
      reqs.unshift({ id: 'r' + Date.now(), name, g, units, hospital, city: cityV, urgency: $('#rqUrgency').value, ts: Date.now(), helpers: 0 });
      reqs = reqs.slice(0, 30);
      store.set(KEYS.reqs, reqs);
      form.reset();
      $('#rqUnits').value = 2;
      $('#rqUrgency').value = 'Urgent';
      filter.value = '';
      render();
      toast('Request posted. Donors nearby will see it.', 'success');
    });

    render();
    setInterval(render, 60000); /* refresh "x min ago" labels */
  }

  /* ====================================================
     Registration form + donor card
     ==================================================== */
  let lastDonor = null;

  function slotsFor(c) {
    const out = [];
    const sh = Number(c.start.split(':')[0]);
    const eh = Number(c.end.split(':')[0]);
    for (let t = sh; t < eh; t++) out.push(pad(t) + ':00');
    return out;
  }
  function slotLeft(c, s) {
    const used = (hash(c.id + s) % 6) + getDonors().filter((d) => d.campId === c.id && d.slot === s).length;
    return Math.max(0, SLOT_CAPACITY - used);
  }

  function renderSlots() {
    const box = $('#slotGrid');
    const c = campById($('#fCamp').value);
    if (!c) { box.innerHTML = '<p class="muted small">Select a camp to see time slots.</p>'; return; }
    box.innerHTML = slotsFor(c).map((s, i) => {
      const left = slotLeft(c, s);
      return '<input type="radio" name="slot" id="slot_' + i + '" value="' + s + '"' + (left ? '' : ' disabled') + '>' +
        '<label for="slot_' + i + '">' + slotLabel(s) + '<small>' + (left ? left + ' spot' + (left > 1 ? 's' : '') + ' left' : 'Full') + '</small></label>';
    }).join('');
  }

  function resetRegistration() {
    $('#donorResult').hidden = true;
    $('#regWrap').hidden = false;
  }

  /* --- donor card (canvas) --- */
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function dropPath(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y);
    c.bezierCurveTo(x + s * 0.15, y + s * 0.35, x + s * 0.6, y + s * 0.7, x + s * 0.6, y + s * 1.05);
    c.arc(x, y + s * 1.05, s * 0.6, 0, Math.PI, false);
    c.bezierCurveTo(x - s * 0.6, y + s * 0.7, x - s * 0.15, y + s * 0.35, x, y);
    c.closePath();
  }
  function fit(c, text, maxW) {
    if (c.measureText(text).width <= maxW) return text;
    while (text.length > 1 && c.measureText(text + '…').width > maxW) text = text.slice(0, -1);
    return text + '…';
  }
  function prng(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function drawCard(cv, d) {
    const W = 760, H = 440;
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const camp = campById(d.campId);
    const sans = '"Segoe UI", system-ui, sans-serif';

    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#a30f27'); g.addColorStop(0.6, '#d6213a'); g.addColorStop(1, '#ff5d70');
    roundRect(c, 0, 0, W, H, 30); c.fillStyle = g; c.fill();

    c.save();
    roundRect(c, 0, 0, W, H, 30); c.clip();
    c.fillStyle = 'rgba(255,255,255,.09)';
    [[W - 30, 20, 190], [70, H + 30, 170], [W / 2, -70, 120]].forEach((p) => { c.beginPath(); c.arc(p[0], p[1], p[2], 0, 6.2832); c.fill(); });
    c.restore();

    /* brand */
    c.fillStyle = '#fff';
    dropPath(c, 54, 30, 30); c.fill();
    c.font = '700 28px Georgia, serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText('LifeDrop', 84, 62);
    c.font = '600 12px ' + sans; c.globalAlpha = 0.85;
    c.fillText('VOLUNTEER BLOOD DONOR', 86, 82); c.globalAlpha = 1;

    /* blood group badge */
    c.beginPath(); c.arc(W - 120, 112, 66, 0, 6.2832); c.fillStyle = '#fff'; c.fill();
    c.fillStyle = '#d6213a'; c.font = '700 54px Georgia, serif'; c.textAlign = 'center';
    c.fillText(d.group.replace('-', '−'), W - 120, 132);
    c.fillStyle = '#fff'; c.font = '700 11px ' + sans; c.fillText('BLOOD GROUP', W - 120, 205);

    /* name */
    c.textAlign = 'left'; c.fillStyle = '#fff';
    c.font = '700 40px Georgia, serif';
    c.fillText(fit(c, d.name, W - 90), 44, 252);

    /* details */
    const label = (t, x, y) => { c.font = '700 11px ' + sans; c.globalAlpha = 0.75; c.fillStyle = '#fff'; c.fillText(t, x, y); c.globalAlpha = 1; };
    label('DONOR ID', 44, 296);
    c.font = '700 22px "Consolas", "Courier New", monospace'; c.fillText(d.id, 44, 322);
    label('DATE & SLOT', 270, 296);
    c.font = '700 20px ' + sans; c.fillText(fit(c, fmtDate(camp.date) + ' · ' + slotLabel(d.slot), 270), 270, 322);
    label('CAMP', 44, 366);
    c.font = '700 20px ' + sans; c.fillText(fit(c, camp.name, 500), 44, 392);
    c.font = '400 14px ' + sans; c.globalAlpha = 0.85;
    c.fillText(fit(c, camp.venue + ', ' + camp.city, 500), 44, 414); c.globalAlpha = 1;

    /* decorative pseudo-QR seeded from the donor ID (not scannable) */
    const qx = W - 180, qy = 262, N = 21, m = 6;
    roundRect(c, qx, qy, 142, 142, 14); c.fillStyle = '#fff'; c.fill();
    const rnd = prng(hash(d.id));
    c.fillStyle = '#2b1416';
    for (let r = 0; r < N; r++) {
      for (let k = 0; k < N; k++) {
        let on;
        const tl = r < 7 && k < 7, tr = r < 7 && k >= N - 7, bl = r >= N - 7 && k < 7;
        if (tl || tr || bl) {
          const rr = r < 7 ? r : r - (N - 7);
          const kk = k < 7 ? k : k - (N - 7);
          on = rr === 0 || rr === 6 || kk === 0 || kk === 6 || (rr >= 2 && rr <= 4 && kk >= 2 && kk <= 4);
        } else { on = rnd() > 0.52; }
        if (on) c.fillRect(qx + 8 + k * m, qy + 8 + r * m, m - 0.4, m - 0.4);
      }
    }
  }

  function initRegister() {
    const form = $('#regForm');
    const campSel = $('#fCamp');
    $('#fLast').max = localISO(new Date());

    const RULES = {
      fName: (v) => (/^\p{L}[\p{L} .'-]{2,}$/u.test(v.trim()) ? '' : 'Please enter your full name (letters only).'),
      fAge: (v) => (v !== '' && Number(v) >= 18 && Number(v) <= 65 ? '' : 'Donors must be between 18 and 65 years old.'),
      fWeight: (v) => (Number(v) >= 50 ? '' : 'Minimum weight to donate is 50 kg.'),
      fPhone: (v) => (/^\d{10}$/.test(v.replace(/[\s-]/g, '')) ? '' : 'Enter a valid 10-digit phone number.'),
      fEmail: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email address.'),
      fCamp: (v) => (v ? '' : 'Please choose a camp.'),
      fLast: (v) => {
        if (!v) return '';
        const d = new Date(v + 'T00:00:00');
        const days = (Date.now() - d.getTime()) / 864e5;
        if (days < 0) return 'The date cannot be in the future.';
        return days < 90 ? 'Please wait ' + Math.ceil(90 - days) + ' more day(s) before donating again.' : '';
      }
    };

    function setError(key, msg) {
      const el = $('.err[data-for="' + key + '"]', form);
      if (el) el.textContent = msg;
      const field = el && el.closest('.field');
      if (field) field.classList.toggle('invalid', !!msg);
    }
    function checkField(id) {
      const msg = RULES[id]($('#' + id).value);
      setError(id, msg);
      return !msg;
    }
    Object.keys(RULES).forEach((id) => {
      const el = $('#' + id);
      el.addEventListener('blur', () => { if (el.value !== '' || el.dataset.touched) checkField(id); el.dataset.touched = '1'; });
      el.addEventListener('input', () => { if (el.closest('.field').classList.contains('invalid')) checkField(id); });
    });
    form.addEventListener('change', (e) => {
      if (e.target.name === 'group') setError('group', '');
      if (e.target.name === 'slot') setError('slot', '');
      if (e.target.id === 'fConsent') setError('fConsent', '');
    });
    campSel.addEventListener('change', () => { renderSlots(); setError('fCamp', ''); setError('slot', ''); });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let ok = true;
      Object.keys(RULES).forEach((id) => { if (!checkField(id)) ok = false; });
      const group = (form.querySelector('input[name="group"]:checked') || {}).value;
      const slot = (form.querySelector('input[name="slot"]:checked') || {}).value;
      if (!group) { setError('group', 'Please select your blood group.'); ok = false; }
      if (!slot) { setError('slot', 'Please pick a time slot.'); ok = false; }
      if (!$('#fConsent').checked) { setError('fConsent', 'Consent is required to continue.'); ok = false; }

      if (ok) {
        const phone = $('#fPhone').value.replace(/[\s-]/g, '');
        const duplicate = getDonors().some((d) => d.campId === campSel.value && d.phone === phone);
        if (duplicate) { setError('fPhone', 'This number is already registered for this camp.'); ok = false; }
      }
      if (!ok) {
        form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
        const bad = form.querySelector('.field.invalid, .err:not(:empty)');
        if (bad) {
          const holder = bad.closest('.field') || bad;
          holder.scrollIntoView({ behavior: smooth, block: 'center' });
          const inp = holder.querySelector('input:not([type="radio"]):not([type="checkbox"]), select');
          if (inp) inp.focus({ preventScroll: true });
        }
        toast('Please fix the highlighted fields.', 'error');
        return;
      }

      const donor = {
        id: 'LD-' + Date.now().toString(36).slice(-5).toUpperCase() + rand(10, 99),
        name: $('#fName').value.trim().replace(/\s+/g, ' '),
        age: Number($('#fAge').value),
        gender: $('#fGender').value,
        weight: Number($('#fWeight').value),
        phone: $('#fPhone').value.replace(/[\s-]/g, ''),
        email: $('#fEmail').value.trim(),
        group, campId: campSel.value, slot,
        last: $('#fLast').value, ts: Date.now()
      };
      const list = getDonors();
      list.push(donor);
      saveDonors(list);
      lastDonor = donor;

      const camp = campById(donor.campId);
      $('#resultMsg').textContent = 'See you at ' + camp.name + ' on ' + fmtDate(camp.date) + ' at ' + slotLabel(donor.slot) + '. A confirmation would be emailed to ' + donor.email + ' (demo).';
      $('#regWrap').hidden = true;
      $('#donorResult').hidden = false;
      drawCard($('#cardCanvas'), donor);
      scrollToId('register');
      fx.confetti();
      toast('Booking confirmed — thank you, ' + donor.name.split(' ')[0] + '!', 'success', 4200);
      refreshStats(true);
      window.dispatchEvent(new Event('lifedrop:donors-changed'));
      form.reset();
      renderSlots();
    });

    $('#dlCard').addEventListener('click', () => {
      if (!lastDonor) return;
      $('#cardCanvas').toBlob((blob) => { if (blob) download(blob, lastDonor.id + '-donor-card.png'); }, 'image/png');
    });
    $('#calCard').addEventListener('click', () => { if (lastDonor) downloadICS(campById(lastDonor.campId), lastDonor.slot); });
    $('#regAnother').addEventListener('click', () => { resetRegistration(); scrollToId('register'); });
  }

  /* ====================================================
     Myths, stories slider, FAQ
     ==================================================== */
  function initMyths() {
    const grid = $('#mythGrid');
    grid.innerHTML = D.myths.map((m, i) =>
      '<div class="flip" role="button" tabindex="0" aria-pressed="false" data-reveal data-delay="' + (i % 3) * 100 + '">' +
      '<div class="flip-in"><div class="face front"><span class="tagline">Myth</span><p>' + esc(m.m) + '</p><span class="hint">Tap to reveal the fact ↻</span></div>' +
      '<div class="face back"><span class="tagline">Fact</span><p>' + esc(m.f) + '</p></div></div></div>').join('');
    const toggle = (el) => { const on = el.classList.toggle('on'); el.setAttribute('aria-pressed', String(on)); };
    grid.addEventListener('click', (e) => { const f = e.target.closest('.flip'); if (f) toggle(f); });
    grid.addEventListener('keydown', (e) => {
      const f = e.target.closest('.flip');
      if (f && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(f); }
    });
  }

  function initSlider() {
    const track = $('#sliderTrack');
    const dots = $('#sliderDots');
    const root = $('#slider');
    let i = 0, timer = null, startX = null;

    track.innerHTML = D.stories.map((s) =>
      '<div class="slide"><figure class="card quote" style="margin:6px"><p>' + esc(s.t) + '</p>' +
      '<div class="who"><span class="avatar">' + esc(s.n[0]) + '</span><span><b>' + esc(s.n) + '</b><small>' + esc(s.r) + '</small></span></div></figure></div>').join('');
    dots.innerHTML = D.stories.map((_, k) => '<button class="dot" data-i="' + k + '" aria-label="Go to story ' + (k + 1) + '"></button>').join('');

    function go(n) {
      i = (n + D.stories.length) % D.stories.length;
      track.style.transform = 'translateX(' + -i * 100 + '%)';
      $$('.dot', dots).forEach((d, k) => d.classList.toggle('on', k === i));
    }
    function play() { stop(); if (!reduceMotion) timer = setInterval(() => go(i + 1), 6500); }
    function stop() { clearInterval(timer); }

    $('#prevBtn').addEventListener('click', () => { go(i - 1); play(); });
    $('#nextBtn').addEventListener('click', () => { go(i + 1); play(); });
    dots.addEventListener('click', (e) => { const d = e.target.closest('.dot'); if (d) { go(Number(d.dataset.i)); play(); } });
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', play);
    track.addEventListener('pointerdown', (e) => { startX = e.clientX; });
    track.addEventListener('pointerup', (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 50) { go(i + (dx < 0 ? 1 : -1)); play(); }
    });
    go(0);
    play();
  }

  function initFaq() {
    const box = $('#faqList');
    box.innerHTML = D.faqs.map((f, i) =>
      '<div class="faq-item"><button class="faq-q" aria-expanded="false" aria-controls="fa' + i + '" id="fq' + i + '">' + esc(f.q) + '<span class="plus" aria-hidden="true">+</span></button>' +
      '<div class="faq-a" id="fa' + i + '" role="region" aria-labelledby="fq' + i + '"><div><p>' + esc(f.a) + '</p></div></div></div>').join('');
    box.addEventListener('click', (e) => {
      const q = e.target.closest('.faq-q');
      if (!q) return;
      const item = q.parentElement;
      const open = !item.classList.contains('open');
      $$('.faq-item', box).forEach((x) => { x.classList.remove('open'); $('.faq-q', x).setAttribute('aria-expanded', 'false'); });
      if (open) { item.classList.add('open'); q.setAttribute('aria-expanded', 'true'); }
    });
  }

  /* ====================================================
     Organizer panel (modal)
     ==================================================== */
  function initAdmin() {
    const modal = $('#adminModal');
    const gate = $('#adminGate');
    const panel = $('#adminPanel');
    const pin = $('#adminPin');
    const err = $('#adminErr');
    const openBtn = $('#adminBtn');
    const tbody = $('#adminTable');
    const search = $('#adminSearch');
    let unlocked = false;
    try { unlocked = sessionStorage.getItem(KEYS.admin) === '1'; } catch (e) { /* ignore */ }

    function show() {
      gate.hidden = unlocked;
      panel.hidden = !unlocked;
      if (unlocked) renderPanel(); else { pin.value = ''; err.textContent = ''; }
    }
    function open() {
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      show();
      setTimeout(() => (unlocked ? $('#adminClose') : pin).focus(), 50);
    }
    function close() {
      modal.hidden = true;
      document.body.style.overflow = '';
      openBtn.focus();
    }

    function renderPanel() {
      const donors = getDonors();
      const q = search.value.trim().toLowerCase();
      const upcoming = D.camps.filter((c) => c.date >= new Date(new Date().setHours(0, 0, 0, 0))).length;
      $('#adminStats').innerHTML =
        '<div class="a-stat"><b>' + donors.length + '</b><span>Registrations (this browser)</span></div>' +
        '<div class="a-stat"><b>' + upcoming + '</b><span>Upcoming camps</span></div>' +
        '<div class="a-stat"><b>' + new Set(donors.map((d) => d.group)).size + ' / 8</b><span>Blood groups covered</span></div>';

      const counts = {};
      D.groups.forEach((g) => (counts[g] = 0));
      donors.forEach((d) => { counts[d.group] = (counts[d.group] || 0) + 1; });
      const max = Math.max(1, ...Object.values(counts));
      $('#adminGroups').innerHTML = D.groups.map((g) =>
        '<div class="ag-row"><b>' + g.replace('-', '−') + '</b><div class="ag-bar"><i data-w="' + (counts[g] / max) * 100 + '"></i></div><span>' + counts[g] + '</span></div>').join('');
      void $('#adminGroups').offsetWidth;
      $$('#adminGroups .ag-bar i').forEach((el) => { el.style.width = el.dataset.w + '%'; });

      const rows = donors.slice().reverse().filter((d) => !q || (d.name + d.id + d.group + d.phone).toLowerCase().includes(q));
      tbody.innerHTML = rows.length ? rows.map((d) => {
        const c = campById(d.campId);
        return '<tr><td>' + esc(d.id) + '</td><td>' + esc(d.name) + '</td><td class="gb">' + esc(d.group).replace('-', '−') + '</td><td>' + esc(c ? c.name : '—') + '</td><td>' + esc(slotLabel(d.slot)) + '</td><td>' + esc(d.phone) + '</td>' +
          '<td><button class="del" data-del="' + esc(d.id) + '" aria-label="Delete ' + esc(d.name) + '">🗑</button></td></tr>';
      }).join('') : '<tr class="empty-row"><td colspan="7">No registrations yet. Register a donor or add sample data.</td></tr>';
    }

    function changed() {
      renderPanel();
      refreshStats(true);
      window.dispatchEvent(new Event('lifedrop:donors-changed'));
    }

    openBtn.addEventListener('click', open);
    $('#adminClose').addEventListener('click', close);
    modal.addEventListener('mousedown', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', (e) => {
      if (modal.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') { /* simple focus trap */
        const f = $$('button:not([disabled]), input, [href]', modal).filter((el) => el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    function unlock() {
      if (pin.value === ADMIN_PIN) {
        unlocked = true;
        try { sessionStorage.setItem(KEYS.admin, '1'); } catch (e) { /* ignore */ }
        show();
        toast('Organizer panel unlocked', 'success');
      } else {
        err.textContent = 'Incorrect PIN. Try again.';
        pin.value = '';
        pin.classList.remove('shake'); void pin.offsetWidth; pin.classList.add('shake');
      }
    }
    $('#adminPinBtn').addEventListener('click', unlock);
    pin.addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock(); });
    search.addEventListener('input', renderPanel);

    tbody.addEventListener('click', (e) => {
      const b = e.target.closest('[data-del]');
      if (!b || !window.confirm('Delete this registration?')) return;
      saveDonors(getDonors().filter((d) => d.id !== b.dataset.del));
      changed();
      toast('Registration deleted', 'info');
    });

    $('#adminSample').addEventListener('click', () => {
      const names = ['Aarav Mehta', 'Diya Nair', 'Kabir Singh', 'Ishita Rao', 'Vivaan Iyer', 'Anaya Gupta', 'Arjun Das', 'Sara Khan', 'Rohit Verma', 'Meera Joshi', 'Neel Patel', 'Tara Reddy'];
      const list = getDonors();
      names.forEach((name, k) => {
        const camp = D.camps[rand(0, D.camps.length - 1)];
        const slots = slotsFor(camp);
        list.push({
          id: 'LD-S' + Date.now().toString(36).slice(-3).toUpperCase() + pad(k) + rand(1, 9),
          name, age: rand(19, 55), gender: '', weight: rand(52, 88),
          phone: '9' + String(rand(100000000, 999999999)), email: name.split(' ')[0].toLowerCase() + '@example.com',
          group: D.groups[rand(0, 7)], campId: camp.id, slot: slots[rand(0, slots.length - 1)], last: '', ts: Date.now() - rand(0, 5) * 864e5
        });
      });
      saveDonors(list);
      changed();
      toast('Added ' + names.length + ' sample registrations', 'success');
    });

    $('#adminExport').addEventListener('click', () => {
      const donors = getDonors();
      if (!donors.length) { toast('Nothing to export yet.', 'info'); return; }
      /* prefix risky leading characters so spreadsheets do not run them as formulas */
      const cell = (v) => {
        let s = String(v == null ? '' : v);
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return '"' + s.replace(/"/g, '""') + '"';
      };
      const head = ['ID', 'Name', 'Age', 'Gender', 'Weight', 'Blood group', 'Phone', 'Email', 'Camp', 'City', 'Camp date', 'Slot', 'Registered at'];
      const lines = donors.map((d) => {
        const c = campById(d.campId) || {};
        return [d.id, d.name, d.age, d.gender, d.weight, d.group, d.phone, d.email, c.name, c.city, c.date ? localISO(c.date) : '', slotLabel(d.slot), new Date(d.ts).toISOString()].map(cell).join(',');
      });
      download('﻿' + [head.map(cell).join(',')].concat(lines).join('\r\n'), 'lifedrop-donors.csv', 'text/csv;charset=utf-8');
      toast('CSV exported', 'success');
    });

    $('#adminClear').addEventListener('click', () => {
      if (!getDonors().length) return;
      if (!window.confirm('Delete ALL registrations stored in this browser?')) return;
      saveDonors([]);
      changed();
      toast('All registrations cleared', 'info');
    });
  }

  /* ====================================================
     Boot
     ==================================================== */
  function fillSelects() {
    const opts = D.groups.map((g) => '<option value="' + g + '">' + g.replace('-', '−') + '</option>').join('');
    $('#campNeed').insertAdjacentHTML('beforeend', opts);
    $('#rqGroup').insertAdjacentHTML('beforeend', opts);
    $('#reqFilter').insertAdjacentHTML('beforeend', opts);
    const cities = Array.from(new Set(D.camps.map((c) => c.city))).sort();
    $('#campCity').insertAdjacentHTML('beforeend', cities.map((c) => '<option>' + esc(c) + '</option>').join(''));
    $('#fCamp').insertAdjacentHTML('beforeend', D.camps.slice().sort((a, b) => a.date - b.date)
      .map((c) => '<option value="' + c.id + '">' + esc(c.name) + ' — ' + esc(c.city) + ' (' + fmtDate(c.date) + ')</option>').join(''));
    $('#groupChips').innerHTML = D.groups.map((g, i) =>
      '<input type="radio" name="group" id="grp_' + i + '" value="' + g + '"><label for="grp_' + i + '">' + g.replace('-', '−') + '</label>').join('');
  }

  function boot() {
    $('#year').textContent = new Date().getFullYear();
    fillSelects();
    refreshStats(false);
    initTheme();
    initNav();
    initCountdown();
    initCompat();
    initQuiz();
    initCamps();
    initStock();
    initRequests();
    initRegister();
    initMyths();
    initSlider();
    initFaq();
    initAdmin();
    fx.init(); /* last: observes every [data-reveal] element, including the ones rendered above */
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
