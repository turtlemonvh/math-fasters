// Pure game rules: no DOM, no storage. Tested in test/logic.test.js.

export const FAST_MS = 4000; // a right answer at or under this (on average) counts as "knows it fast"
export const WAVES = 3;
export const PER_WAVE = 10;
export const MAX_SHIELDS = 3;
// Speed bonus: answer with at least this much of the time left and it counts as quick.
// Three quick answers in a row earn a bonus question; after that, two in a row. A miss resets to three.
export const QUICK = 0.7;
export const BONUS_FIRST = 3;
export const BONUS_NEXT = 2;

// A fact is { a, b, op }. op is 'mul' (default), 'div', 'add' or 'sub'.
export const OPS = {
  mul: { sym: '×', k: 'x', name: 'Multiplication' },
  add: { sym: '+', k: '+', name: 'Addition' },
  sub: { sym: '−', k: '-', name: 'Subtraction' },
  div: { sym: '÷', k: '/', name: 'Division' },
};
export const ADD_MAX = 10; // addition and subtraction use numbers 1 to 10
export const fkey = f => `${f.a}${OPS[f.op || 'mul'].k}${f.b}`;
export const answerOf = f => f.op === 'add' ? f.a + f.b : f.op === 'sub' ? f.a - f.b : f.op === 'div' ? f.a / f.b : f.a * f.b;
// Multiplication and division both follow the times tables a grown-up has put in play.
export const usesTables = op => op === 'mul' || op === 'div';
export const factText = f => `${f.a} ${OPS[f.op || 'mul'].sym} ${f.b}`;

// Each kind of fact is its own corner of space, with its own place names.
export const SECTORS = { mul: 'Times Nebula', div: 'Divide Canyon', add: 'Plus Harbor', sub: 'Minus Reef' };
const NAMES = {
  mul: ['Launch Pad', 'Moon Run', 'Red Planet', 'Asteroid Belt', 'Gas Giant', 'Ice Rings', 'Comet Trail', 'Twin Suns', 'Nebula Gate', 'Black Hole Rim', 'Star Forge'],
  div: ['Crater Camp', 'Split Rock', 'Canyon Run', 'Echo Caves', 'Shard Field', 'Broken Moon', 'Halfway Station', 'Prism Pass', 'Fracture Ridge', 'Meteor Mine', 'Core Vault'],
  add: ['Star Dock', 'Cargo Bay', 'Beacon Row', 'Supply Run', 'Fuel Depot'],
  sub: ['Drift Reef', 'Shadow Moon', 'Cold Harbor', 'Dim Star', 'Quiet Ring'],
};
const FINALE = { mul: 'Deep Space', div: 'The Great Divide', add: 'Grand Fleet', sub: 'The Dark Side' };

export function cleanTables(tables) {
  return [...new Set(tables)].filter(n => Number.isInteger(n) && n >= 1 && n <= 12).sort((a, b) => a - b);
}

// The largest "other" number a times table gets multiplied by.
export function maxOther(tables) {
  return Math.max(5, ...cleanTables(tables));
}

// Mission map. Multiplication and division: one mission per table in play (1 and 2 share one), then a mixed finale.
// Addition and subtraction: the numbers 1 to 10 in pairs, then a mixed finale.
export function buildMissions(tables, op = 'mul') {
  const sym = OPS[op].sym;
  let groups, all;
  if (usesTables(op)) {
    all = cleanTables(tables);
    groups = [];
    let rest = all;
    if (all.includes(1) && all.includes(2)) { groups.push([1, 2]); rest = all.filter(n => n > 2); }
    for (const n of rest) groups.push([n]);
  } else {
    groups = [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]];
    all = groups.flat();
  }
  const pre = op === 'mul' ? 't' : op;
  const missions = groups.map((g, i) => ({
    id: pre + g.join('-'),
    op,
    name: NAMES[op][i % NAMES[op].length],
    label: g.map(n => sym + n).join(' '),
    focus: g,
    review: groups.slice(0, i).flat().filter(n => !usesTables(op) || i === 1 || n !== 1),
    speed: i < 2 ? 'slow' : 'medium',
  }));
  if (groups.length > 1) {
    const noOnes = all.filter(n => n !== 1);
    missions.push({ id: op === 'mul' ? 'mix' : op + 'mix', op, name: FINALE[op], label: 'All mixed',
      focus: usesTables(op) && noOnes.length ? noOnes : all, review: [], speed: 'fast' });
  }
  return missions;
}

// Every fact built on a focus number.
// mul: f × o and o × f (x1 facts only when 1 is itself a focus table). div: (f × o) ÷ f.
// add: f + o and o + f. sub: (f + o) − f.
export function factsFor(focus, max, op = 'mul') {
  const out = new Map();
  const put = (a, b) => { const f = { a, b, op }; out.set(fkey(f), f); };
  for (const f of focus) {
    for (let o = 1; o <= max; o++) {
      if (op === 'sub') { put(f + o, f); continue; }
      if (usesTables(op) && o === 1 && !focus.includes(1)) continue;
      if (op === 'div') { put(f * o, f); continue; }
      put(f, o); put(o, f);
    }
  }
  return [...out.values()];
}

