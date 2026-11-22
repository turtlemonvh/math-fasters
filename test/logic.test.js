import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';

const T7 = [1, 2, 3, 4, 5, 6, 7];

test('default mission map: seven missions ending in a mixed one', () => {
  const m = L.buildMissions(T7);
  assert.deepEqual(m.map(x => x.id), ['t1-2', 't3', 't4', 't5', 't6', 't7', 'mix']);
  assert.deepEqual(m[1].review, [1, 2]);
  assert.ok(!m[3].review.includes(1));
  assert.ok(!m[6].focus.includes(1));
});

test('facts stay within numbers up through 7 and skip x1 after the first missions', () => {
  const m = L.buildMissions(T7);
  for (const mission of m) {
    const { focus, review } = L.missionPools(mission, T7);
    for (const f of [...focus, ...review]) assert.ok(f.a >= 1 && f.a <= 7 && f.b >= 1 && f.b <= 7);
    assert.ok(focus.length >= 6);
  }
  const six = L.missionPools(m[4], T7).focus;
  assert.equal(six.length, 11); // 6x2..6x7 and 2x6..7x6, with 6x6 once
  assert.ok(!six.some(f => f.a === 1 || f.b === 1));
});

test('a single table still gives a usable set of facts', () => {
  const m = L.buildMissions([6]);
  assert.equal(m.length, 1);
  assert.ok(L.missionPools(m[0], [6]).focus.length >= 8);
});

test('choices: four unique positive numbers including the answer', () => {
  for (let a = 1; a <= 12; a++) for (let b = 1; b <= 12; b++) for (let i = 0; i < 20; i++) {
    const c = L.makeChoices({ a, b, op: 'mul' });
    assert.equal(c.length, 4);
    assert.equal(new Set(c).size, 4);
    assert.ok(c.includes(a * b));
    assert.ok(c.every(v => v > 0));
  }
});

test('missed facts are picked more often than known ones', () => {
  const pools = { focus: [{ a: 6, b: 7, op: 'mul' }, { a: 6, b: 2, op: 'mul' }], review: [] };
  const stats = {};
  for (let i = 0; i < 4; i++) L.recordAnswer(stats, '6x2', true, 1500);
  L.recordAnswer(stats, '6x7', false, 0);
  assert.equal(L.classify(stats['6x2']), 'fast');
  assert.equal(L.classify(stats['6x7']), 'missed');
  let hard = 0;
  for (let i = 0; i < 2000; i++) if (L.pickFact(pools, stats).b === 7) hard++;
  assert.ok(hard > 1500, `hard fact picked ${hard}/2000`);
});

test('recent facts are not repeated when there is a choice', () => {
  const pools = { focus: [{ a: 3, b: 2 }, { a: 3, b: 3 }], review: [] };
  for (let i = 0; i < 50; i++) assert.equal(L.pickFact(pools, {}, ['3x2']).b, 3);
});

test('classify: right but slow', () => {
  const stats = {};
  for (let i = 0; i < 4; i++) L.recordAnswer(stats, '4x4', true, 7000);
  assert.equal(L.classify(stats['4x4']), 'slow');
  assert.equal(L.classify(undefined), 'new');
});

test('score, stars, rank, speed, unlock', () => {
  assert.equal(L.scoreFor(1, 1), 200);
  assert.equal(L.scoreFor(0, 1), 100);
  assert.equal(L.scoreFor(1, 3), 400);
  assert.equal(L.multFor(99), 5);
  assert.equal(L.starsFor(false, 0), 0);
  assert.equal(L.starsFor(true, 0), 3);
  assert.equal(L.starsFor(true, 2), 2);
  assert.equal(L.starsFor(true, 4), 1);
  assert.equal(L.rankFor(0), 'Cadet');
  assert.equal(L.rankFor(11), 'Captain');
  assert.ok(L.fallSeconds('medium', 'medium', 3) < L.fallSeconds('medium', 'medium', 1));
  assert.ok(L.fallSeconds('slow', 'slow', 1) > L.fallSeconds('fast', 'fast', 1));
  const m = L.buildMissions(T7);
  assert.equal(L.isUnlocked(m, 0, {}, 0), true);
  assert.equal(L.isUnlocked(m, 1, {}, 0), false);
  assert.equal(L.isUnlocked(m, 1, { 't1-2': { stars: 1 } }, 0), true);
  assert.equal(L.isUnlocked(m, 4, {}, 4), true);
  assert.equal(L.isUnlocked(m, 5, {}, 4), false);
});

