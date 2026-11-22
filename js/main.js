// Screens and wiring: pilots, mission map, play, results, grown-up settings.
import * as L from './logic.js';
import { load, save, newProfile } from './store.js';
import { sfx, unlock, setSound } from './audio.js';
import { createGame } from './play.js';
import { createFuelGame } from './fuel.js';
import { createCaveGame } from './cave.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = ['#ffb84d', '#4fd6c4', '#ff7a6b', '#b08cff', '#7fd0ff', '#ff8fd0'];
const ship = c => `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4l17 32H7z" fill="${c}"/><path d="M16 36h16l-8 9z" fill="#ff7a6b"/><circle cx="24" cy="25" r="4.5" fill="#0c1024"/></svg>`;
const shield = on => `<svg viewBox="0 0 24 26" aria-hidden="true"><path d="M2 2h20v12L12 24 2 14z" fill="${on ? '#4fd6c4' : 'none'}" stroke="${on ? '#4fd6c4' : '#34407a'}" stroke-width="2"/></svg>`;
const starRow = n => [0, 1, 2].map(i => `<span class="${i < n ? 'star-on' : 'star-off'}">★</span>`).join('');

const SCENES = {
  blast: { name: 'Asteroid Blast', hint: 'Tap the answer', create: createGame },
  fuel: { name: 'Fuel-Up', hint: 'Type the answer', create: createFuelGame },
  cave: { name: 'Cave Flight', hint: 'Fly through the answer', create: createCaveGame },
};
const ALL_OPS = ['mul', 'div', 'add', 'sub'];

let data = load();
setSound(data.sound);
let pilot = null, missions = [], mission = null, game = null, newColor = COLORS[0], armed = null, freePick = [];

const persist = () => save(data);
const opsOf = p => (p.settings.ops?.length ? ALL_OPS.filter(o => p.settings.ops.includes(o)) : ['mul']);
// What the pilot last chose on the map: which kind of facts and which game.
function last() {
  const l = pilot.last || (pilot.last = { op: 'mul', scene: 'blast' });
  if (!opsOf(pilot).includes(l.op)) l.op = opsOf(pilot)[0];
  if (!SCENES[l.scene]) l.scene = 'blast';
  return l;
}
// Index of the highest mission a grown-up has opened by hand, per kind of fact.
function startAt(op) {
  const st = pilot.settings;
  if (st.unlockAll) return 99;
  return typeof st.startAt === 'number' ? (op === 'mul' ? st.startAt : 0) : (st.startAt?.[op] || 0);
}
const totalStars = p => ALL_OPS.reduce((n, op) => n + L.buildMissions(p.settings.tables, op).reduce((k, m) => k + (p.missions[m.id]?.stars || 0), 0), 0);
const chip = (act, val, on, text) => `<button class="chip" data-act="${act}" data-v="${val}" aria-pressed="${on}">${text}</button>`;

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  armed = null;
}

// ---------- pilots ----------
function renderPilots() {
  $('#pilot-list').innerHTML = data.profiles.map(p => {
    const s = totalStars(p);
    return `<button class="btn pilot" data-act="pick-pilot" data-id="${p.id}">${ship(p.color)}<span class="name">${esc(p.name)}</span><span class="sub">${L.rankFor(s)} · ${s} ★</span></button>`;
  }).join('') + `<button class="btn pilot add" data-act="new-pilot">+ Add a pilot</button>`;
  show('s-pilots');
}

function renderNew() {
  $('#new-name').value = '';
  $('#new-colors').innerHTML = COLORS.map(c => `<button type="button" class="swatch" data-act="pick-color" data-c="${c}" aria-pressed="${c === newColor}" aria-label="Ship colour">${ship(c)}</button>`).join('');
  show('s-new');
  $('#new-name').focus();
}