export function missionPools(mission, tables) {
  const op = mission.op || 'mul';
  const max = usesTables(op) ? maxOther(tables) : ADD_MAX;
  const focus = factsFor(mission.focus, max, op);
  const have = new Set(focus.map(fkey));
  const review = factsFor(mission.review, max, op).filter(f => !have.has(fkey(f)));
  return { focus, review };
}

// Rows and columns for the grown-up progress grid.
export function gridFor(op, tables) {
  const rowNums = usesTables(op) ? cleanTables(tables) : Array.from({ length: ADD_MAX }, (_, i) => i + 1);
  const cols = Array.from({ length: usesTables(op) ? maxOther(tables) : ADD_MAX }, (_, i) => i + 1);
  return {
    cols,
    rows: rowNums.map(r => ({ label: r, facts: cols.map(c => op === 'sub' ? { a: r + c, b: r, op } : op === 'div' ? { a: r * c, b: r, op } : { a: r, b: c, op }) })),
  };
}

// 'new' | 'fast' | 'slow' | 'missed'
export function classify(s) {
  if (!s || !s.seen) return 'new';
  if (s.streak >= 3 && s.ms && s.ms <= FAST_MS) return 'fast';
  if (s.streak >= 1 && s.right / s.seen >= 0.7) return 'slow';
  return 'missed';
}

const WEIGHT = { new: 3, missed: 6, slow: 3, fast: 1 };

export function recordAnswer(stats, k, correct, ms) {
  const s = stats[k] || (stats[k] = { seen: 0, right: 0, streak: 0, ms: 0 });
  s.seen++;
  if (correct) {
    s.right++;
    s.streak++;
    s.ms = s.ms ? Math.round(s.ms * 0.6 + ms * 0.4) : Math.round(ms);
  } else {
    s.streak = 0;
  }
  return s;
}

