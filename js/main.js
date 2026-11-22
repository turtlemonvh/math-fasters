// Screens and wiring: pilots, mission map, play, results, grown-up settings.
import * as L from './logic.js';
import { load, save, newProfile } from './store.js';
import { sfx, unlock, setSound } from './audio.js';
import { createGame } from './play.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = ['#ffb84d', '#4fd6c4', '#ff7a6b', '#b08cff', '#7fd0ff', '#ff8fd0'];
const ship = c => `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4l17 32H7z" fill="${c}"/><path d="M16 36h16l-8 9z" fill="#ff7a6b"/><circle cx="24" cy="25" r="4.5" fill="#0c1024"/></svg>`;
const shield = on => `<svg viewBox="0 0 24 26" aria-hidden="true"><path d="M2 2h20v12L12 24 2 14z" fill="${on ? '#4fd6c4' : 'none'}" stroke="${on ? '#4fd6c4' : '#34407a'}" stroke-width="2"/></svg>`;
const starRow = n => [0, 1, 2].map(i => `<span class="${i < n ? 'star-on' : 'star-off'}">★</span>`).join('');

let data = load();
setSound(data.sound);
let pilot = null, missions = [], mission = null, game = null, newColor = COLORS[0], armed = null;

const persist = () => save(data);
const totalStars = p => L.buildMissions(p.settings.tables).reduce((n, m) => n + (p.missions[m.id]?.stars || 0), 0);

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
  missions = L.buildMissions(pilot.settings.tables);
  const s = totalStars(pilot);
  $('#map-pilot').innerHTML = `${ship(pilot.color)}<div><div>${esc(pilot.name)}</div><div class="sub">${L.rankFor(s)} · ${s} ★</div></div>`;
  let nextMarked = false;
  $('#mission-list').innerHTML = missions.map((m, i) => {
    const open = L.isUnlocked(missions, i, pilot.missions, pilot.settings.unlockAll);
    const got = pilot.missions[m.id]?.stars || 0;
    const isNext = open && !got && !nextMarked;
    if (isNext) nextMarked = true;
    return `<button class="btn mission${isNext ? ' next' : ''}" data-act="play-mission" data-id="${m.id}" ${open ? '' : 'disabled'}>
      <span class="num">MISSION ${i + 1}</span><span>${open ? '' : '🔒 '}${m.name}</span><span class="facts">${m.label}</span><span class="stars">${starRow(got)}</span></button>`;
  }).join('');
  show('s-map');
}

