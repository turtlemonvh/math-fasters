// Injected before the game's own scripts by record.ts (after virtual-time.js).
// Sets up a demo pilot, fixes the random numbers so every recording is the same,
// and plays the real game with a scripted player. The game's code is not changed:
// the player taps, types and steers through the same events a child's fingers send.
//
// The take to film comes from the page address: index.html?take=<id>
(() => {
  const take = new URLSearchParams(location.search).get('take');
  if (!take) return;

  // ---------- fixed random numbers ----------
  let seed = 20261;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // The demo data below has its own stream, so changing it never changes the gameplay.
  let dseed = 77;
  const drnd = () => {
    dseed = (dseed * 1664525 + 1013904223) >>> 0;
    return dseed / 4294967296;
  };
  Math.random = rnd;

  // ---------- demo pilot ----------
  const pad2 = n => String(n).padStart(2, '0');
  const dayKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const SYM = { mul: 'x', div: '/', add: '+', sub: '-' };

  function demoData() {
    const rich = take === 'map' || take === 'progress'; // these takes show a pilot who has played a lot
    const facts = {}, today = {};
    const add = (key, skill) => {
      const seen = 2 + Math.floor(drnd() * 5);
      const right = skill > 0.8 ? seen : Math.max(0, Math.round(seen * (skill + (drnd() - 0.5) * 0.3)));
      const ms = skill > 0.8 ? 1500 + drnd() * 1800 : 3500 + drnd() * 3000;
      facts[key] = { seen, right, streak: right === seen ? seen : 0, ms: Math.round(ms) };
      today[key] = [seen, right, Math.round(ms * right)];
    };
    // Multiplication: low tables are solid, sixes and sevens are still being learned.
    for (let a = 1; a <= 7; a++) for (let b = 1; b <= 7; b++) {
      const hard = Math.max(a, b);
      if (!rich && a >= 6) continue;
      if (rich && a === 7 && b > 4) continue;
      add(`${a}x${b}`, hard <= 4 ? 0.95 : hard === 5 ? 0.9 : a * b === 42 || a * b === 49 || a * b === 36 ? 0.45 : drnd() < 0.5 ? 0.9 : 0.72);
    }
    if (rich) {
      for (let b = 1; b <= 4; b++) for (let c = 1; c <= 7; c++) add(`${b * c}/${b}`, b <= 3 ? 0.95 : 0.75);
      for (let a = 1; a <= 6; a++) for (let b = 1; b <= 10; b++) add(`${a}+${b}`, a <= 4 ? 0.95 : 0.78);
      for (let b = 1; b <= 4; b++) for (let c = 1; c <= 10; c++) add(`${b + c}-${b}`, b <= 2 ? 0.95 : 0.8);
    }
    const now = Date.now();
    const log = rich ? [
      ['mul', 'blast', 'Asteroid Belt', '×5', 3, 30, 30, 5210, 96],
      ['div', 'cave', 'Canyon Run', '÷4', 2, 30, 28, 4380, 131],
      ['add', 'fuel', 'Beacon Row', '+5 +6', 3, 30, 30, 4820, 104],
      ['mul', 'blast', 'Gas Giant', '×6', 2, 31, 29, 4470, 122],
    ].map(([op, scene, name, label, stars, asked, right, score, secs], i) => ({
      t: now - (i + 1) * 9 * 60000, op, scene, name, label, done: true, stars, score, asked, right, secs,
      missed: right < asked ? ['6 × 7 = 42'] : [],
    })) : [];
    const stars = (ids, n) => Object.fromEntries(ids.map((id, i) => [id, { stars: Array.isArray(n) ? n[i] : n, best: 4200 + i * 310, plays: 2 }]));
    const missions = rich
      ? { ...stars(['t1-2', 't3', 't4', 't5', 't6'], [3, 3, 3, 3, 2]), ...stars(['div1-2', 'div3', 'div4'], [3, 3, 2]), ...stars(['add1-2', 'add3-4', 'add5-6'], [3, 3, 3]), ...stars(['sub1-2', 'sub3-4'], [3, 2]) }
      : stars(['t1-2', 't3', 't4', 't5'], [3, 3, 2, 2]);
    return {
      sound: true,
      profiles: [{
        id: 'nova', name: 'Nova', color: '#4fd6c4',
        settings: {
          tables: [1, 2, 3, 4, 5, 6, 7], speed: 'medium', unlockAll: false,
          // On the map take every mission is open: the lock symbol has no glyph in the recording browser.
          ...(take === 'map' ? { startAt: { mul: 9, div: 9, add: 9, sub: 9 } } : {}),
          ops: ['mul', 'div', 'add', 'sub'],
          fx: { robot: true, rocky: true, sounds: true, flames: true, chunks: true, chart: true },
        },
        missions, facts, days: { [dayKey(new Date())]: today }, log,
        last: { op: 'mul', scene: PLAN[take].scene || 'blast' },
      }],
    };
  }

  // ---------- helpers ----------
  const $ = s => document.querySelector(s);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const marks = {};
  let t0 = 0;
  const clock = () => (performance.now() - t0) / 1000;
  const mark = name => { if (!(name in marks)) marks[name] = Math.round(clock() * 1000) / 1000; };

  // A ring where the player touches, so viewers can see what was tapped.
  function tapDot(x, y) {
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;
      border:3px solid #eef0fb;background:rgba(238,240,251,.28);pointer-events:none;z-index:99`;
    document.body.appendChild(d);
    d.animate([{ transform: 'scale(.45)', opacity: 1 }, { transform: 'scale(1.15)', opacity: 0 }], { duration: 420, easing: 'ease-out', fill: 'forwards' });
    setTimeout(() => d.remove(), 440);
  }
  const pointer = (el, type, x, y) => el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch', buttons: 1 }));
  const centre = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  function tap(sel) {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) throw new Error(`Nothing to tap: ${sel}`);
    const [x, y] = centre(el);
    tapDot(x, y);
    pointer(el, 'pointerdown', x, y);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  // ---------- the scripted player ----------
  // Watches the real game through its debug hook and answers each question after a short "thinking" pause.
  const ASKING = ['fall', 'ask', 'fly'];
  function autoplay(scene) {
    let prev = '', asked = 0, waves = 0, due = null;
    const canvas = $('#game');
    const act = {
      blast(d) {
        const rock = d.rocks.find(r => r.v === d.answer && r.mode === 'fall');
        if (!rock) return;
        const rect = canvas.getBoundingClientRect();
        tapDot(rect.left + rock.x, rect.top + rock.y);
        pointer(canvas, 'pointerdown', rect.left + rock.x, rect.top + rock.y);
      },
      fuel(d) {
        [...String(d.answer)].forEach((digit, i) => setTimeout(() => {
          const key = $(`#keypad [data-k="${digit}"]`);
          const [x, y] = centre(key);
          tapDot(x, y);
          pointer(key, 'pointerdown', x, y);
        }, i * 230));
      },
      cave(d) {
        const rect = canvas.getBoundingClientRect(), lanes = d.gates.length;
        const lane = d.gates.indexOf(d.answer);
        tapDot(rect.left + rect.width * 0.2, rect.top + rect.height * (lane + 0.5) / lanes);
        window.__game.steer(lane);
        setTimeout(() => {
          tapDot(rect.left + rect.width * 0.8, rect.top + rect.height * 0.5);
          window.__game.boost();
        }, 520);
      },
    }[scene];
    const loop = () => {
      requestAnimationFrame(loop);
      if ($('#s-result.active')) { mark('result'); return; }
      const d = $('#s-play.active') && window.__game?.debug();
      if (!d) return;
      if (d.state !== prev) {
        if (ASKING.includes(d.state)) {
          asked++;
          mark('q1');
          mark(`q${asked}`);
          if ($('#s-play').classList.contains('bonus')) mark('bonus');
          // Thinking time: brisk, a little uneven, like a child who knows these.
          due = performance.now() + 620 + rnd() * 420 + (asked === 1 ? 500 : 0);
        }
        if (d.state === 'launch') mark('launch');
        if (d.state === 'banner' && asked) mark(`wave${++waves + 1}`);
        prev = d.state;
      }
      if (due !== null && ASKING.includes(d.state) && performance.now() >= due) { due = null; act(d); }
    };
    requestAnimationFrame(loop);
  }

  async function playMission(scene, id) {
    tap('[data-act="pick-pilot"]');
    await wait(60);
    // The star chart draws missions as planets; each one carries the same data-id as the list buttons.
    const target = $(`[data-act="play-mission"][data-id="${id}"]`);
    if (!target) throw new Error(`Mission ${id} is not on the map`);
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    mark('play');
    autoplay(scene);
  }

  // Each take: which game the demo pilot last chose, and what happens once filming starts.
  const PLAN = {
    blast: { scene: 'blast', run: () => playMission('blast', 't6') },
    'blast-wide': { scene: 'blast', run: () => playMission('blast', 't6') },
    'blast-tall': { scene: 'blast', run: () => playMission('blast', 't6') },
    fuel: { scene: 'fuel', run: () => playMission('fuel', 't5') },
    cave: { scene: 'cave', run: () => playMission('cave', 't4') },
  };
  // Pilot screen, then the star chart, flipping through the four kinds of facts.
  PLAN.map = {
    scene: 'blast',
    async run() {
      await wait(900);
      tap('[data-act="pick-pilot"]'); mark('map');
      for (const op of ['div', 'add', 'sub', 'mul']) {
        await wait(1150);
        tap(`[data-act="set-op"][data-v="${op}"]`); mark(op);
      }
      await wait(1000);
      tap('[data-act="set-scene"][data-v="cave"]');
    },
  };
  // Hold the gear for two seconds, then open the progress grid.
  PLAN.progress = {
    scene: 'blast',
    async run() {
      tap('[data-act="pick-pilot"]');
      await wait(500);
      const gear = $('#gear'), [x, y] = centre(gear);
      tapDot(x, y); pointer(gear, 'pointerdown', x, y); mark('hold');
      await wait(2100);
      mark('settings');
      await wait(700);
      tap('[data-act="set-tab"][data-v="progress"]'); mark('grid');
      await wait(500);
      // Scroll down like a thumb would, so the whole grid is in view.
      const page = $('#s-settings'), from = page.scrollTop, to = 330, began = performance.now();
      const slide = setInterval(() => {
        const k = Math.min(1, (performance.now() - began) / 700), e = 1 - (1 - k) ** 3;
        page.scrollTop = from + (to - from) * e;
        if (k >= 1) clearInterval(slide);
      }, 16);
      await wait(1200);
      tap('[data-act="view-op"][data-v="div"]'); mark('div');
      await wait(1300);
      tap('[data-act="view-op"][data-v="all"]'); mark('all');
    },
  };
  if (!PLAN[take]) throw new Error(`Unknown take: ${take}`);

  try { localStorage.setItem('mathfasters.v1', JSON.stringify(demoData())); } catch (e) { console.error(e); }

  window.__trailer = {
    ready: false,
    marks,
    start() {
      t0 = performance.now();
      PLAN[take].run().catch(e => console.error(e));
    },
  };
  window.addEventListener('load', async () => {
    // The game draws text on the canvas, so the fonts must be in before the first frame.
    await Promise.all(['700 20px "Chakra Petch"', '500 20px "Chakra Petch"', '400 20px "Atkinson Hyperlegible"', '700 20px "Atkinson Hyperlegible"'].map(f => document.fonts.load(f)));
    window.__trailer.ready = true;
  });
})();
