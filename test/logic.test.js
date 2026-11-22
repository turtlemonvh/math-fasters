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
    const c = L.makeChoices(a, b);
    assert.equal(c.length, 4);
    assert.equal(new Set(c).size, 4);
    assert.ok(c.includes(a * b));
    assert.ok(c.every(v => v > 0));
  }
});

test('missed facts are picked more often than known ones', () => {
  const pools = { focus: [{ a: 6, b: 7 }, { a: 6, b: 2 }], review: [] };
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
  assert.equal(L.isUnlocked(m, 0, {}, false), true);
  assert.equal(L.isUnlocked(m, 1, {}, false), false);
  assert.equal(L.isUnlocked(m, 1, { 't1-2': { stars: 1 } }, false), true);
  assert.equal(L.isUnlocked(m, 5, {}, true), true);
});
