// Pure game rules: no DOM, no storage. Tested in test/logic.test.js.

export const key = (a, b) => `${a}x${b}`;
export const FAST_MS = 4000; // a right answer at or under this (on average) counts as "knows it fast"
export const WAVES = 3;
export const PER_WAVE = 10;
export const MAX_SHIELDS = 3;

const NAMES = ['Launch Pad', 'Moon Run', 'Red Planet', 'Asteroid Belt', 'Gas Giant', 'Ice Rings',
  'Comet Trail', 'Twin Suns', 'Nebula', 'Black Hole Rim', 'Star Forge'];

export function cleanTables(tables) {
  return [...new Set(tables)].filter(n => Number.isInteger(n) && n >= 1 && n <= 12).sort((a, b) => a - b);
}

// The largest "other" number a table gets multiplied by.
export function maxOther(tables) {
  return Math.max(5, ...cleanTables(tables));
}

// Mission map for a set of tables: one mission per table (x1 and x2 share one), then a mixed finale.
export function buildMissions(tables) {
  const t = cleanTables(tables);
  const groups = [];
  let rest = t;
  if (t.includes(1) && t.includes(2)) { groups.push([1, 2]); rest = t.filter(n => n > 2); }
  for (const n of rest) groups.push([n]);
  const missions = groups.map((g, i) => ({
    id: 't' + g.join('-'),
    name: NAMES[i % NAMES.length],
    label: g.map(n => '×' + n).join(' '),
    focus: g,
    review: groups.slice(0, i).flat().filter(n => i === 1 || n !== 1),
    speed: i < 2 ? 'slow' : 'medium',
  }));
  if (groups.length > 1) {
    const noOnes = t.filter(n => n !== 1);
    missions.push({ id: 'mix', name: 'Deep Space', label: 'All mixed', focus: noOnes.length ? noOnes : t, review: [], speed: 'fast' });
  }
  return missions;
}

// Every fact (both orders) where one number is a focus table. x1 facts only appear when 1 is a focus table.
export function factsFor(focus, max) {
  const out = new Map();
  for (const f of focus) {
    for (let o = 1; o <= max; o++) {
      if (o === 1 && !focus.includes(1)) continue;
      out.set(key(f, o), { a: f, b: o });
      out.set(key(o, f), { a: o, b: f });
    }
  }
  return [...out.values()];
}

export function missionPools(mission, tables) {
  const max = maxOther(tables);
  const focus = factsFor(mission.focus, max);
  const have = new Set(focus.map(f => key(f.a, f.b)));
  const review = factsFor(mission.review, max).filter(f => !have.has(key(f.a, f.b)));
  return { focus, review };
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
  const fresh = pool.filter(f => !recent.includes(key(f.a, f.b)));
  if (fresh.length) pool = fresh;
  const weights = pool.map(f => WEIGHT[classify(stats[key(f.a, f.b)])]);
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

// Four answer choices: the right one plus three believable decoys from neighbouring facts.
export function makeChoices(a, b, rng = Math.random) {
  const ans = a * b;
  const near = shuffle([a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b], rng);
  const far = shuffle([(a + 1) * (b + 1), (a - 1) * (b - 1), a * (b + 2), (a + 2) * b, a + b, ans + 1, ans - 1, ans + 2], rng);
  const picks = [];
  for (const v of [...near, ...far]) {
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