// ---------- mission map ----------
function renderMap() {
  const { op, scene } = last();
  const ops = opsOf(pilot);
  missions = L.buildMissions(pilot.settings.tables, op);
  const s = totalStars(pilot);
  $('#map-pilot').innerHTML = `${ship(pilot.color)}<div><div>${esc(pilot.name)}</div><div class="sub">${L.rankFor(s)} · ${s} ★</div></div>`;
  $('#map-ops').innerHTML = ops.length > 1 ? ops.map(o => chip('set-op', o, o === op, `${L.OPS[o].sym} ${L.OPS[o].name}`)).join('') : '';
  $('#map-scenes').innerHTML = Object.entries(SCENES).map(([id, sc]) => chip('set-scene', id, id === scene, `${sc.name}<small>${sc.hint}</small>`)).join('');
  let nextMarked = false;
  $('#mission-list').innerHTML = missions.map((m, i) => {
    const open = L.isUnlocked(missions, i, pilot.missions, startAt(op));
    const got = pilot.missions[m.id]?.stars || 0;
    const isNext = open && !got && !nextMarked;
    if (isNext) nextMarked = true;
    return `<button class="btn mission${isNext ? ' next' : ''}" data-act="play-mission" data-id="${m.id}" ${open ? '' : 'disabled'}>
      <span class="num">MISSION ${i + 1}</span><span>${open ? '' : '🔒 '}${m.name}</span><span class="facts">${m.label}</span><span class="stars">${starRow(got)}</span></button>`;
  }).join('') + `<button class="btn mission free" data-act="free"><span class="num">ANY TIME</span><span>Free practice</span><span class="facts">Pick your own numbers</span></button>`;
  show('s-map');
}

// ---------- free practice ----------
function freeNumbers() {
  return L.usesTables(last().op) ? L.cleanTables(pilot.settings.tables) : Array.from({ length: L.ADD_MAX }, (_, i) => i + 1);
}
function renderFree() {
  const { op } = last();
  const nums = freeNumbers();
  freePick = freePick.filter(n => nums.includes(n));
  $('#free-title').textContent = `Free practice · ${L.OPS[op].name}`;
  $('#free-nums').innerHTML = nums.map(n => chip('free-toggle', n, freePick.includes(n), L.OPS[op].sym + n)).join('');
  $('#free-go').disabled = !freePick.length;
  document.querySelectorAll('.screen').forEach(sc => sc.classList.toggle('active', sc.id === 's-free'));
}
function freeMission() {
  const { op } = last();
  const focus = [...freePick].sort((a, b) => a - b);
  return { id: 'free', op, name: 'Free practice', label: focus.map(n => L.OPS[op].sym + n).join(' '), focus, review: [], speed: 'medium' };
}

// ---------- play ----------
function startMission(id) {
  mission = id === 'free' ? freeMission() : missions.find(m => m.id === id);
  if (!mission || !mission.focus.length) return;
  game?.stop();
  const { scene } = last();
  $('#pause').hidden = true;
  $('#s-play').classList.toggle('fuel', scene === 'fuel');
  $('#keypad').hidden = scene !== 'fuel';
  show('s-play');
  game = SCENES[scene].create($('#game'), {
    mission,
    session: L.createSession({ pools: L.missionPools(mission, pilot.settings.tables), stats: pilot.facts }),
    kidSpeed: pilot.settings.speed,
    shipColor: pilot.color,
    keypad: $('#keypad'),
    onHud(g) {
      $('#hud-wave').textContent = `${scene === 'fuel' ? 'Stage' : 'Wave'} ${g.wave} · ${Math.min(g.q + 1, L.PER_WAVE)}/${L.PER_WAVE}`;
      $('#hud-score').textContent = g.score.toLocaleString();
      $('#hud-mult').textContent = g.mult > 1 ? `×${g.mult}` : '';
      $('#hud-shields').innerHTML = [0, 1, 2].map(i => shield(i < g.shields)).join('');
    },
    onFact(text, mood) {
      const c = $('#console');
      c.textContent = text;
      c.className = 'console ' + mood;
    },
    onSave: persist,
    onEnd: finishMission,
  });
  window.__game = game;
}

function pauseGame() {
  if (!game || !$('#s-play').classList.contains('active')) return;
  game.pause();
  $('#pause').hidden = false;
}

