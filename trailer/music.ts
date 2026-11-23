/**
 * Writes the trailer's music: two short, slow pieces made from sine waves, so there is
 * nothing to license. `public/music/intro.wav` plays under the title and
 * `public/music/outro.wav` under the closing cards.
 *
 *   pnpm music
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 48000;
const here = dirname(fileURLToPath(import.meta.url));
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Notes as MIDI numbers: a bass note, then the pad. All in D major. */
const D = { bass: 38, pad: [57, 62, 64, 66, 69] }; // D add 9
const B = { bass: 35, pad: [57, 59, 62, 66] }; // B minor 7
const G = { bass: 31, pad: [55, 59, 62, 66] }; // G major 7
type Chord = typeof D;

function compose(chords: { chord: Chord; seconds: number }[], fadeOut: number) {
  const total = chords.reduce((n, c) => n + c.seconds, 0) + 2.5;
  const length = Math.round(total * RATE);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  // One soft note: slow in, slow out, slightly different pitch in each ear for width.
  const note = (start: number, seconds: number, freq: number, vol: number, attack: number, release: number, pan = 0) => {
    const from = Math.round(start * RATE);
    const n = Math.round((seconds + release) * RATE);
    for (let i = 0; i < n && from + i < length; i++) {
      const t = i / RATE;
      const env = Math.min(1, t / attack) * (t > seconds ? Math.max(0, 1 - (t - seconds) / release) ** 2 : 1);
      const wobble = 1 + 0.08 * Math.sin(2 * Math.PI * 0.23 * (start + t) + freq);
      const tone = (f: number) => Math.sin(2 * Math.PI * f * t) + 0.22 * Math.sin(4 * Math.PI * f * t) + 0.06 * Math.sin(6 * Math.PI * f * t);
      left[from + i] += vol * env * wobble * tone(freq * 0.9985) * (1 - pan) * 0.5;
      right[from + i] += vol * env * wobble * tone(freq * 1.0015) * (1 + pan) * 0.5;
    }
  };
  // A bell-like pluck with echoes that drift from side to side.
  const pluck = (start: number, freq: number, vol: number) => {
    for (let echo = 0; echo < 5; echo++) {
      const from = Math.round((start + echo * 0.42) * RATE);
      const gain = vol * 0.5 ** echo;
      const pan = echo % 2 ? 0.6 : -0.6;
      const n = Math.round(1.6 * RATE);
      for (let i = 0; i < n && from + i < length; i++) {
        const t = i / RATE;
        const env = Math.min(1, t / 0.006) * Math.exp(-t * 3.2);
        const s = env * (Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.exp(-t * 9) * Math.sin(2 * Math.PI * freq * 3 * t));
        left[from + i] += gain * s * (1 - pan) * 0.5;
        right[from + i] += gain * s * (1 + pan) * 0.5;
      }
    }
  };

  let at = 0;
  for (const { chord, seconds } of chords) {
    note(at, seconds, hz(chord.bass), 0.5, 0.5, 1.8);
    note(at, seconds, hz(chord.bass + 12), 0.22, 0.8, 1.8);
    chord.pad.forEach((m, i) => note(at + i * 0.05, seconds, hz(m), 0.2, 1.1, 2.2, (i / (chord.pad.length - 1)) * 1.2 - 0.6));
    // A slow, wandering line from the chord's own notes, an octave up.
    for (let t = 0.3; t < seconds - 0.2; t += 0.84) {
      const m = chord.pad[Math.floor(rnd() * chord.pad.length)] + (rnd() < 0.35 ? 24 : 12);
      pluck(at + t, hz(m), 0.2);
    }
    at += seconds;
  }

  // Fade the ends, then bring the loudest moment to a comfortable level.
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const t = i / RATE;
    const fade = Math.min(1, t / 0.15) * Math.min(1, Math.max(0, (total - t) / fadeOut));
    left[i] *= fade;
    right[i] *= fade;
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const gain = 0.5 / peak;
  const wav = Buffer.alloc(44 + length * 4);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + length * 4, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(RATE, 24);
  wav.writeUInt32LE(RATE * 4, 28);
  wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(length * 4, 40);
  for (let i = 0; i < length; i++) {
    wav.writeInt16LE(Math.round(left[i] * gain * 32767), 44 + i * 4);
    wav.writeInt16LE(Math.round(right[i] * gain * 32767), 46 + i * 4);
  }
  return { wav, total };
}

const out = join(here, 'public', 'music');
await mkdir(out, { recursive: true });
const pieces = {
  intro: compose([{ chord: D, seconds: 2.6 }, { chord: G, seconds: 1.6 }], 2.2),
  outro: compose([{ chord: B, seconds: 2.6 }, { chord: G, seconds: 2.6 }, { chord: D, seconds: 4.4 }], 3.5),
};
for (const [name, { wav, total }] of Object.entries(pieces)) {
  await writeFile(join(out, `${name}.wav`), wav);
  console.log(`${name}.wav ${total.toFixed(1)} s`);
}
