// Asteroid Blast: the canvas scene. Rules come from logic.js; this file is drawing, timing and input.
import * as L from './logic.js';
import { sfx } from './audio.js';

const C = { amber: '#ffb84d', teal: '#4fd6c4', coral: '#ff7a6b', ink: '#eef0fb', rock: '#5a628f', rockEdge: '#8b94c9' };
const FONT = '"Chakra Petch","Trebuchet MS",sans-serif';
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * opts: { mission, session (from logic.createSession), kidSpeed, shipColor, onHud(state), onFact(text, mood), onSave(), onEnd(result) }
 * Returns { pause(), resume(), stop() }.
 */
export function createGame(canvas, opts) {
  const ctx = canvas.getContext('2d');
  const { mission, session } = opts;
  const g = session.g;
  let W = 0, H = 0, dead = false, completed = false;
  let state = 'banner', timer = 1.6, banner = 'Wave 1';
  let clock = 0, p = 0, dur = 9, cur = null;
  let rocks = [], particles = [], popups = [], laser = null, shake = 0, shipAngle = 0;
  let paused = false, stopped = false, raf = 0, last = 0;
  const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7 }));

  const shipZone = () => Math.max(64, H * 0.13);
  const lineY = () => H - shipZone();
  const R = () => Math.max(28, Math.min(W / 4 * 0.42, H * 0.11, 64));
  const rockX = r => (r.lane + 0.5) * W / 4 + Math.sin(clock * 0.9 + r.phase) * W * 0.012;
  const rockY = r => -R() + Math.max(0, p - r.po) * lineY() + (r.drop || 0);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const hud = () => opts.onHud({ ...g, mult: L.multFor(g.streak) });

  function nextQuestion() {
    const step = session.advance();
    if (step.type === 'done') return finish(true);
    if (step.type === 'wave') {
      state = 'banner'; timer = 1.8; banner = `Wave ${g.wave}`;
      rocks = []; sfx.wave(); opts.onFact('Shield restored!', 'good'); hud();
      return;
    }
    const fact = step.fact;
    cur = { fact, ans: L.answerOf(fact), text: L.factText(fact), start: clock };
    rocks = L.makeChoices(fact).map((v, lane) => ({
      v, lane, po: Math.random() * 0.06, phase: Math.random() * 6, rot: Math.random() * 6,
      spin: (Math.random() - 0.5) * 0.8, shape: Array.from({ length: 10 }, () => 0.84 + Math.random() * 0.22),
      alpha: 1, mode: 'fall',
    }));
    p = 0; dur = L.fallSeconds(mission.speed, opts.kidSpeed, g.wave);
    state = 'fall';
    opts.onFact(`${cur.text} = ?`, '');
    hud();
  }

  function burst(x, y, color, n = 22) {
    if (reduceMotion) n = 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 260;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, t: 0, color, size: 2 + Math.random() * 4 });
    }
  }

  function answer(rock) {
    if (state !== 'fall' || !rock || rock.mode !== 'fall') return;
    if (rock.v !== cur.ans) return miss(rock);
    const ms = (clock - cur.start) * 1000;
    const pts = session.correct(cur.fact, ms, 1 - p);
    const x = rockX(rock), y = rockY(rock);
    laser = { x, y, t: 0 };
    shipAngle = Math.atan2(x - W / 2, (H - shipZone() / 2) - y);
    burst(x, y, C.amber); burst(x, y, C.rockEdge, 10);
    popups.push({ x, y, text: `+${pts}`, t: 0 });
    rock.mode = 'gone';
    rocks.forEach(r => { if (r !== rock) r.mode = 'away'; });
    sfx.laser(); sfx.boom();
    state = 'hit'; timer = 0.6;
    opts.onFact(`${cur.text} = ${cur.ans}`, 'good');
    hud(); opts.onSave();
  }

  // rock is the wrong asteroid tapped, or null when the right one reached the line.
  function miss(rock) {
    dead = session.miss(cur.fact);
    rocks.forEach(r => { r.mode = r.v === cur.ans ? 'answer' : r === rock ? 'bad' : 'dim'; });
    shake = reduceMotion ? 0 : 0.45;
    sfx.wrong();
    state = 'reveal'; timer = 2.1;
    opts.onFact(`${cur.text} = ${cur.ans}`, 'bad');
    hud(); opts.onSave();
  }

  function finish(done) {
    completed = done;
    state = 'over'; timer = completed ? 0.9 : 1.4;
    banner = completed ? 'Mission complete!' : 'Game over';
    rocks = [];
    if (completed) sfx.win(); else { sfx.over(); burst(W / 2, H - shipZone() / 2, C.coral, 40); }
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
    for (const r of rocks) {
      r.rot += r.spin * dt;
      if (r.mode === 'away' || r.mode === 'dim') r.alpha = Math.max(r.mode === 'dim' ? 0.25 : 0, r.alpha - dt * 3);
      if (r.mode === 'away') r.drop = (r.drop || 0) + dt * 60;
    }
    if (state === 'fall') {
      p += dt / dur;
      const right = rocks.find(r => r.v === cur.ans);
      if (p - right.po >= 1) miss(null);
      return;
    }
    timer -= dt;
    if (timer > 0) return;
    if (state === 'banner') nextQuestion();
    else if (state === 'hit') nextQuestion();
    else if (state === 'reveal') { if (dead) finish(false); else nextQuestion(); }
    else if (state === 'over') { stopped = true; opts.onEnd(session.result(completed)); }
  }

  function drawRock(r) {
    const x = rockX(r), y = rockY(r), rad = R();
    ctx.save();
    ctx.globalAlpha = r.alpha;
    ctx.translate(x, y);
    ctx.save();
    ctx.rotate(r.rot);
    ctx.beginPath();
    r.shape.forEach((f, i) => {
      const a = i / r.shape.length * Math.PI * 2;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad * f, Math.sin(a) * rad * f);
    });
    ctx.closePath();
    ctx.fillStyle = r.mode === 'bad' ? '#8f4a55' : r.mode === 'answer' ? '#2f7f7a' : C.rock;
    ctx.fill();
    ctx.lineWidth = r.mode === 'answer' ? 5 + Math.sin(clock * 10) * 2 : 3;
    ctx.strokeStyle = r.mode === 'bad' ? C.coral : r.mode === 'answer' ? C.teal : C.rockEdge;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    for (const [cx, cy, cr] of [[-0.45, -0.4, 0.16], [0.5, 0.35, 0.12], [-0.3, 0.55, 0.09]]) {
      ctx.beginPath(); ctx.arc(cx * rad, cy * rad, cr * rad, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    const txt = String(r.v);
    ctx.font = `700 ${Math.round(rad * (txt.length > 2 ? 0.66 : 0.86))}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(12,16,36,.75)'; ctx.lineJoin = 'round';
    ctx.strokeText(txt, 0, 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(txt, 0, 2);
    ctx.restore();
  }

  function drawShip() {
    const x = W / 2, y = H - shipZone() / 2, s = Math.min(26, shipZone() * 0.36);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(laser ? shipAngle : 0);
    if (state !== 'over' || completed) {
      ctx.fillStyle = C.coral;
      ctx.beginPath(); ctx.moveTo(-s * 0.45, s * 0.8); ctx.lineTo(0, s * (1.2 + Math.random() * 0.5)); ctx.lineTo(s * 0.45, s * 0.8); ctx.fill();
      ctx.fillStyle = opts.shipColor || C.amber;
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s, s * 0.8); ctx.lineTo(-s, s * 0.8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0c1024';
      ctx.beginPath(); ctx.arc(0, s * 0.1, s * 0.26, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 14 * shake, (Math.random() - 0.5) * 14 * shake);
    ctx.fillStyle = '#0c1024';
    ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.fillStyle = C.ink;
    for (const s of stars) { ctx.globalAlpha = 0.25 + s.z * 0.6; ctx.fillRect(s.x * W, s.y * H, s.z * 2, s.z * 2); }
    ctx.globalAlpha = 1;

    // danger line
    const danger = state === 'fall' ? Math.max(0, (p - 0.6) / 0.4) : 0;
    ctx.strokeStyle = C.coral; ctx.globalAlpha = 0.4 + 0.6 * danger * (0.6 + 0.4 * Math.sin(clock * 14));
    ctx.lineWidth = 2 + danger * 2; ctx.setLineDash([10, 10]);
    ctx.beginPath(); ctx.moveTo(0, lineY()); ctx.lineTo(W, lineY()); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;

    rocks.forEach(r => { if (r.mode !== 'gone' && r.alpha > 0) drawRock(r); });

    if (laser) {
      ctx.strokeStyle = C.teal; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.globalAlpha = 1 - laser.t / 0.16;
      ctx.beginPath(); ctx.moveTo(W / 2, H - shipZone() / 2); ctx.lineTo(laser.x, laser.y); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    drawShip();

    for (const q of particles) {
      ctx.globalAlpha = 1 - q.t / q.life; ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const q of popups) {
      ctx.globalAlpha = 1 - q.t / 0.9; ctx.fillStyle = C.amber;
      ctx.font = `700 ${Math.round(R() * 0.6)}px ${FONT}`;
      ctx.fillText(q.text, q.x, q.y - q.t * 70);
    }
    ctx.globalAlpha = 1;
    if (state === 'banner' || state === 'over') {
      ctx.fillStyle = state === 'over' && !completed ? C.coral : C.amber;
      ctx.font = `700 ${Math.round(Math.min(W * 0.1, 64))}px ${FONT}`;
      ctx.fillText(banner, W / 2, H * 0.38);
      if (state === 'banner') {
        ctx.fillStyle = C.ink; ctx.font = `500 ${Math.round(Math.min(W * 0.045, 24))}px ${FONT}`;
        ctx.fillText(g.wave === 1 ? 'Tap the asteroid with the right answer' : 'Faster now!', W / 2, H * 0.38 + Math.min(W * 0.1, 64));
      }
    }
    ctx.restore();
  }

  function frame(now) {
    if (stopped) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!paused) update(dt);
    if (!stopped) { draw(); raf = requestAnimationFrame(frame); }
  }

  function onPointer(e) {
    if (paused) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    let best = null, bestD = R() * 1.3;
    for (const r of rocks) {
      const d = Math.hypot(rockX(r) - x, rockY(r) - y);
      if (r.mode === 'fall' && d < bestD) { best = r; bestD = d; }
    }
    answer(best);
  }
  function onKey(e) {
    if (paused || e.repeat) return;
    if (e.key >= '1' && e.key <= '4') answer(rocks.find(r => r.lane === Number(e.key) - 1));
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  canvas.addEventListener('pointerdown', onPointer);
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
      canvas.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    },
    // For automated checks: where each choice currently is.
    debug: () => ({ state, answer: cur?.ans, rocks: rocks.map(r => ({ v: r.v, x: rockX(r), y: rockY(r), mode: r.mode })) }),
  };
}
