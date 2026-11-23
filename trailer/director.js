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
  const stream = seed => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Separate streams. The game's rules (which fact comes next, which wrong answers are offered)
  // draw from their own, so two takes of one mission ask the same questions even when one of them
  // has extra effects that use random numbers for sparks and rubble.
  const rulesRnd = stream(20261), looksRnd = stream(555), playerRnd = stream(9), dataRnd = stream(77);
  Math.random = () => (new Error().stack.includes('/js/logic.js') ? rulesRnd() : looksRnd());

  // ---------- the takes ----------
  const ALL_FX = { robot: true, rocky: true, sounds: true, flames: true, chunks: true, chart: true };
  const NO_FX = { robot: false, rocky: false, sounds: false, flames: false, chunks: false, chart: false };
  // think: seconds the player waits before answering. miss: questions (1-based) answered wrong.
  // linger: seconds spent on the mission map before starting.
  const play = (scene, op, mission, more = {}) => ({ kind: 'play', scene, op, mission, think: 1.4, miss: [], linger: 0, fx: ALL_FX, speed: 'medium', ...more });
  const PLAN = {
    // The hero shot: asteroids fall well into view before each answer, and the second answer is wrong.
    blast: play('blast', 'mul', 't6', { think: 2.3, miss: [2] }),
    // A whole mission played briskly with no misses, for the results screen.
    result: play('blast', 'mul', 't6', { think: 0.8 }),
    fuel: play('fuel', 'div', 'div4', { think: 1.3 }),
    cave: play('cave', 'sub', 'sub5-6', { think: 0.8 }),
    // One addition mission on three screen shapes.
    add: play('blast', 'add', 'add7-8', { think: 1.7 }),
    'add-wide': play('blast', 'add', 'add7-8', { think: 1.7 }),
    'add-tall': play('blast', 'add', 'add7-8', { think: 1.7 }),
    // One mission twice: everything switched off, and everything switched on.
    calm: play('blast', 'mul', 't7', { think: 1.8, linger: 1.6, fx: NO_FX }),
    lively: play('blast', 'mul', 't7', { think: 1.8, linger: 1.6 }),
    // One mission at the slowest and the fastest setting.
    slow: play('blast', 'mul', 't5', { think: 5, speed: 'slow' }),
    fast: play('blast', 'mul', 't5', { think: 5, speed: 'fast' }),
    tune: { kind: 'tune', scene: 'blast', op: 'mul', fx: ALL_FX, speed: 'medium', ops: ['mul', 'div'] },
    progress: { kind: 'progress', scene: 'blast', op: 'mul', fx: ALL_FX, speed: 'medium', rich: true },
  };
  const plan = PLAN[take];
  if (!plan) throw new Error(`Unknown take: ${take}`);

  // ---------- demo pilot ----------
  const pad2 = n => String(n).padStart(2, '0');
  const dayKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  function demoData() {
    const rich = !!plan.rich; // a pilot who has played a lot, for the progress grid
    const facts = {}, today = {};
    const add = (key, skill) => {
      const seen = 2 + Math.floor(dataRnd() * 5);
      const right = skill > 0.8 ? seen : Math.max(0, Math.round(seen * (skill + (dataRnd() - 0.5) * 0.3)));
      const ms = skill > 0.8 ? 1500 + dataRnd() * 1800 : 3500 + dataRnd() * 3000;
      facts[key] = { seen, right, streak: right === seen ? seen : 0, ms: Math.round(ms) };
      today[key] = [seen, right, Math.round(ms * right)];
    };
    // Multiplication: low tables are solid, sixes and sevens are still being learned.
    for (let a = 1; a <= 7; a++) for (let b = 1; b <= 7; b++) {
      const hard = Math.max(a, b);
      if (!rich && a >= 6) continue;
      if (rich && a === 7 && b > 4) continue;
      add(`${a}x${b}`, hard <= 4 ? 0.95 : hard === 5 ? 0.9 : a * b === 42 || a * b === 49 || a * b === 36 ? 0.45 : dataRnd() < 0.5 ? 0.9 : 0.72);
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
    const stars = (ids, n) => Object.fromEntries(ids.map((id, i) => [id, { stars: n[i], best: 4200 + i * 310, plays: 2 }]));
    const missions = rich
      ? { ...stars(['t1-2', 't3', 't4', 't5', 't6'], [3, 3, 3, 3, 2]), ...stars(['div1-2', 'div3', 'div4'], [3, 3, 2]), ...stars(['add1-2', 'add3-4', 'add5-6'], [3, 3, 3]), ...stars(['sub1-2', 'sub3-4'], [3, 2]) }
      : stars(['t1-2', 't3', 't4', 't5'], [3, 3, 2, 2]);
    return {
      sound: true,
      profiles: [{
        id: 'nova', name: 'Nova', color: '#4fd6c4',
        settings: {
          tables: [1, 2, 3, 4, 5, 6, 7], speed: plan.speed, unlockAll: false,
          // Every mission is open, so any of them can be filmed (and the lock symbol,
          // which has no glyph in the recording browser, never shows).
          startAt: { mul: 9, div: 9, add: 9, sub: 9 },
          ops: plan.ops || ['mul', 'div', 'add', 'sub'],
          fx: plan.fx,
        },
        missions, facts, days: { [dayKey(new Date())]: today }, log,
        last: { op: plan.op, scene: plan.scene },
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
  // Scroll a long screen like a thumb would, until the element sits about a third of the way down.
  async function scrollTo(sel, ms = 600) {
    const page = $('.screen.active'), el = $(sel);
    const from = page.scrollTop;
    const to = Math.max(0, Math.min(page.scrollHeight - page.clientHeight, from + el.getBoundingClientRect().top - page.clientHeight * 0.3));
    const began = performance.now();
    await new Promise(done => {
      const slide = setInterval(() => {
        const k = Math.min(1, (performance.now() - began) / ms);
        page.scrollTop = from + (to - from) * (1 - (1 - k) ** 3);
        if (k >= 1) { clearInterval(slide); done(); }
      }, 16);
    });
  }

  // ---------- the scripted player ----------
  // Watches the real game through its debug hook and answers each question after a "thinking" pause.
  const ASKING = ['fall', 'ask', 'fly'];
  function autoplay() {
    let prev = '', asked = 0, waves = 0, due = null;
    const canvas = $('#game');
    const act = {
      blast(d, wrong) {
        const rock = d.rocks.find(r => (r.v === d.answer) !== wrong && r.mode === 'fall');
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
        }, i * 260));
      },
      cave(d) {
        const rect = canvas.getBoundingClientRect(), lanes = d.gates.length;
        const lane = d.gates.indexOf(d.answer);
        tapDot(rect.left + rect.width * 0.2, rect.top + rect.height * (lane + 0.5) / lanes);
        window.__game.steer(lane);
        setTimeout(() => {
          tapDot(rect.left + rect.width * 0.8, rect.top + rect.height * 0.5);
          window.__game.boost();
        }, 600);
      },
    }[plan.scene];
    const loop = () => {
      requestAnimationFrame(loop);
      if ($('#s-result.active')) { mark('result'); return; }
      const d = $('#s-play.active') && window.__game?.debug();
      if (!d) return;
      if (d.state !== prev) {
        if (ASKING.includes(d.state)) {
          asked++;
          mark(`q${asked}`); // question appears
          if ($('#s-play').classList.contains('bonus')) mark('bonus');
          due = performance.now() + plan.think * 1000 * (0.9 + playerRnd() * 0.2);
        }
        if (d.state === 'launch') mark('launch');
        if (d.state === 'banner' && asked) mark(`wave${++waves + 1}`);
        prev = d.state;
      }
      if (due !== null && ASKING.includes(d.state) && performance.now() >= due) {
        due = null;
        mark(`a${asked}`); // question answered
        act(d, plan.miss.includes(asked));
      }
    };
    requestAnimationFrame(loop);
  }

  const RUN = {
    async play() {
      tap('[data-act="pick-pilot"]');
      mark('map');
      await wait(plan.linger ? plan.linger * 1000 : 60);
      // List buttons and star-chart planets both carry data-id.
      const target = $(`[data-act="play-mission"][data-id="${plan.mission}"]`);
      if (!target) throw new Error(`Mission ${plan.mission} is not on the map`);
      if (plan.linger) tap(target); else target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      mark('play');
      autoplay();
    },
    // A grown-up holds the gear, then switches subjects on, adds times tables and changes the speed.
    async tune() {
      tap('[data-act="pick-pilot"]');
      await wait(300);
      const gear = $('#gear'), [x, y] = centre(gear);
      tapDot(x, y); pointer(gear, 'pointerdown', x, y); mark('hold');
      await wait(2100);
      mark('settings');
      await wait(900);
      tap('[data-act="toggle-op"][data-v="add"]'); mark('ops');
      await wait(750);
      tap('[data-act="toggle-op"][data-v="sub"]');
      await wait(900);
      await scrollTo('[data-act="toggle-table"]', 450);
      for (const n of [8, 9, 10]) {
        await wait(n === 8 ? 350 : 520);
        tap(`[data-act="toggle-table"][data-v="${n}"]`); mark('tables');
      }
      await wait(900);
      await scrollTo('[data-act="set-speed"]', 450);
      await wait(350);
      tap('[data-act="set-speed"][data-v="slow"]'); mark('speed');
      await wait(900);
      tap('[data-act="set-speed"][data-v="fast"]');
      await wait(900);
      mark('end');
    },
    // Hold the gear for two seconds, then open the progress grid.
    async progress() {
      tap('[data-act="pick-pilot"]');
      await wait(500);
      const gear = $('#gear'), [x, y] = centre(gear);
      tapDot(x, y); pointer(gear, 'pointerdown', x, y); mark('hold');
      await wait(2100);
      mark('settings');
      await wait(700);
      tap('[data-act="set-tab"][data-v="progress"]'); mark('grid');
      await wait(500);
      await scrollTo('.grids', 700);
      await wait(500);
      tap('[data-act="view-op"][data-v="div"]'); mark('div');
      await wait(1300);
      tap('[data-act="view-op"][data-v="all"]'); mark('all');
    },
  };

  try { localStorage.setItem('mathfasters.v1', JSON.stringify(demoData())); } catch (e) { console.error(e); }

  window.__trailer = {
    ready: false,
    marks,
    start() {
      t0 = performance.now();
      RUN[plan.kind]().catch(e => console.error(e));
    },
  };
  window.addEventListener('load', async () => {
    // The game draws text on the canvas, so the fonts must be in before the first frame.
    await Promise.all(['700 20px "Chakra Petch"', '500 20px "Chakra Petch"', '400 20px "Atkinson Hyperlegible"', '700 20px "Atkinson Hyperlegible"'].map(f => document.fonts.load(f)));
    window.__trailer.ready = true;
  });
})();
