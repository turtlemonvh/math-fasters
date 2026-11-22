// Screens and wiring: pilots, mission map, play, results, grown-up settings.
import * as L from './logic.js';
import { load, save, newProfile } from './store.js';
import { sfx, unlock, setSound, setRich } from './audio.js';
import { fxOf, robotSvg, starChartSvg, FX_LABELS, EXTRAS } from './fx.js';
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
  blast: { name: 'Asteroid Blast', hint: 'Tap the answer', lead: 'Blast through', create: createGame },
  fuel: { name: 'Fuel-Up', hint: 'Type the answer', lead: 'Fuel up at', create: createFuelGame },
  cave: { name: 'Cave Flight', hint: 'Fly through the answer', lead: 'Fly the caves of', create: createCaveGame },
};
const ALL_OPS = ['mul', 'div', 'add', 'sub'];
const OP_COLOR = { mul: '#ffb84d', div: '#b08cff', add: '#4fd6c4', sub: '#7fd0ff' };
const LOG_MAX = 400;

let data = load();
setSound(data.sound);
let pilot = null, missions = [], mission = null, game = null, newColor = COLORS[0], freePick = [], startedAt = 0;
// grown-up screen state
let setTab = 'settings', period = { kind: 'week', offset: 0 }, viewOp = null;

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
const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
}
function setBuddy(mood) {
  const b = $('#buddy');
  b.hidden = !pilot || !fxOf(pilot).robot;
  if (!b.hidden && b.dataset.mood !== mood) { b.dataset.mood = mood; b.innerHTML = robotSvg(mood); }
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
  const fx = fxOf(pilot);
  setRich(fx.sounds);
  missions = L.buildMissions(pilot.settings.tables, op);
  const s = totalStars(pilot);
  $('#s-map').style.setProperty('--op', OP_COLOR[op]);
  $('#map-pilot').innerHTML = `${ship(pilot.color)}<div><div>${esc(pilot.name)}</div><div class="sub">${L.rankFor(s)} · ${s} ★</div></div>`;
  $('#map-ops').innerHTML = ops.length > 1 ? ops.map(o => chip('set-op', o, o === op, `${L.OPS[o].sym} ${L.OPS[o].name}`)).join('') : '';
  $('#map-scenes').innerHTML = Object.entries(SCENES).map(([id, sc]) => chip('set-scene', id, id === scene, `${sc.name}<small>${sc.hint}</small>`)).join('');
  $('#map-title').innerHTML = `${SCENES[scene].lead} <span>${L.SECTORS[op]}</span>`;
  let nextMarked = false;
  const items = missions.map((m, i) => {
    const open = L.isUnlocked(missions, i, pilot.missions, startAt(op));
    const stars = pilot.missions[m.id]?.stars || 0;
    const next = open && !stars && !nextMarked;
    if (next) nextMarked = true;
    return { ...m, i, open, stars, next };
  });
  const free = `<button class="btn mission free" data-act="free"><span class="num">ANY TIME</span><span>Free practice</span><span class="facts">Pick your own numbers</span></button>`;
  const list = $('#mission-list');
  list.classList.toggle('chartmode', fx.chart);
  list.innerHTML = fx.chart
    ? `<div class="chartbox">${starChartSvg(items, OP_COLOR[op])}</div>` + free
    : items.map(m => `<button class="btn mission${m.next ? ' next' : ''}" data-act="play-mission" data-id="${m.id}" ${m.open ? '' : 'disabled'}>
      <span class="num">MISSION ${m.i + 1}</span><span>${m.open ? '' : '🔒 '}${m.name}</span><span class="facts">${m.label}</span><span class="stars">${starRow(m.stars)}</span></button>`).join('') + free;
  show('s-map');
  if (fx.chart) {
    // The chart scrolls inside its own window, centred on the next mission, so the page itself never jumps.
    const box = list.querySelector('.chartbox');
    const target = list.querySelector('.pulse') || [...list.querySelectorAll('.planet:not(.locked)')].pop();
    if (box && target) {
      const t = target.getBoundingClientRect(), b = box.getBoundingClientRect();
      box.scrollTop += t.top + t.height / 2 - (b.top + b.height / 2);
    }
  }
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
  show('s-free');
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
  const fx = fxOf(pilot);
  pilot.days = pilot.days || {};
  startedAt = Date.now();
  $('#pause').hidden = true;
  $('#s-play').classList.toggle('fuel', scene === 'fuel');
  $('#s-play').classList.toggle('flames', fx.flames);
  $('#keypad').hidden = scene !== 'fuel';
  setBuddy('ready');
  show('s-play');
  game = SCENES[scene].create($('#game'), {
    mission,
    session: L.createSession({ pools: L.missionPools(mission, pilot.settings.tables), stats: pilot.facts, days: pilot.days }),
    kidSpeed: pilot.settings.speed,
    shipColor: pilot.color,
    keypad: $('#keypad'),
    fx,
    onHud(g) {
      $('#hud-wave').textContent = `${scene === 'fuel' ? 'Stage' : 'Wave'} ${g.wave} · ${Math.min(g.q + 1, L.PER_WAVE)}/${L.PER_WAVE}`;
      $('#hud-score').textContent = g.score.toLocaleString();
      $('#hud-mult').textContent = g.mult > 1 ? `×${g.mult}` : '';
      $('#hud-mult').classList.toggle('hot', g.streak >= 3);
      $('#hud-shields').innerHTML = [0, 1, 2].map(i => shield(i < g.shields)).join('');
      $('#s-play').classList.toggle('bonus', !!g.bonus);
    },
    onFact(text, mood) {
      const c = $('#console');
      c.className = 'console ' + mood;
      const cut = text.lastIndexOf('= ');
      // After a miss, box the right answer so it stands out.
      if (mood === 'bad' && cut > 0) c.innerHTML = `${esc(text.slice(0, cut + 2))}<span class="ans">${esc(text.slice(cut + 2))}</span>`;
      else c.textContent = text;
      setBuddy(mood === 'good' ? 'cheer' : mood === 'bad' ? 'oops' : 'ready');
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
  const missed = [...new Map(r.misses.map(f => [L.fkey(f), f])).values()];
  // mission log entry for the grown-up view
  pilot.log = pilot.log || [];
  pilot.log.push({
    t: Date.now(), op: mission.op || 'mul', scene: last().scene, name: mission.name, label: mission.label,
    done: r.completed, stars: free ? null : stars, score: r.score, asked: r.asked, right: r.right,
    secs: Math.round((Date.now() - startedAt) / 1000), missed: missed.map(f => `${L.factText(f)} = ${L.answerOf(f)}`),
  });
  if (pilot.log.length > LOG_MAX) pilot.log = pilot.log.slice(-LOG_MAX);
  persist();
  const after = L.rankFor(totalStars(pilot));
  const idx = missions.findIndex(m => m.id === mission.id);
  const next = !free && r.completed && missions[idx + 1];
  $('#result').innerHTML = `
    ${fxOf(pilot).robot ? `<div class="buddy big">${robotSvg(r.completed ? 'cheer' : 'oops')}</div>` : ''}
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

// ---------- grown-up screen: settings, progress, mission log ----------
const logDay = e => L.dayKey(new Date(e.t));
const mins = secs => (secs < 90 ? `${secs} sec` : `${Math.round(secs / 60)} min`);
const sceneName = id => SCENES[id]?.name || id;

function gridHtml(op, stats, classify) {
  const grid = L.gridFor(op, pilot.settings.tables);
  const inverse = op === 'sub' || op === 'div'; // rows are the number taken away or divided by; columns are the answer
  return `<div class="gridwrap"><table class="factgrid"><caption>${L.OPS[op].name}</caption>
    <tr><th>${L.OPS[op].sym}</th>${grid.cols.map(c => `<th>${inverse ? '=' : ''}${c}</th>`).join('')}</tr>
    ${grid.rows.map(row => `<tr><th>${inverse ? L.OPS[op].sym : ''}${row.label}</th>${row.facts.map(f => {
      const s = stats[L.fkey(f)];
      return `<td class="c-${classify(s)}" title="${L.factText(f)}: ${s ? `${s.right} of ${s.seen} right` : 'not seen'}">${s?.seen ? s.right : ''}</td>`;
    }).join('')}</tr>`).join('')}
  </table></div>`;
}

function settingsTab() {
  const st = pilot.settings;
  const ops = opsOf(pilot);
  const fx = fxOf(pilot);
  const max = L.maxOther(st.tables);
  const fxChip = k => chip('toggle-fx', k, fx[k], FX_LABELS[k]);
  return `
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
    <section><h3>Look</h3>
      <div class="chips">${fxChip('robot')}${fxChip('rocky')}</div>
      <p class="muted">Turn these off for the plain look, which runs best on older tablets.</p></section>
    <section><h3>Extra effects</h3>
      <div class="chips">${EXTRAS.map(fxChip).join('')}</div>
      <div class="chips"><button class="chip" data-act="fx-all" data-v="1">All on</button><button class="chip" data-act="fx-all" data-v="">All off</button></div>
      <p class="muted">More to see and hear. Off to start; switch on what suits ${esc(pilot.name)}.</p></section>
    <section><h3>Sound</h3>
      <div class="chips">${chip('toggle-sound', '', data.sound, 'Sound on (all pilots)')}</div></section>
    <section><h3>Careful</h3>
      <label for="confirm-name">To erase progress or delete this pilot, first type the pilot's name: ${esc(pilot.name)}</label>
      <input id="confirm-name" type="text" autocomplete="off" autocapitalize="none" spellcheck="false">
      <div class="row" style="justify-content:flex-start">
        <button class="btn danger small" data-act="reset" data-needs-name disabled>Erase progress</button>
        <button class="btn danger small" data-act="delete" data-needs-name disabled>Delete this pilot</button>
      </div>
      <p class="muted">Erasing progress clears stars, the fact grids and the mission log. Settings are kept.</p></section>`;
}

function progressTab() {
  const ops = opsOf(pilot);
  const range = L.periodRange(period.kind, period.offset);
  const all = period.kind === 'all';
  const stats = all ? pilot.facts : L.periodStats(pilot.days, range);
  const classify = all ? L.classify : L.classifyPeriod;
  const log = (pilot.log || []).filter(e => L.inRange(logDay(e), range));
  const asked = log.reduce((n, e) => n + e.asked, 0), right = log.reduce((n, e) => n + e.right, 0), secs = log.reduce((n, e) => n + e.secs, 0);
  if (viewOp !== 'all' && !ops.includes(viewOp)) viewOp = ops[0];
  const firstDay = Object.keys(pilot.days || {}).sort()[0];
  return `
    <section>
      <div class="chips">${[['day', 'Day'], ['week', 'Week'], ['all', 'All time']].map(([k, t]) => chip('set-period', k, period.kind === k, t)).join('')}</div>
      <div class="pager">
        <button class="btn small" data-act="page" data-v="-1" ${all ? 'disabled' : ''} aria-label="Earlier">‹</button>
        <strong>${range.label}</strong>
        <button class="btn small" data-act="page" data-v="1" ${all || period.offset >= 0 ? 'disabled' : ''} aria-label="Later">›</button>
      </div>
      <p class="summary">${log.length ? `<b>${log.length}</b> ${log.length === 1 ? 'mission' : 'missions'} · <b>${right}</b> of ${asked} right (${Math.round(100 * right / asked)}%) · <b>${mins(secs)}</b> played` : 'No missions played in this period.'}</p>
    </section>
    <section>
      ${ops.length > 1 ? `<div class="chips">${ops.map(o => chip('view-op', o, viewOp === o, `${L.OPS[o].sym} ${L.OPS[o].name}`)).join('')}${chip('view-op', 'all', viewOp === 'all', 'Show all')}</div>` : ''}
      <div class="grids">${(viewOp === 'all' ? ops : [viewOp]).map(o => gridHtml(o, stats, classify)).join('')}</div>
      <div class="legend"><span><i class="c-fast"></i>${all ? 'Knows it fast' : 'Right and fast'}</span><span><i class="c-slow"></i>${all ? 'Getting there' : 'Mostly right'}</span><span><i class="c-missed"></i>Often missed</span><span><i class="c-new"></i>Not seen</span></div>
      <p class="muted">The number in each square is how many times it was answered right${all ? '' : ' in this period'}.${!all && firstDay ? ` Day-by-day history starts on ${firstDay}.` : ''}${!all && !firstDay ? ' Day-by-day history starts with the next mission played.' : ''}</p>
    </section>`;
}

function logSummaryText() {
  const byDay = new Map();
  for (const e of pilot.log || []) { const d = logDay(e); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(e); }
  const lines = [`Math Fasters summary for ${pilot.name}`];
  for (const [d, es] of [...byDay].sort().reverse()) {
    const asked = es.reduce((n, e) => n + e.asked, 0), right = es.reduce((n, e) => n + e.right, 0), secs = es.reduce((n, e) => n + e.secs, 0);
    const missed = [...new Set(es.flatMap(e => e.missed))];
    lines.push(`${d}: ${es.length} missions, ${right}/${asked} right, ${mins(secs)}${missed.length ? `. Missed: ${missed.join('; ')}` : ''}`);
  }
  return lines.join('\n');
}
function logCsv() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['date', 'time', 'facts', 'game', 'mission', 'numbers', 'finished', 'stars', 'score', 'right', 'asked', 'seconds', 'missed']];
  for (const e of pilot.log || []) {
    const d = new Date(e.t);
    rows.push([logDay(e), d.toTimeString().slice(0, 5), L.OPS[e.op].name, sceneName(e.scene), e.name, e.label, e.done ? 'yes' : 'no', e.stars ?? '', e.score, e.right, e.asked, e.secs, e.missed.join('; ')]);
  }
  return rows.map(r => r.map(q).join(',')).join('\n');
}

function logTab() {
  const log = [...(pilot.log || [])].reverse().slice(0, 200);
  let day = '';
  return `
    <section>
      <div class="row" style="justify-content:flex-start">
        <button class="btn small" data-act="log-copy" ${log.length ? '' : 'disabled'}>Copy summary</button>
        <button class="btn small" data-act="log-csv" ${log.length ? '' : 'disabled'}>Download spreadsheet (CSV)</button>
      </div>
      <p id="log-msg" class="muted" aria-live="polite">${log.length ? 'Every mission played on this device, newest first.' : 'No missions yet. Each mission played from now on is listed here.'}</p>
    </section>
    <section class="log">${log.map(e => {
      const d = logDay(e), head = d !== day ? `<h3>${new Date(e.t).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h3>` : '';
      day = d;
      return `${head}<div class="logrow">
        <div><b>${esc(e.name)}</b> <span class="muted">${esc(e.label)} · ${sceneName(e.scene)} · ${new Date(e.t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span></div>
        <div>${e.done ? (e.stars === null ? 'Practice done' : starRow(e.stars)) : '<span class="bad">Game over</span>'} · ${e.right}/${e.asked} right · ${e.score.toLocaleString()} pts · ${mins(e.secs)}</div>
        ${e.missed.length ? `<div class="muted">Missed: ${e.missed.map(esc).join(', ')}</div>` : ''}
      </div>`;
    }).join('')}</section>`;
}

function renderSettings() {
  $('#set-title').textContent = pilot.name;
  $('#set-tabs').innerHTML = [['settings', 'Settings'], ['progress', 'Progress'], ['log', 'Mission log']].map(([k, t]) => chip('set-tab', k, setTab === k, t)).join('');
  $('#settings').innerHTML = setTab === 'progress' ? progressTab() : setTab === 'log' ? logTab() : settingsTab();
  show('s-settings');
}

// ---------- actions ----------
const nameConfirmed = () => sameName($('#confirm-name')?.value || '', pilot.name);
const actions = {
  'new-pilot': renderNew,
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
  'set-tab': el => { setTab = el.dataset.v; renderSettings(); },
  'set-period': el => { period = { kind: el.dataset.v, offset: 0 }; renderSettings(); },
  page: el => { period.offset = Math.min(0, period.offset + Number(el.dataset.v)); renderSettings(); },
  'view-op': el => { viewOp = el.dataset.v; renderSettings(); },
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
  'toggle-fx': el => {
    const fx = fxOf(pilot);
    pilot.settings.fx = { ...fx, [el.dataset.v]: !fx[el.dataset.v] };
    setRich(pilot.settings.fx.sounds);
    persist(); renderSettings();
    if (el.dataset.v === 'sounds' && pilot.settings.fx.sounds) sfx.laser(); // a taste of the richer set
  },
  'fx-all': el => {
    pilot.settings.fx = { ...fxOf(pilot), ...Object.fromEntries(EXTRAS.map(k => [k, !!el.dataset.v])) };
    setRich(pilot.settings.fx.sounds);
    persist(); renderSettings();
  },
  'toggle-sound': () => { data.sound = !data.sound; setSound(data.sound); persist(); renderSettings(); },
  reset: () => {
    if (!nameConfirmed()) return;
    pilot.missions = {}; pilot.facts = {}; pilot.days = {}; pilot.log = [];
    persist(); renderSettings();
  },
  delete: () => {
    if (!nameConfirmed()) return;
    data.profiles = data.profiles.filter(p => p !== pilot); pilot = null; persist(); renderPilots();
  },
  'log-copy': async () => {
    try { await navigator.clipboard.writeText(logSummaryText()); $('#log-msg').textContent = 'Summary copied. Paste it into a note or message.'; }
    catch { $('#log-msg').textContent = 'Copying is blocked in this browser. Use the spreadsheet download.'; }
  },
  'log-csv': () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([logCsv()], { type: 'text/csv' }));
    a.download = `math-fasters-${pilot.name.replace(/[^\w-]+/g, '_')}-${L.dayKey()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    $('#log-msg').textContent = 'Spreadsheet saved to this device\'s downloads.';
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  unlock(); sfx.click();
  actions[el.dataset.act]?.(el);
});
// Star-chart planets are SVG groups, so give them Enter/Space like buttons.
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('g[data-act]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
});
// The erase and delete buttons unlock only while the typed name matches.
document.addEventListener('input', e => {
  if (e.target.id !== 'confirm-name') return;
  document.querySelectorAll('[data-needs-name]').forEach(b => { b.disabled = !nameConfirmed(); });
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
    cancel();
    gear.classList.add('holding');
    t = setTimeout(() => { cancel(); unlock(); setTab = 'settings'; renderSettings(); }, 2000);
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