// ---------- play ----------
function startMission(id) {
  mission = missions.find(m => m.id === id);
  if (!mission) return;
  game?.stop();
  $('#pause').hidden = true;
  show('s-play');
  game = createGame($('#game'), {
    mission,
    pools: L.missionPools(mission, pilot.settings.tables),
    stats: pilot.facts,
    kidSpeed: pilot.settings.speed,
    shipColor: pilot.color,
    onHud(g) {
      $('#hud-wave').textContent = `Wave ${g.wave} · ${Math.min(g.q + 1, L.PER_WAVE)}/${L.PER_WAVE}`;
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
  const before = L.rankFor(totalStars(pilot));
  const stars = L.starsFor(r.completed, r.misses.length);
  const rec = pilot.missions[mission.id] || (pilot.missions[mission.id] = { stars: 0, best: 0, plays: 0 });
  const newBest = r.score > rec.best;
  rec.stars = Math.max(rec.stars, stars);
  rec.best = Math.max(rec.best, r.score);
  rec.plays++;
  persist();
  const after = L.rankFor(totalStars(pilot));
  const idx = missions.findIndex(m => m.id === mission.id);
  const next = r.completed && missions[idx + 1];
  const missed = [...new Map(r.misses.map(m => [L.key(m.a, m.b), m])).values()];
  $('#result').innerHTML = `
    <h2>${r.completed ? 'Mission complete!' : 'Game over'}</h2>
    ${r.completed ? `<div class="stars">${starRow(stars)}</div>` : `<p class="muted">Your shields ran out. You can do it. Try again!</p>`}
    <div class="big">${r.score.toLocaleString()}</div>
    <p class="muted">${newBest && rec.plays > 1 ? 'New best score! ' : ''}You blasted ${r.right} of ${r.asked}.</p>
    ${after !== before ? `<p class="rankup">Promoted to ${after}!</p>` : ''}
    ${missed.length ? `<h3>Facts to remember</h3><ul class="missed">${missed.map(m => `<li>${m.a} × ${m.b} = ${m.ans}</li>`).join('')}</ul>` : ''}
    <div class="row">
      ${next ? `<button class="btn primary" data-act="play-mission" data-id="${next.id}">Next mission</button>` : ''}
      <button class="btn ${next ? '' : 'primary'}" data-act="play-mission" data-id="${mission.id}">${r.completed ? 'Play again' : 'Try again'}</button>
      <button class="btn ghost" data-act="to-map">Mission map</button>
    </div>`;
  show('s-result');
}

// ---------- grown-up settings ----------
function renderSettings() {
  const st = pilot.settings;
  const max = L.maxOther(st.tables);
  const cols = Array.from({ length: max }, (_, i) => i + 1);
  const chip = (act, val, on, text) => `<button class="chip" data-act="${act}" data-v="${val}" aria-pressed="${on}">${text}</button>`;
  $('#set-title').textContent = `Settings · ${pilot.name}`;
  $('#settings').innerHTML = `
    <section><h3>Tables in play</h3>
      <div class="chips">${Array.from({ length: 12 }, (_, i) => chip('toggle-table', i + 1, st.tables.includes(i + 1), i + 1)).join('')}</div>
      <p class="muted">Each table gets its own mission. Facts go up to ${max} × ${max}.</p></section>
    <section><h3>Speed</h3>
      <div class="chips">${['slow', 'medium', 'fast'].map(s => chip('set-speed', s, st.speed === s, s[0].toUpperCase() + s.slice(1))).join('')}</div></section>
    <section><h3>Options</h3>
      <div class="chips">
        ${chip('toggle-unlock', '', st.unlockAll, 'All missions unlocked')}
        ${chip('toggle-sound', '', data.sound, 'Sound (all pilots)')}
      </div></section>
    <section><h3>How ${esc(pilot.name)} is doing</h3>
      <div class="gridwrap"><table class="factgrid">
        <tr><th>×</th>${cols.map(c => `<th>${c}</th>`).join('')}</tr>
        ${st.tables.map(a => `<tr><th>${a}</th>${cols.map(b => {
          const s = pilot.facts[L.key(a, b)];
          return `<td class="c-${L.classify(s)}" title="${a} × ${b}: ${s ? `${s.right} of ${s.seen} right` : 'not seen yet'}">${s?.seen ? s.right : ''}</td>`;
        }).join('')}</tr>`).join('')}
      </table></div>
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
  'back-pilots': () => { pilot = null; renderPilots(); },
  'pick-color': el => { newColor = el.dataset.c; document.querySelectorAll('.swatch').forEach(s => s.setAttribute('aria-pressed', s.dataset.c === newColor)); },
  'pick-pilot': el => { pilot = data.profiles.find(p => p.id === el.dataset.id); if (pilot) renderMap(); },
  'play-mission': el => startMission(el.dataset.id),
  'to-map': renderMap,
  pause: pauseGame,
  resume: () => { $('#pause').hidden = true; game?.resume(); },
  quit: () => { game?.stop(); game = null; persist(); renderMap(); },
  'settings-done': () => { persist(); renderMap(); },
  'toggle-table': el => {
    const n = Number(el.dataset.v), t = pilot.settings.tables;
    if (t.includes(n)) { if (t.length > 1) pilot.settings.tables = t.filter(x => x !== n); }
    else pilot.settings.tables = L.cleanTables([...t, n]);
    persist(); renderSettings();
  },
  'set-speed': el => { pilot.settings.speed = el.dataset.v; persist(); renderSettings(); },
  'toggle-unlock': () => { pilot.settings.unlockAll = !pilot.settings.unlockAll; persist(); renderSettings(); },
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

// Grown-up gate: hold the gear for 2 seconds.
{
  const gear = $('#gear');
  let t = 0;
  const cancel = () => { clearTimeout(t); gear.classList.remove('holding'); };
  gear.addEventListener('pointerdown', e => {
    e.preventDefault();
    gear.classList.add('holding');
    t = setTimeout(() => { cancel(); unlock(); renderSettings(); }, 2000);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) gear.addEventListener(ev, cancel);
  gear.addEventListener('contextmenu', e => e.preventDefault());
  // Keyboard users: hold Enter or Space.
  gear.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) gear.dispatchEvent(new PointerEvent('pointerdown')); });
  gear.addEventListener('keyup', cancel);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape') pauseGame(); });

renderPilots();
