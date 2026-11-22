// Optional looks and effects. Each one is switched per pilot in grown-up settings,
// and the plain versions in the scene files remain the fallback for older devices.

const C = { amber: '#ffb84d', teal: '#4fd6c4', coral: '#ff7a6b', ink: '#eef0fb', muted: '#a9b1d6', deep: '#0c1024', line: '#34407a' };
const TAU = Math.PI * 2;

export const FX_DEFAULTS = { robot: true, rocky: true, sounds: false, flames: false, chunks: false, chart: false };
export const EXTRAS = ['sounds', 'flames', 'chunks', 'chart']; // the "rich sensory" group, off to start
export const FX_LABELS = {
  robot: 'Tock the robot co-pilot', rocky: 'Rocky asteroids',
  sounds: 'Rich sounds', flames: 'Streak flames', chunks: 'Chunky explosions', chart: 'Star-chart mission map',
};
export const fxOf = pilot => ({ ...FX_DEFAULTS, ...(pilot?.settings?.fx || {}) });

// ---------- Tock the robot (SVG, viewBox 0 0 120 130). mood: 'ready' | 'cheer' | 'oops' ----------
const ST = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';
function star(x, y, s, fill) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.45 : s;
    d += `${i ? 'L' : 'M'}${(x + Math.cos(a) * r).toFixed(1)} ${(y + Math.sin(a) * r).toFixed(1)}`;
  }
  return `<path d="${d}Z" fill="${fill}"/>`;
}
export function robotSvg(mood = 'ready') {
  const up = mood === 'cheer', bad = mood === 'oops', lamp = bad ? C.coral : C.amber;
  const arms = up ? [[38, 90, 22, 68], [82, 90, 98, 68]] : bad ? [[38, 92, 29, 110], [82, 92, 91, 110]] : [[38, 90, 25, 102], [82, 90, 95, 102]];
  const eyes = up ? `<path d="M41 51q7-10 14 0M65 51q7-10 14 0" stroke="${C.amber}" stroke-width="4" ${ST}/>`
    : bad ? `<path d="M42 43l10 5-10 5M78 43l-10 5 10 5" stroke="${C.coral}" stroke-width="4" ${ST}/>`
    : `<circle cx="48" cy="48" r="6" fill="${C.amber}"/><circle cx="72" cy="48" r="6" fill="${C.amber}"/>`;
  const mouth = up ? `<path d="M49 56h22q-11 13-22 0z" fill="${C.amber}"/>`
    : bad ? `<path d="M48 61q4-5 8 0t8 0 8 0" stroke="${C.coral}" stroke-width="3" ${ST}/>`
    : `<path d="M52 59q8 5 16 0" stroke="${C.amber}" stroke-width="3" ${ST}/>`;
  return `<svg viewBox="0 0 120 130" role="img" aria-label="Tock the robot">${up ? star(22, 22, 7, C.amber) + star(100, 30, 5, C.teal) : ''}` +
    `<ellipse cx="60" cy="121" rx="${up ? 13 : 10}" ry="4" fill="${lamp}" opacity=".75"/>` +
    `<path d="M60 23${bad ? 'q1-9 9-10' : 'v-12'}" stroke="${C.muted}" stroke-width="3" ${ST}/>` +
    `<circle cx="${bad ? 70 : 60}" cy="${bad ? 12 : 9}" r="${up ? 6.5 : 5}" fill="${lamp}"/>` +
    arms.map(p => `<path d="M${p[0]} ${p[1]}L${p[2]} ${p[3]}" stroke="#3aa99b" stroke-width="7" ${ST}/><circle cx="${p[2]}" cy="${p[3]}" r="6" fill="${C.ink}"/>`).join('') +
    `<rect x="38" y="80" width="44" height="32" rx="11" fill="#3aa99b"/><circle cx="60" cy="96" r="5.5" fill="${lamp}"/>` +
    `<rect x="24" y="22" width="72" height="56" rx="18" fill="${C.teal}"/><rect x="33" y="31" width="54" height="38" rx="12" fill="${C.deep}"/>${eyes}${mouth}</svg>`;
}

