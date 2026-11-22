// Cave Flight: steer the ship up and down and fly through the gate showing the right answer.
import * as L from './logic.js';
import { sfx } from './audio.js';

const C = { amber: '#ffb84d', teal: '#4fd6c4', coral: '#ff7a6b', ink: '#eef0fb', panel: '#1e2648', line: '#34407a', deep: '#0c1024', rock: '#2a335e' };
const FONT = '"Chakra Petch","Trebuchet MS",sans-serif';
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const LANES = 3;

/**
 * opts: { mission, session, kidSpeed, shipColor, onHud(state), onFact(text, mood), onSave(), onEnd(result) }
 * Returns { pause(), resume(), stop(), debug(), steer(lane) }.
 */
export function createCaveGame(canvas, opts) {
  const ctx = canvas.getContext('2d');
  const { mission, session } = opts;
  const g = session.g;
  let W = 0, H = 0, dead = false, completed = false;
  let state = 'banner', timer = 1.8, banner = 'Wave 1';
  let clock = 0, p = 0, dur = 6, cur = null, gates = [], wallMode = '';
  let shipY = 0.5, targetY = 0.5, scroll = 0; // ship position as a fraction of the flyable height
  let particles = [], popups = [], shake = 0;
  let paused = false, stopped = false, raf = 0, last = 0;
  const stars = Array.from({ length: 50 }, () => ({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7 }));

  // geometry: the cave has a rocky band top and bottom; lanes split the space between
  const edge = () => Math.max(18, H * 0.07);
  const laneH = () => (H - 2 * edge()) / LANES;
  const laneY = i => edge() + (i + 0.5) * laneH();
  const shipX = () => W * 0.2;
  const shipPx = () => edge() + shipY * (H - 2 * edge());
  const wallX = () => W * 1.05 - p * (W * 1.05 - shipX());
  const laneOfShip = () => Math.max(0, Math.min(LANES - 1, Math.floor(shipY * LANES)));

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const hud = () => opts.onHud({ ...g, mult: L.multFor(g.streak) });

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
      state = 'banner'; timer = 1.8; banner = `Wave ${g.wave}`; gates = [];
      sfx.wave(); opts.onFact('Shield restored!', 'good'); hud();
      return;
    }
    const fact = step.fact, ans = L.answerOf(fact);
    cur = { fact, ans, text: L.factText(fact), start: clock };
    const decoys = L.makeChoices(fact).filter(v => v !== ans).slice(0, LANES - 1);
    gates = L.shuffle([ans, ...decoys]);
    p = 0; wallMode = '';
    dur = L.fallSeconds(mission.speed, opts.kidSpeed, g.wave) * 0.5;
    state = 'fly';
    opts.onFact(`${cur.text} = ?`, '');
    hud();
  }

  function arrive() {
    const lane = laneOfShip();
    if (gates[lane] === cur.ans) {
      // Reward settling early is not possible to measure fairly, so the time bonus is fixed.
      const pts = session.correct(cur.fact, (clock - cur.start) * 1000, 0.5);
      burst(shipX(), shipPx(), C.teal, 16);
      popups.push({ x: shipX() + 40, y: shipPx(), text: `+${pts}`, t: 0 });
      sfx.laser();
      wallMode = 'pass'; state = 'hit'; timer = 0.55;
      opts.onFact(`${cur.text} = ${cur.ans}`, 'good');
    } else {
      dead = session.miss(cur.fact);
      burst(shipX(), shipPx(), C.coral, 30);
      shake = reduceMotion ? 0 : 0.45;
      sfx.wrong(); sfx.boom();
      wallMode = 'crash'; state = 'reveal'; timer = 2.1;
      opts.onFact(`${cur.text} = ${cur.ans}`, 'bad');
    }
    hud(); opts.onSave();
  }

  function finish(done) {
    completed = done;
    state = 'over'; timer = done ? 0.9 : 1.4;
    banner = done ? 'Mission complete!' : 'Game over';
    gates = [];
    if (done) sfx.win(); else { sfx.over(); burst(shipX(), shipPx(), C.coral, 40); }
    hud();
  }

  function update(dt) {
    clock += dt;
    const moving = state !== 'reveal' && state !== 'over';
    if (moving) scroll += dt * W * 0.35;
    for (const s of stars) { if (moving) s.x -= dt * 0.04 * s.z; if (s.x < 0) { s.x = 1; s.y = Math.random(); } }
    shipY += (targetY - shipY) * Math.min(1, dt * 12);
    particles = particles.filter(q => (q.t += dt) < q.life);
    for (const q of particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 200 * dt; }
    popups = popups.filter(q => (q.t += dt) < 0.9);
    shake = Math.max(0, shake - dt);
    if (state === 'fly') {
      p += dt / dur;
      if (p >= 1) { p = 1; arrive(); }
      return;
    }
    if (state === 'hit') p += dt / dur; // the wall slides on past the ship
    timer -= dt;
    if (timer > 0) return;
    if (state === 'banner' || state === 'hit') next();
    else if (state === 'reveal') { if (dead) finish(false); else next(); }
    else if (state === 'over') { stopped = true; opts.onEnd(session.result(completed)); }
  }

  function drawCave() {
    const e = edge();
    ctx.fillStyle = C.rock;
    for (const top of [true, false]) {
      ctx.beginPath();
      ctx.moveTo(0, top ? 0 : H);
      for (let x = 0; x <= W + 20; x += 20) {
        const bump = Math.sin((x + scroll) * 0.021) * e * 0.22 + Math.sin((x + scroll) * 0.057 + (top ? 0 : 2)) * e * 0.12;
        ctx.lineTo(x, top ? e * 0.72 + bump : H - e * 0.72 - bump);
      }
      ctx.lineTo(W + 20, top ? 0 : H);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawWall() {
    if (!gates.length) return;
    const x = wallX(), w = Math.max(84, Math.min(W * 0.2, 130)), lh = laneH(), e = edge();
    if (x < -w) return;
    const gap = lh * 0.14; // rock between gates
    ctx.fillStyle = C.rock;
    ctx.fillRect(x - w / 2, 0, w, e + gap / 2);
    ctx.fillRect(x - w / 2, H - e - gap / 2, w, e + gap / 2);
    for (let i = 1; i < LANES; i++) ctx.fillRect(x - w / 2, e + i * lh - gap / 2, w, gap);
    gates.forEach((v, i) => {
      const y0 = e + i * lh + gap / 2, hgt = lh - gap, isAns = v === cur.ans;
      const reveal = wallMode === 'crash';
      ctx.globalAlpha = reveal && !isAns ? 0.3 : 1;
      ctx.strokeStyle = reveal ? (isAns ? C.teal : C.coral) : wallMode === 'pass' && isAns ? C.teal : C.amber;
      ctx.lineWidth = reveal && isAns ? 5 + Math.sin(clock * 10) * 2 : 4;
      ctx.strokeRect(x - w / 2, y0, w, hgt);
      ctx.fillStyle = 'rgba(12,16,36,.55)'; ctx.fillRect(x - w / 2, y0, w, hgt);
      const txt = String(v), size = Math.min(lh * 0.5, W * 0.13, 64) * (txt.length > 2 ? 0.8 : 1);
      ctx.font = `700 ${Math.round(size)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(12,16,36,.85)'; ctx.lineJoin = 'round';
      ctx.strokeText(txt, x, y0 + hgt / 2 + 2);
      ctx.fillStyle = reveal && isAns ? C.teal : '#fff';
      ctx.fillText(txt, x, y0 + hgt / 2 + 2);
      ctx.globalAlpha = 1;
    });
  }

  function drawShip() {
    if (state === 'over' && !completed) return;
    if (wallMode === 'crash' && Math.floor(clock * 10) % 2) return; // blink after a crash
    const s = Math.min(22, laneH() * 0.22), x = shipX(), y = shipPx();
    ctx.save(); ctx.translate(x, y);
    ctx.rotate((targetY - shipY) * 1.2);
    ctx.fillStyle = C.coral;
    ctx.beginPath(); ctx.moveTo(-s * 0.8, -s * 0.4); ctx.lineTo(-s * (1.3 + Math.random() * 0.5), 0); ctx.lineTo(-s * 0.8, s * 0.4); ctx.fill();
    ctx.fillStyle = opts.shipColor || C.amber;
    ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.8, -s * 0.9); ctx.lineTo(-s * 0.8, s * 0.9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.deep; ctx.beginPath(); ctx.arc(-s * 0.1, 0, s * 0.26, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 14 * shake, (Math.random() - 0.5) * 14 * shake);
    ctx.fillStyle = C.deep; ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.fillStyle = C.ink;
    for (const s of stars) { ctx.globalAlpha = 0.2 + s.z * 0.5; ctx.fillRect(s.x * W, s.y * H, s.z * 2, s.z * 2); }
    ctx.globalAlpha = 1;
    drawCave();
    // faint lane guides so it is clear where the ship will go
    ctx.strokeStyle = C.line; ctx.setLineDash([4, 12]); ctx.lineWidth = 1;
    for (let i = 1; i < LANES; i++) { ctx.beginPath(); ctx.moveTo(0, edge() + i * laneH()); ctx.lineTo(W, edge() + i * laneH()); ctx.stroke(); }
    ctx.setLineDash([]);
    drawWall();
    drawShip();
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
    if (state === 'banner' || state === 'over') {
      const size = Math.min(W * 0.1, 60);
      ctx.fillStyle = state === 'over' && !completed ? C.coral : C.amber;
      ctx.font = `700 ${Math.round(size)}px ${FONT}`;
      ctx.fillText(banner, W / 2, H * 0.4);
      if (state === 'banner') {
        ctx.fillStyle = C.ink; ctx.font = `500 ${Math.round(Math.min(W * 0.045, 22))}px ${FONT}`;
        ctx.fillText(g.wave === 1 ? 'Slide up or down. Fly through the right answer' : 'Faster now!', W / 2, H * 0.4 + size);
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

  const steer = lane => { targetY = (Math.max(0, Math.min(LANES - 1, lane)) + 0.5) / LANES; };
  function onPointer(e) {
    if (paused || (e.type === 'pointermove' && e.pointerType === 'mouse' && !e.buttons)) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    // A touch or click picks the lane under the finger, so the ship always sits squarely in a gate.
    steer(Math.floor((e.clientY - rect.top - edge()) / laneH()));
  }
  function onKey(e) {
    if (paused) return;
    const lane = Math.round(targetY * LANES - 0.5);
    if (e.key === 'ArrowUp') { steer(lane - 1); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { steer(lane + 1); e.preventDefault(); }
    else if (e.key >= '1' && e.key <= String(LANES)) steer(Number(e.key) - 1);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  canvas.addEventListener('pointerdown', onPointer);
  canvas.addEventListener('pointermove', onPointer);
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
      canvas.removeEventListener('pointermove', onPointer);
      window.removeEventListener('keydown', onKey);
    },
    steer,
    debug: () => ({ state, answer: cur?.ans, gates, lane: laneOfShip(), p }),
  };
}