test('addition and subtraction: missions, facts and choices', () => {
  for (const op of ['add', 'sub']) {
    const m = L.buildMissions([], op);
    assert.equal(m.length, 6);
    assert.equal(new Set(m.map(x => x.id)).size, 6);
    for (const mission of m) {
      const { focus, review } = L.missionPools(mission, []);
      assert.ok(focus.length >= 10);
      for (const f of [...focus, ...review]) {
        const ans = L.answerOf(f);
        assert.ok(ans >= 1 && ans <= 20, L.factText(f));
        const c = L.makeChoices(f);
        assert.equal(new Set(c).size, 4);
        assert.ok(c.includes(ans) && c.every(v => v > 0));
      }
    }
  }
  assert.equal(L.fkey({ a: 6, b: 7 }), '6x7');
  assert.equal(L.fkey({ a: 13, b: 6, op: 'sub' }), '13-6');
  assert.equal(L.answerOf({ a: 13, b: 6, op: 'sub' }), 7);
  assert.equal(L.factText({ a: 6, b: 7, op: 'add' }), '6 + 7');
  assert.equal(L.gridFor('sub', []).rows[2].facts[3].a, 7);
});

test('session: three waves of ten, a miss comes back, shields restore and run out', () => {
  const pools = L.missionPools(L.buildMissions([1, 2, 3, 4, 5, 6, 7])[2], [1, 2, 3, 4, 5, 6, 7]);
  let s = L.createSession({ pools, stats: {} });
  let facts = 0, waves = 0, step, missed = null, cameBack = false;
  while ((step = s.advance()).type !== 'done') {
    if (step.type === 'wave') { waves++; continue; }
    facts++;
    if (missed && L.fkey(step.fact) === L.fkey(missed)) cameBack = true;
    if (facts === 2) { missed = step.fact; assert.equal(s.miss(step.fact), false); }
    else s.correct(step.fact, 1000, 0.5);
  }
  assert.equal(facts, 30);
  assert.equal(waves, 2);
  assert.ok(cameBack);
  assert.equal(s.g.shields, 3);
  assert.equal(s.result(true).right, 29);
  s = L.createSession({ pools, stats: {} });
  assert.equal(s.miss(s.advance().fact), false);
  assert.equal(s.miss(s.advance().fact), false);
  assert.equal(s.miss(s.advance().fact), true);
});

test('division follows the tables in play', () => {
  const T = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const m = L.buildMissions(T, 'div');
  assert.equal(m[0].id, 'div1-2');
  assert.equal(m.at(-1).id, 'divmix');
  assert.equal(m.length, 12);
  for (const mission of m) {
    for (const f of L.missionPools(mission, T).focus) {
      const ans = L.answerOf(f);
      assert.ok(Number.isInteger(ans) && ans >= 1 && ans <= 12, L.factText(f));
      assert.ok(mission.focus.includes(f.b));
      const c = L.makeChoices(f);
      assert.ok(new Set(c).size === 4 && c.includes(ans) && c.every(v => v > 0));
    }
  }
  const seven = L.missionPools(L.buildMissions([1, 2, 3, 4, 5, 6, 7], 'div')[5], [1, 2, 3, 4, 5, 6, 7]).focus;
  assert.deepEqual(seven.map(L.factText), ['14 ÷ 7', '21 ÷ 7', '28 ÷ 7', '35 ÷ 7', '42 ÷ 7', '49 ÷ 7']);
  assert.equal(L.fkey({ a: 42, b: 7, op: 'div' }), '42/7');
  assert.equal(L.gridFor('div', [6, 7]).rows[1].facts[2].a, 21);
});
