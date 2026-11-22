// Fuel-Up: type the answer on the keypad to pump fuel before the comet arrives.
// Ten right-or-wrong answers fill the tank, then the rocket lifts off to the next stage.
import * as L from './logic.js';
import { sfx } from './audio.js';
import { drawFlames, flameLevel } from './fx.js';
import { renderScale, createMonitor } from './perf.js';

const C = { amber: '#ffb84d', teal: '#4fd6c4', coral: '#ff7a6b', ink: '#eef0fb', panel: '#1e2648', line: '#34407a', deep: '#0c1024' };
const FONT = '"Chakra Petch","Trebuchet MS",sans-serif';
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'skip'];

/**
 * opts: { mission, session, kidSpeed, shipColor, keypad (element), onHud(state), onFact(text, mood), onSave(), onEnd(result) }
 * Returns { pause(), resume(), stop(), debug() }.
 */
export function createFuelGame(canvas, opts) {
  const ctx = canvas.getContext('2d');
  const { mission, session, keypad } = opts;
  const g = session.g;
  let W = 0, H = 0, dead = false, completed = false;
  let state = 'banner', timer = 1.6, banner = 'Stage 1';
  let clock = 0, p = 0, dur = 9, cur = null, typed = '', marks = [];
  let particles = [], popups = [], laser = null, shake = 0, lift = 0;
  let paused = false, stopped = false, raf = 0, last = 0;
  const monitor = createMonitor(() => resize());
  const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7 }));

  keypad.innerHTML = KEYS.map(k => `<button type="button" class="key${k.length > 1 ? ' fn' : ''}" data-k="${k}" aria-label="${k === 'back' ? 'Delete' : k === 'skip' ? 'Show me the answer' : k}">${k === 'back' ? '⌫' : k === 'skip' ? '?' : k}</button>`).join('');

  // geometry
  const ground = () => Math.max(26, H * 0.09);
  const rocketH = () => Math.min(H * 0.5, 230);
  const rocketX = () => W * 0.36;
  const rocketTop = () => H - ground() - rocketH() - lift;
  const cometAt = t => {
    const sx = W * 0.97, sy = H * 0.04, ex = rocketX(), ey = H - ground() - rocketH() * 0.8;
    return { x: sx + (ex - sx) * t, y: sy + (ey - sy) * t - Math.sin(t * Math.PI) * H * 0.06 };
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = renderScale();
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const hud = () => opts.onHud({ ...g, mult: L.multFor(g.streak) });
  const showFact = () => opts.onFact(`${cur.text} = ${typed || '?'}`, '');

  function burst(x, y, color, n = 22) {
    if (reduceMotion) n = 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 260;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, t: 0, color, size: 2 + Math.random() * 4 });
    }
  }

  function next() {
    const step = session.advance();
    if (step.type === 'done') return finish(true);
    if (step.type === 'wave') {
      state = 'launch'; timer = 2.4; banner = `Stage ${g.wave}`;
      sfx.wave(); sfx.boom(); opts.onFact('Lift-off! Shield restored!', 'good'); hud();
      return;
    }
    cur = { fact: step.fact, ans: L.answerOf(step.fact), text: L.factText(step.fact), start: clock, bonus: step.bonus };
    typed = ''; p = 0; dur = L.fallSeconds(mission.speed, opts.kidSpeed, g.wave);
    state = 'ask';
    showFact(); hud();
  }

  function right() {
    const pts = session.correct(cur.fact, (clock - cur.start) * 1000, 1 - p);
    for (let i = 0; i < g.credit; i++) marks.push(true);
    const c = cometAt(p);
    laser = { x: c.x, y: c.y, t: 0 };
    burst(c.x, c.y, C.amber); burst(c.x, c.y, C.coral, 10);
    popups.push({ x: Math.min(c.x, W - 110), y: c.y, text: g.credit === 2 ? `DOUBLE! +${pts}` : `+${pts}`, t: 0 });
    sfx.laser(); sfx.boom();
    state = 'hit'; timer = 0.6;
    opts.onFact(`${cur.text} = ${cur.ans}`, 'good');
    hud(); opts.onSave();
  }

  function wrong(hitRocket) {
    dead = session.miss(cur.fact);
    marks.push(false);
    shake = reduceMotion ? 0 : 0.45;
    if (hitRocket) burst(rocketX(), rocketTop() + rocketH() * 0.2, C.coral, 26);
    sfx.wrong();
    state = 'reveal'; timer = 2.1;
    opts.onFact(`${cur.text} = ${cur.ans}`, 'bad');
    hud(); opts.onSave();
  }

  function press(k) {
    if (paused || state !== 'ask') return;
    if (k === 'skip') return wrong(false);
    if (k === 'back') typed = typed.slice(0, -1);
    else {
      if (typed === '0') typed = '';
      typed += k;
      sfx.click();
      if (Number(typed) === cur.ans) return right();
      if (typed.length >= String(cur.ans).length) { showFact(); return wrong(false); }
    }
    showFact();
  }

  function finish(done) {
    completed = done;
    state = 'over'; timer = done ? 2.2 : 1.4;
    banner = done ? 'Mission complete!' : 'Game over';
    if (done) { sfx.win(); sfx.boom(); } else { sfx.over(); burst(rocketX(), rocketTop() + rocketH() / 2, C.coral, 50); }
    hud();
  }

  function update(dt) {
    clock += dt;
    for (const s of stars) { s.y += dt * 0.03 * s.z; if (s.y > 1) { s.y = 0; s.x = Math.random(); } }
    particles = particles.filter(q => (q.t += dt) < q.life);
    for (const q of particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 200 * dt; }
    popups = popups.filter(q => (q.t += dt) < 0.9);
    if (laser && (laser.t += dt) > 0.16) laser = null;
    shake = Math.max(0, shake - dt);
    const flying = state === 'launch' || (state === 'over' && completed);
    if (flying) {
      lift += (lift + 40) * dt * 2.6; // accelerates away
      if (Math.random() < 0.6) particles.push({ x: rocketX() + (Math.random() - 0.5) * 16, y: rocketTop() + rocketH(), vx: (Math.random() - 0.5) * 60, vy: 160, life: 0.5, t: 0, color: Math.random() < 0.5 ? C.amber : C.coral, size: 5 });
    }
    if (state === 'ask') {
      p += dt / dur;
      if (p >= 1) wrong(true);
      return;
    }
    timer -= dt;
    if (timer > 0) return;
    if (state === 'banner' || state === 'hit') next();
    else if (state === 'reveal') { if (dead) finish(false); else next(); }
    else if (state === 'launch') { lift = 0; marks = []; state = 'banner'; timer = 1.2; }
    else if (state === 'over') { stopped = true; opts.onEnd(session.result(completed)); }
  }

  function drawRocket() {
    if (state === 'over' && !completed) return;
    const h = rocketH(), w = h * 0.3, x = rocketX(), top = rocketTop();
    if (top + h < -20) return;
    ctx.save();
    ctx.translate(x, top);
    ctx.fillStyle = opts.shipColor || C.amber; // fins
    ctx.beginPath(); ctx.moveTo(-w / 2, h * 0.7); ctx.lineTo(-w, h); ctx.lineTo(-w / 2, h * 0.94); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w / 2, h * 0.7); ctx.lineTo(w, h); ctx.lineTo(w / 2, h * 0.94); ctx.fill();
    ctx.fillStyle = C.ink; // body
    ctx.beginPath();
    ctx.moveTo(-w / 2, h * 0.96); ctx.lineTo(-w / 2, h * 0.28);
    ctx.quadraticCurveTo(-w / 2, h * 0.08, 0, 0);
    ctx.quadraticCurveTo(w / 2, h * 0.08, w / 2, h * 0.28);
    ctx.lineTo(w / 2, h * 0.96); ctx.closePath(); ctx.fill();
    ctx.fillStyle = opts.shipColor || C.amber; // nose
    ctx.beginPath(); ctx.moveTo(-w * 0.42, h * 0.17); ctx.quadraticCurveTo(-w * 0.2, h * 0.04, 0, 0);
    ctx.quadraticCurveTo(w * 0.2, h * 0.04, w * 0.42, h * 0.17); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.deep; ctx.beginPath(); ctx.arc(0, h * 0.36, w * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.teal; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = C.line; ctx.fillRect(-w * 0.3, h * 0.96, w * 0.6, h * 0.04); // engine
    const lvl = opts.fx?.flames && state === 'ask' ? flameLevel(g.streak) : 0; // streak flames idle at the engine
    if (lvl) drawFlames(ctx, -w * 0.25, h, w * 0.5, -h * 0.03 * (2 + lvl), 4 + lvl * 2, clock);
    ctx.restore();
  }

  function drawGauge() {
    const h = rocketH() * 0.9, w = Math.max(22, Math.min(34, W * 0.06));
    const x = rocketX() + rocketH() * 0.3 + w * 1.2, y = H - ground() - h;
    const cell = h / L.PER_WAVE;
    ctx.fillStyle = C.panel; ctx.strokeStyle = C.line; ctx.lineWidth = 2;
    ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
    marks.forEach((ok, i) => {
      ctx.fillStyle = ok ? C.teal : C.coral;
      ctx.fillRect(x + 3, y + h - (i + 1) * cell + 2, w - 6, cell - 4);
    });
    ctx.fillStyle = '#a9b1d6'; ctx.font = `700 ${Math.round(w * 0.42)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('FUEL', x + w / 2, y - 6);
  }

  function drawComet() {
    if (state !== 'ask' && state !== 'reveal') return;
    const c = cometAt(Math.min(p, 1)), b = cometAt(Math.max(0, p - 0.12));
    const r = Math.max(12, Math.min(W, H) * 0.035) * (1 + (p > 0.7 ? 0.15 * Math.sin(clock * 16) : 0));
    const grad = ctx.createLinearGradient(c.x, c.y, b.x, b.y);
    grad.addColorStop(0, 'rgba(255,122,107,.8)'); grad.addColorStop(1, 'rgba(255,122,107,0)');
    ctx.strokeStyle = grad; ctx.lineWidth = r * 1.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.fillStyle = C.coral; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
    if (cur.bonus) { ctx.strokeStyle = C.amber; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.x, c.y, r * 1.6, 0, Math.PI * 2); ctx.stroke(); } // bonus comet wears a gold ring
    ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.55, 0, Math.PI * 2); ctx.fill();
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 14 * shake, (Math.random() - 0.5) * 14 * shake);
    ctx.fillStyle = C.deep; ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.fillStyle = C.ink;
    for (const s of stars) { ctx.globalAlpha = 0.25 + s.z * 0.6; ctx.fillRect(s.x * W, s.y * H, s.z * 2, s.z * 2); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.panel; ctx.fillRect(-10, H - ground(), W + 20, ground() + 10);
    ctx.fillStyle = C.line; ctx.fillRect(rocketX() - rocketH() * 0.32, H - ground() - 4, rocketH() * 0.64, 8);

    drawGauge();
    drawComet();
    if (laser) {
      ctx.strokeStyle = C.teal; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.globalAlpha = 1 - laser.t / 0.16;
      ctx.beginPath(); ctx.moveTo(rocketX(), rocketTop()); ctx.lineTo(laser.x, laser.y); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    drawRocket();
    for (const q of particles) {
      ctx.globalAlpha = 1 - q.t / q.life; ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const q of popups) {
      ctx.globalAlpha = 1 - q.t / 0.9; ctx.fillStyle = C.amber;
      ctx.font = `700 ${Math.round(Math.min(W * 0.07, 34))}px ${FONT}`;
      ctx.fillText(q.text, q.x, q.y - q.t * 70);
    }
    ctx.globalAlpha = 1;
    if (state === 'banner' || state === 'over' || state === 'launch') {
      const size = Math.min(W * 0.1, 56);
      ctx.fillStyle = state === 'over' && !completed ? C.coral : C.amber;
      ctx.font = `700 ${Math.round(size)}px ${FONT}`;
      ctx.fillText(state === 'launch' ? 'Lift-off!' : banner, W / 2, H * 0.22);
      if (state === 'banner') {
        ctx.fillStyle = C.ink; ctx.font = `500 ${Math.round(Math.min(W * 0.045, 22))}px ${FONT}`;
        ctx.fillText(g.wave === 1 ? 'Type the answer before the comet lands' : 'Faster now!', W / 2, H * 0.22 + size);
      }
    }
    ctx.restore();
  }

  function frame(now) {
    if (stopped) return;
    monitor(now - last);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!paused) update(dt);
    if (!stopped) { draw(); raf = requestAnimationFrame(frame); }
  }

  function onPad(e) {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    e.preventDefault();
    press(b.dataset.k);
  }
  function onKey(e) {
    if (e.repeat) return;
    if (e.key >= '0' && e.key <= '9') press(e.key);
    else if (e.key === 'Backspace') press('back');
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  keypad.addEventListener('pointerdown', onPad);
  window.addEventListener('keydown', onKey);
  resize();
  opts.onFact('Get ready!', '');
  hud();
  raf = requestAnimationFrame(t => { last = t; frame(t); });

  return {
    pause() { paused = true; },
    resume() { paused = false; },
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      keypad.removeEventListener('pointerdown', onPad);
      window.removeEventListener('keydown', onKey);
    },
    debug: () => ({ state, answer: cur?.ans, typed }),
  };
}