function finishMission(r) {
  game?.stop();
  game = null;
  const free = mission.id === 'free';
  const before = L.rankFor(totalStars(pilot));
  const stars = L.starsFor(r.completed, r.misses.length);
  let newBest = false;
  if (!free) {
    const rec = pilot.missions[mission.id] || (pilot.missions[mission.id] = { stars: 0, best: 0, plays: 0 });
    newBest = r.score > rec.best && rec.plays > 0;
    rec.stars = Math.max(rec.stars, stars);
    rec.best = Math.max(rec.best, r.score);
    rec.plays++;
  }
  persist();
  const after = L.rankFor(totalStars(pilot));
  const idx = missions.findIndex(m => m.id === mission.id);
  const next = !free && r.completed && missions[idx + 1];
  const missed = [...new Map(r.misses.map(f => [L.fkey(f), f])).values()];
  $('#result').innerHTML = `
    <h2>${r.completed ? (free ? 'Practice complete!' : 'Mission complete!') : 'Game over'}</h2>
    ${r.completed ? (free ? '' : `<div class="stars">${starRow(stars)}</div>`) : `<p class="muted">Your shields ran out. You can do it. Try again!</p>`}
    <div class="big">${r.score.toLocaleString()}</div>
    <p class="muted">${newBest ? 'New best score! ' : ''}You got ${r.right} of ${r.asked}.</p>
    ${after !== before ? `<p class="rankup">Promoted to ${after}!</p>` : ''}
    ${missed.length ? `<h3>Facts to remember</h3><ul class="missed">${missed.map(f => `<li>${L.factText(f)} = ${L.answerOf(f)}</li>`).join('')}</ul>` : ''}
    <div class="row">
      ${next ? `<button class="btn primary" data-act="play-mission" data-id="${next.id}">Next mission</button>` : ''}
      <button class="btn ${next ? '' : 'primary'}" data-act="play-mission" data-id="${mission.id}">${r.completed ? 'Play again' : 'Try again'}</button>
      <button class="btn ghost" data-act="to-map">Mission map</button>
    </div>`;
  show('s-result');
}

// ---------- grown-up settings ----------
function gridHtml(op) {
  const grid = L.gridFor(op, pilot.settings.tables);
  const inverse = op === 'sub' || op === 'div'; // rows are the number taken away or divided by; columns are the answer
  return `<div class="gridwrap"><table class="factgrid">
    <tr><th>${L.OPS[op].sym}</th>${grid.cols.map(c => `<th>${inverse ? '=' : ''}${c}</th>`).join('')}</tr>
    ${grid.rows.map(row => `<tr><th>${inverse ? L.OPS[op].sym : ''}${row.label}</th>${row.facts.map(f => {
      const s = pilot.facts[L.fkey(f)];
      return `<td class="c-${L.classify(s)}" title="${L.factText(f)}: ${s ? `${s.right} of ${s.seen} right` : 'not seen yet'}">${s?.seen ? s.right : ''}</td>`;
    }).join('')}</tr>`).join('')}
  </table></div>`;
}

function renderSettings() {
  const st = pilot.settings;
  const ops = opsOf(pilot);
  const max = L.maxOther(st.tables);
  $('#set-title').textContent = `Settings · ${pilot.name}`;
  $('#settings').innerHTML = `
    <section><h3>Kinds of facts</h3>
      <div class="chips">${ALL_OPS.map(o => chip('toggle-op', o, ops.includes(o), `${L.OPS[o].sym} ${L.OPS[o].name}`)).join('')}</div>
      <p class="muted">Addition and subtraction use the numbers 1 to ${L.ADD_MAX}.</p></section>
    ${ops.some(L.usesTables) ? `<section><h3>Times tables in play</h3>
      <div class="chips">${Array.from({ length: 12 }, (_, i) => chip('toggle-table', i + 1, st.tables.includes(i + 1), i + 1)).join('')}</div>
      <p class="muted">Each table gets its own mission, for multiplication and for division. Facts go up to ${max} × ${max}.</p></section>` : ''}
    <section><h3>Speed</h3>
      <div class="chips">${['slow', 'medium', 'fast'].map(s => chip('set-speed', s, st.speed === s, s[0].toUpperCase() + s.slice(1))).join('')}</div></section>
    <section><h3>Missions unlocked up to</h3>
      ${ops.map(op => {
        const ms = L.buildMissions(st.tables, op);
        const at = Math.min(startAt(op), ms.length - 1);
        return `<div class="chips">${ms.map((m, i) => `<button class="chip" data-act="set-start" data-op="${op}" data-v="${i}" aria-pressed="${at === i}">${i + 1} · ${m.label}</button>`).join('')}</div>`;
      }).join('')}
      <p class="muted">Missions up to this one are open right away. Later ones still unlock by earning a star.</p></section>
    <section><h3>Options</h3>
      <div class="chips">${chip('toggle-sound', '', data.sound, 'Sound (all pilots)')}</div></section>
    <section><h3>How ${esc(pilot.name)} is doing</h3>
      ${ops.map(gridHtml).join('')}
      <div class="legend"><span><i class="c-fast"></i>Knows it fast</span><span><i class="c-slow"></i>Getting there</span><span><i class="c-missed"></i>Often missed</span><span><i class="c-new"></i>Not seen yet</span></div>
      <p class="muted">The number in each square is how many times it was answered right.</p></section>
    <section><h3>Careful</h3>
      <div class="row" style="justify-content:flex-start">
        <button class="btn danger small" data-act="reset">${armed === 'reset' ? 'Tap again to erase progress' : 'Reset progress'}</button>
        <button class="btn danger small" data-act="delete">${armed === 'delete' ? 'Tap again to delete pilot' : 'Delete this pilot'}</button>
      </div></section>`;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 's-settings'));
}

