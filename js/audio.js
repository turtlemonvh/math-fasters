// All sounds are synthesised with Web Audio: no audio files.
// Two sets: simple beeps (default) and a richer set a grown-up can switch on per pilot.
let ac = null;
let enabled = true;
let rich = false;

export function setSound(on) { enabled = !!on; }
export function setRich(on) { rich = !!on; }

// Call from a tap or key press: browsers only allow audio to start from a user action.
export function unlock() {
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch { /* no audio available: play silently */ }
}

// o: { f, to (slide), dur, type, vol, at (delay s), atk (fade-in s) }
function tone(o) {
  if (!enabled || !ac) return;
  try {
    const t = ac.currentTime + (o.at || 0), v = o.vol || 0.12;
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    if (o.atk) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + o.atk); } else g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g); g.connect(ac.destination);
    osc.start(t); osc.stop(t + o.dur + 0.03);
  } catch { /* ignore a failed sound */ }
}

// o: { dur, vol, at, kind ('lowpass' | 'highpass'), f, to }
function noise(o) {
  if (!enabled || !ac) return;
  try {
    const t = ac.currentTime + (o.at || 0), n = Math.max(1, Math.floor(ac.sampleRate * o.dur));
    const buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = buf; g.gain.value = o.vol || 0.25;
    if (o.kind) {
      const fl = ac.createBiquadFilter();
      fl.type = o.kind; fl.frequency.setValueAtTime(o.f, t);
      if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
      src.connect(fl); fl.connect(g);
    } else src.connect(g);
    g.connect(ac.destination);
    src.start(t);
  } catch { /* ignore a failed sound */ }
}

const run = (notes, dur = 0.12, type = 'square', gap = 0.1) => notes.forEach((f, i) => tone({ f, dur, type, vol: 0.11, at: i * gap }));

const simple = {
  click: () => tone({ f: 620, dur: 0.05, type: 'square', vol: 0.07 }),
  laser: () => tone({ f: 990, to: 220, dur: 0.16, type: 'sawtooth', vol: 0.1 }),
  boom: () => noise({ dur: 0.35 }),
  wrong: () => { tone({ f: 170, to: 70, dur: 0.4, type: 'sawtooth', vol: 0.16 }); noise({ dur: 0.2, vol: 0.12 }); },
  wave: () => run([523, 659, 784, 1047]),
  win: () => run([523, 659, 784, 1047, 784, 1047, 1319], 0.16, 'square', 0.12),
  over: () => run([392, 330, 262, 196], 0.28, 'triangle', 0.22),
};

const fancy = {
  click: simple.click,
  laser: () => {
    tone({ f: 1500, to: 260, dur: 0.2, type: 'square', vol: 0.07 }); tone({ f: 2400, to: 520, dur: 0.16, vol: 0.14 });
    tone({ f: 760, to: 130, dur: 0.22, type: 'triangle', vol: 0.12 }); noise({ dur: 0.06, vol: 0.12, kind: 'highpass', f: 4000 });
    // bright chime for the right answer
    [1046.5, 1318.5, 1568].forEach((f, i) => { tone({ f, dur: 0.45, vol: 0.1, at: 0.08 + i * 0.07, atk: 0.006 }); });
  },
  boom: () => {
    noise({ dur: 0.8, vol: 0.45, kind: 'lowpass', f: 2600, to: 160 }); tone({ f: 120, to: 32, dur: 0.7, vol: 0.45 });
    tone({ f: 70, to: 28, dur: 0.9, type: 'triangle', vol: 0.28, at: 0.03 });
    noise({ dur: 0.12, vol: 0.12, at: 0.14, kind: 'highpass', f: 2500 });
  },
  wrong: () => { // a soft "bonk"
    tone({ f: 230, to: 105, dur: 0.24, vol: 0.34, atk: 0.008 }); tone({ f: 345, to: 150, dur: 0.12, type: 'triangle', vol: 0.12, atk: 0.008 });
    tone({ f: 175, to: 88, dur: 0.22, vol: 0.22, at: 0.17, atk: 0.008 });
  },
  wave: () => { // shield-restored sparkle
    [1175, 1568, 1976, 2349, 3136, 3951].forEach((f, i) => tone({ f, dur: 0.22, vol: 0.09, at: i * 0.055, atk: 0.004 }));
    tone({ f: 392, to: 784, dur: 0.4, type: 'triangle', vol: 0.1, atk: 0.02 });
  },
  win: () => { // fanfare
    [392, 523.25, 659.25, 783.99].forEach((f, i) => { tone({ f, dur: 0.16, type: 'triangle', vol: 0.2, at: i * 0.13, atk: 0.006 }); tone({ f, dur: 0.14, type: 'square', vol: 0.045, at: i * 0.13 }); });
    [523.25, 659.25, 783.99, 1046.5].forEach(f => tone({ f, dur: 0.9, type: 'triangle', vol: 0.14, at: 0.54, atk: 0.01 }));
    tone({ f: 130.8, dur: 0.9, vol: 0.25, at: 0.54, atk: 0.01 });
    [2093, 2637, 3136].forEach((f, i) => tone({ f, dur: 0.25, vol: 0.06, at: 0.75 + i * 0.09, atk: 0.004 }));
  },
  over: simple.over,
};

// sfx.laser() etc. play from whichever set is switched on.
export const sfx = Object.fromEntries(Object.keys(simple).map(k => [k, () => (rich ? fancy : simple)[k]()]));