// ---------- rocky asteroid, drawn at the origin (caller translates and rotates) ----------
// shape: array of radius factors around the rock, the same one the flat asteroid uses.
function rockPath(ctx, r, shape) {
  ctx.beginPath();
  shape.forEach((f, i) => {
    const a = i / shape.length * TAU;
    ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * f, Math.sin(a) * r * f);
  });
  ctx.closePath();
}
// tint: optional [light, mid, dark] colours; rot is the rock's rotation so the light stays top-left.
export function drawRocky(ctx, r, shape, rot = 0, tint) {
  const [light, mid, dark] = tint || ['#d8c3a5', '#8a7361', '#33283a'];
  const lx = Math.cos(-rot - 2.3) * r * 0.6, ly = Math.sin(-rot - 2.3) * r * 0.6; // light source, un-rotated
  ctx.save();
  rockPath(ctx, r, shape); ctx.clip();
  const g = ctx.createRadialGradient(lx, ly, r * 0.1, 0, 0, r * 1.2);
  g.addColorStop(0, light); g.addColorStop(0.5, mid); g.addColorStop(1, dark);
  ctx.fillStyle = g; ctx.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6);
  for (let k = 0; k < 4; k++) { // craters, placed from the shape so each rock keeps its own
    const a = shape[k] * 40 + k * 1.7, d = r * (0.38 + 0.38 * ((shape[k + 4] * 7) % 1)), cr = r * (0.1 + 0.11 * ((shape[k + 2] * 13) % 1));
    const cx = Math.cos(a) * d, cy = Math.sin(a) * d;
    ctx.fillStyle = 'rgba(38,26,40,.6)'; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.045); ctx.strokeStyle = 'rgba(245,225,195,.6)';
    ctx.beginPath(); ctx.arc(cx, cy, cr, -rot - 0.2, -rot + 1.8); ctx.stroke();
  }
  ctx.restore();
  rockPath(ctx, r, shape);
  const lg = ctx.createLinearGradient(lx * 1.6, ly * 1.6, -lx * 1.6, -ly * 1.6);
  lg.addColorStop(0, 'rgba(255,242,220,.95)'); lg.addColorStop(0.5, 'rgba(255,242,220,.12)'); lg.addColorStop(1, 'rgba(14,10,24,.85)');
  ctx.lineWidth = Math.max(2.5, r * 0.09); ctx.lineJoin = 'round'; ctx.strokeStyle = lg; ctx.stroke();
}
// Dark patch behind a number so it stays readable on a textured rock.
export function numberPlate(ctx, r) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.78);
  g.addColorStop(0, 'rgba(8,10,26,.62)'); g.addColorStop(0.7, 'rgba(8,10,26,.4)'); g.addColorStop(1, 'rgba(8,10,26,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, TAU); ctx.fill();
}

// ---------- streak flames: a column of fire rising from (x0, y0), w wide and h tall ----------
const RND = Array.from({ length: 128 }, (_, i) => ((Math.sin(i * 127.1) * 43758.5453) % 1 + 1) % 1);
export function drawFlames(ctx, x0, y0, w, h, n, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const a = RND[i % 128], life = (t * (0.9 + a) + RND[(i + 50) % 128]) % 1;
    const x = x0 + RND[(i + 20) % 128] * w + Math.sin(t * 5 + i) * 3, y = y0 - life * h * (0.6 + 0.4 * a);
    ctx.globalAlpha = (1 - life) * 0.85;
    ctx.fillStyle = life < 0.35 ? '#ffe2a0' : life < 0.65 ? C.amber : C.coral;
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, (1 - life) * Math.abs(h) * 0.2 + 1), 0, TAU); ctx.fill();
  }
  ctx.restore();
}
// How big the flames get for a streak (0 below three in a row).
export const flameLevel = streak => (streak >= 3 ? Math.min(10, streak) : 0);

// ---------- chunky explosion: flash, shock ring and spinning rock chunks ----------
export function makeChunks(x, y, r) {
  return {
    x, y, r, t: 0, life: 1.1,
    bits: Array.from({ length: 9 }, (_, i) => ({
      a: i / 9 * TAU + Math.random(), d: r * (0.9 + 1.9 * Math.random()), size: r * (0.16 + 0.2 * Math.random()),
      spin: (2 + 5 * Math.random()) * (i % 2 ? 1 : -1), shape: Array.from({ length: 8 }, () => 0.8 + Math.random() * 0.28),
    })),
  };
}
export function drawChunks(ctx, c) {
  const e = c.t, out = 1 - Math.exp(-2.6 * e), fade = Math.max(0, Math.min(1, 1 - (e - 0.5) / 0.6));
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - e * 5); ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(c.x, c.y, c.r * (0.8 + e * 5), 0, TAU); ctx.fill();
  ctx.globalAlpha = Math.max(0, 1 - e / 0.55); ctx.strokeStyle = C.amber; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(c.x, c.y, c.r * (0.6 + out * 2.4), 0, TAU); ctx.stroke();
  for (const b of c.bits) {
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(c.x + Math.cos(b.a) * b.d * out, c.y + Math.sin(b.a) * b.d * out + e * e * 60);
    ctx.rotate(e * b.spin);
    drawRocky(ctx, b.size, b.shape, e * b.spin);
    ctx.restore();
  }
  ctx.restore();
}