// ---------- actions ----------
const actions = {
  'new-pilot': renderNew,
  gate: () => { $('#gate-pass').value = ''; $('#gate-msg').textContent = ''; show('s-gate'); $('#gate-pass').focus(); },
  'back-pilots': () => { pilot = null; renderPilots(); },
  'pick-color': el => { newColor = el.dataset.c; document.querySelectorAll('.swatch').forEach(s => s.setAttribute('aria-pressed', s.dataset.c === newColor)); },
  'pick-pilot': el => { pilot = data.profiles.find(p => p.id === el.dataset.id); if (pilot) renderMap(); },
  'set-op': el => { last().op = el.dataset.v; freePick = []; persist(); renderMap(); },
  'set-scene': el => { last().scene = el.dataset.v; persist(); renderMap(); },
  free: () => { if (!freePick.length) freePick = freeNumbers().slice(-1); renderFree(); },
  'free-toggle': el => {
    const n = Number(el.dataset.v);
    freePick = freePick.includes(n) ? freePick.filter(x => x !== n) : [...freePick, n];
    renderFree();
  },
  'play-mission': el => startMission(el.dataset.id),
  'to-map': renderMap,
  pause: pauseGame,
  resume: () => { $('#pause').hidden = true; game?.resume(); },
  quit: () => { game?.stop(); game = null; persist(); renderMap(); },
  'settings-done': () => { persist(); renderMap(); },
  'toggle-op': el => {
    const o = el.dataset.v, cur = opsOf(pilot);
    pilot.settings.ops = cur.includes(o) ? (cur.length > 1 ? cur.filter(x => x !== o) : cur) : [...cur, o];
    persist(); renderSettings();
  },
  'toggle-table': el => {
    const n = Number(el.dataset.v), t = pilot.settings.tables;
    if (t.includes(n)) { if (t.length > 1) pilot.settings.tables = t.filter(x => x !== n); }
    else pilot.settings.tables = L.cleanTables([...t, n]);
    persist(); renderSettings();
  },
  'set-speed': el => { pilot.settings.speed = el.dataset.v; persist(); renderSettings(); },
  'set-start': el => {
    const st = pilot.settings;
    st.startAt = { ...Object.fromEntries(ALL_OPS.map(o => [o, startAt(o) === 99 ? 0 : startAt(o)])), [el.dataset.op]: Number(el.dataset.v) };
    st.unlockAll = false;
    persist(); renderSettings();
  },
  'toggle-sound': () => { data.sound = !data.sound; setSound(data.sound); persist(); renderSettings(); },
  reset: () => {
    if (armed !== 'reset') { armed = 'reset'; return renderSettings(); }
    pilot.missions = {}; pilot.facts = {}; armed = null; persist(); renderSettings();
  },
  delete: () => {
    if (armed !== 'delete') { armed = 'delete'; return renderSettings(); }
    data.profiles = data.profiles.filter(p => p !== pilot); pilot = null; persist(); renderPilots();
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  unlock(); sfx.click();
  actions[el.dataset.act]?.(el);
});

$('#new-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#new-name').value.trim();
  if (!name) return;
  unlock();
  pilot = newProfile(name, newColor);
  data.profiles.push(pilot);
  persist();
  renderMap();
});

// Grown-up gate: a simple password keeps kids out of settings. It is not real security.
const PARENT_PASSWORD = 'faster';
$('#gate-form').addEventListener('submit', e => {
  e.preventDefault();
  if ($('#gate-pass').value.trim().toLowerCase() === PARENT_PASSWORD) { $('#gate-pass').blur(); renderSettings(); }
  else { $('#gate-msg').textContent = 'That is not the password. Try again.'; $('#gate-pass').value = ''; }
});

document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape') pauseGame(); });

renderPilots();