// Weighted pick: weak and unseen facts come up more; recent facts are skipped; 1 in 4 is review.
export function pickFact(pools, stats, recent = [], rng = Math.random) {
  let pool = pools.review.length && rng() < 0.25 ? pools.review : pools.focus;
  const fresh = pool.filter(f => !recent.includes(fkey(f)));
  if (fresh.length) pool = fresh;
  const weights = pool.map(f => WEIGHT[classify(stats[fkey(f)])]);
  let r = rng() * weights.reduce((x, y) => x + y, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Four answer choices: the right one plus three believable decoys.
// Multiplication decoys come from neighbouring facts; addition and subtraction decoys are near misses.
export function makeChoices(fact, rng = Math.random) {
  const { a, b } = fact;
  const ans = answerOf(fact);
  let near, far;
  if ((fact.op || 'mul') === 'mul') {
    near = [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b];
    far = [(a + 1) * (b + 1), (a - 1) * (b - 1), a * (b + 2), (a + 2) * b, a + b, ans + 1, ans - 1, ans + 2];
  } else {
    near = [ans + 1, ans - 1, ans + 2, ans - 2];
    far = [ans + 10, ans - 10, ans + 3, ans - 3];
  }
  const picks = [];
  for (const v of [...shuffle(near, rng), ...shuffle(far, rng)]) {
    if (picks.length === 3) break;
    if (v > 0 && v !== ans && !picks.includes(v)) picks.push(v);
  }
  for (let k = 3; picks.length < 3; k++) if (!picks.includes(ans + k)) picks.push(ans + k);
  return shuffle([ans, ...picks], rng);
}

export const multFor = streak => Math.min(5, 1 + Math.floor(streak / 3));

// timeLeft: fraction of the fall still remaining (1 = instant answer). streak includes this answer.
export function scoreFor(timeLeft, streak) {
  const f = Math.max(0, Math.min(1, timeLeft));
  return Math.round((100 + 100 * f) * multFor(streak) / 10) * 10;
}

export function starsFor(completed, misses) {
  if (!completed) return 0;
  if (misses === 0) return 3;
  return misses <= 2 ? 2 : 1;
}

const RANKS = [[0, 'Cadet'], [5, 'Pilot'], [11, 'Captain'], [17, 'Commander']];
export function rankFor(stars) {
  let name = RANKS[0][1];
  for (const [min, n] of RANKS) if (stars >= min) name = n;
  return name;
}

const BASE = { slow: 11, medium: 9, fast: 7 };
const KID = { slow: 1.35, medium: 1, fast: 0.75 };
// Seconds an asteroid takes to fall. wave is 1-based.
export function fallSeconds(missionSpeed, kidSpeed, wave) {
  return BASE[missionSpeed] * KID[kidSpeed] * (1 - 0.1 * (wave - 1));
}

// through: index of the highest mission a grown-up has opened by hand (0 = only the first).
export function isUnlocked(missions, i, progress, through = 0) {
  if (i <= through) return true;
  return (progress[missions[i - 1].id]?.stars || 0) >= 1;
}

// One mission's run: which fact comes next, shields, waves, score. Scenes draw it and feed it answers.
// days (optional): per-day tallies for the grown-up progress view, filled as answers come in.
export function createSession({ pools, stats, days, today = dayKey, rng = Math.random }) {
  const g = { wave: 1, q: 0, score: 0, streak: 0, shields: MAX_SHIELDS, asked: 0, right: 0, misses: [], bonus: false, credit: 1 };
  let pending = [], recent = [];
  let run = 0, need = BONUS_FIRST; // quick answers in a row, and how many earn the next bonus question
  return {
    g,
    // -> { type: 'fact', fact } | { type: 'wave' } (new wave started, one shield restored) | { type: 'done' }
    advance() {
      if (g.q >= PER_WAVE) {
        if (g.wave >= WAVES) return { type: 'done' };
        g.wave++; g.q = 0;
        g.shields = Math.min(MAX_SHIELDS, g.shields + 1);
        return { type: 'wave' };
      }
      pending.forEach(x => x.due--);
      const i = pending.findIndex(x => x.due <= 0);
      const fact = i >= 0 ? pending.splice(i, 1)[0].fact : pickFact(pools, stats, recent, rng);
      recent = [...recent, fkey(fact)].slice(-3);
      g.asked++;
      g.bonus = run >= need;
      if (g.bonus) { run = 0; need = BONUS_NEXT; }
      return { type: 'fact', fact, bonus: g.bonus };
    },
    // timeLeft: fraction of the time still remaining. Returns the points scored.
    correct(fact, ms, timeLeft) {
      recordAnswer(stats, fkey(fact), true, ms);
      if (days) recordDay(days, today(), fkey(fact), true, ms);
      const quick = timeLeft >= QUICK;
      g.credit = g.bonus && quick ? 2 : 1; // a quick right answer on a bonus question counts as two
      run = g.bonus ? 0 : quick ? run + 1 : 0;
      g.streak++; g.right++;
      g.q = Math.min(PER_WAVE, g.q + g.credit);
      const pts = scoreFor(timeLeft, g.streak) * g.credit;
      g.score += pts;
      return pts;
    },
    // Returns true when the shields are gone. The missed fact comes back two or three turns later.
    miss(fact) {
      recordAnswer(stats, fkey(fact), false, 0);
      if (days) recordDay(days, today(), fkey(fact), false, 0);
      g.streak = 0; g.shields--; g.q++;
      run = 0; need = BONUS_FIRST; g.credit = 1;
      g.misses.push(fact);
      pending.push({ fact, due: 2 + (rng() < 0.5 ? 1 : 0) });
      return g.shields <= 0;
    },
    result: completed => ({ completed, score: g.score, asked: g.asked, right: g.right, misses: g.misses }),
  };
}

// ---------- progress over time ----------
// days: { 'YYYY-MM-DD': { factKey: [seen, right, total ms of right answers] } }
const pad2 = n => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export function recordDay(days, day, k, correct, ms) {
  const d = days[day] || (days[day] = {});
  const r = d[k] || (d[k] = [0, 0, 0]);
  r[0]++;
  if (correct) { r[1]++; r[2] += Math.round(ms); }
}

// kind: 'day' | 'week' (Sunday to Saturday) | 'all'. offset: 0 = current, -1 = previous, and so on.
// Returns { from, to } as day keys (inclusive; null for 'all') and a label.
export function periodRange(kind, offset = 0, now = new Date()) {
  if (kind === 'all') return { from: null, to: null, label: 'All time' };
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fmt = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (kind === 'day') {
    start.setDate(start.getDate() + offset);
    const label = offset === 0 ? 'Today' : offset === -1 ? 'Yesterday' : start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return { from: dayKey(start), to: dayKey(start), label };
  }
  start.setDate(start.getDate() - start.getDay() + offset * 7);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { from: dayKey(start), to: dayKey(end), label: offset === 0 ? `This week (${fmt(start)} – ${fmt(end)})` : `${fmt(start)} – ${fmt(end)}` };
}

export const inRange = (day, range) => range.from === null || (day >= range.from && day <= range.to);

// Totals per fact over a period: { factKey: { seen, right, ms (average for right answers) } }
export function periodStats(days, range) {
  const out = {};
  for (const [day, facts] of Object.entries(days || {})) {
    if (!inRange(day, range)) continue;
    for (const [k, [seen, right, ms]] of Object.entries(facts)) {
      const s = out[k] || (out[k] = { seen: 0, right: 0, ms: 0 });
      s.seen += seen; s.right += right; s.ms += ms;
    }
  }
  for (const s of Object.values(out)) s.ms = s.right ? Math.round(s.ms / s.right) : 0;
  return out;
}

// Like classify, but judged only on what happened inside the period.
export function classifyPeriod(s) {
  if (!s || !s.seen) return 'new';
  const acc = s.right / s.seen;
  if (acc >= 0.9 && s.ms <= FAST_MS) return 'fast';
  return acc >= 0.7 ? 'slow' : 'missed';
}