// ---------- star-chart mission map (SVG string) ----------
// items: [{ id, label, name, stars, open, next }]. Planets are tappable via data-act="play-mission".
const PLANET = ['#4fd6c4', '#ff9f6b', '#a98bff', '#ffb84d', '#7fd0ff', '#ff8fd0', '#9be36b'];
export function starChartSvg(items, accent = C.amber) {
  const W = 400, step = 104, H = items.length * step + 50;
  const pos = items.map((_, i) => [200 + 118 * Math.sin(i * 1.9 + 0.6), H - 70 - i * step]);
  let s = '';
  for (let i = 0; i < 40; i++) s += `<circle cx="${(RND[i] * W).toFixed(0)}" cy="${(RND[i + 40] * H).toFixed(0)}" r="${(0.8 + RND[i + 80] * 1.2).toFixed(1)}" fill="#fff" opacity="${(0.25 + RND[i + 20] * 0.5).toFixed(2)}"/>`;
  for (let i = 0; i < items.length - 1; i++) {
    const [ax, ay] = pos[i], [bx, by] = pos[i + 1];
    const mx = (ax + bx) / 2 + (by - ay) * 0.18, my = (ay + by) / 2 - (bx - ax) * 0.18;
    s += `<path d="M${ax.toFixed(0)} ${ay.toFixed(0)}Q${mx.toFixed(0)} ${my.toFixed(0)} ${bx.toFixed(0)} ${by.toFixed(0)}" fill="none" stroke="${items[i + 1].open ? accent : C.line}" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 11"/>`;
  }
  items.forEach((m, i) => {
    const [x, y] = pos[i], r = m.next ? 32 : 28, col = m.open ? PLANET[i % PLANET.length] : '#6f7aa8';
    const side = x > 200 ? -1 : 1; // put the name on the roomier side
    s += `<g ${m.open ? `data-act="play-mission" data-id="${m.id}" tabindex="0" role="button" class="planet"` : 'class="planet locked"'} aria-label="${m.name}, ${m.label}${m.open ? '' : ', locked'}">`;
    if (m.next) s += `<circle class="pulse" cx="${x}" cy="${y}" r="${r + 8}" fill="none" stroke="${accent}" stroke-width="4"/>`;
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" opacity="${m.open ? 1 : 0.5}"/>` +
      `<path d="M${x - r * 0.3} ${y + r * 0.95}A${r} ${r} 0 0 0 ${x + r * 0.95} ${y - r * 0.3}A${r * 1.5} ${r * 1.5} 0 0 1 ${x - r * 0.3} ${y + r * 0.95}Z" fill="#000" opacity=".28"/>` +
      (i % 2 ? `<ellipse cx="${x}" cy="${y}" rx="${r * 1.45}" ry="${r * 0.3}" fill="none" stroke="${m.open ? C.ink : '#6f7aa8'}" stroke-width="3" opacity=".6" transform="rotate(-18 ${x} ${y})"/>` : '') +
      `<text x="${x}" y="${y + 7}" text-anchor="middle" font-weight="700" font-size="${m.label.length > 5 ? 14 : m.label.length > 3 ? 17 : 22}" fill="#fff" stroke="${C.deep}" stroke-width="5" paint-order="stroke" stroke-linejoin="round" opacity="${m.open ? 1 : 0.6}">${m.label}</text>` +
      `<text x="${x + side * (r + 14)}" y="${y - 4}" text-anchor="${side > 0 ? 'start' : 'end'}" font-weight="700" font-size="15" fill="${m.open ? C.ink : C.muted}">${m.open ? '' : '🔒 '}${m.name}</text>`;
    const sx = x + side * (r + 14) + (side > 0 ? 8 : -44);
    for (let k = 0; k < 3; k++) s += star(sx + k * 18, y + 14, 8, k < m.stars ? C.amber : C.line);
    if (m.next) s += `<path d="M${x} ${y - r - 30}l11 20h-22z" fill="${accent}"/><circle cx="${x}" cy="${y - r - 17}" r="3" fill="${C.deep}"/>`;
    s += '</g>';
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="group" aria-label="Mission star chart">${s}</svg>`;
}
