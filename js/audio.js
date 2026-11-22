// All sounds are synthesised with Web Audio: no audio files.
let ac = null;
let enabled = true;

export function setSound(on) { enabled = !!on; }

// Call from a tap or key press: browsers only allow audio to start from a user action.
export function unlock() {
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch { /* no audio available: play silently */ }
}

function tone(freq, dur, type = 'square', vol = 0.12, slideTo = 0, delay = 0) {
  if (!enabled || !ac) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.25) {
  if (!enabled || !ac) return;
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const src = ac.createBufferSource();
  const g = ac.createGain();
  g.gain.value = vol;
  src.buffer = buf;
  src.connect(g).connect(ac.destination);
  src.start();
}

const run = (notes, dur = 0.12, type = 'square', gap = 0.1) => notes.forEach((f, i) => tone(f, dur, type, 0.11, 0, i * gap));

export const sfx = {
  click: () => tone(620, 0.05, 'square', 0.07),
  laser: () => tone(990, 0.16, 'sawtooth', 0.1, 220),
  boom: () => noise(0.35),
  wrong: () => { tone(170, 0.4, 'sawtooth', 0.16, 70); noise(0.2, 0.12); },
  wave: () => run([523, 659, 784, 1047]),
  win: () => run([523, 659, 784, 1047, 784, 1047, 1319], 0.16, 'square', 0.12),
  over: () => run([392, 330, 262, 196], 0.28, 'triangle', 0.22),
};
