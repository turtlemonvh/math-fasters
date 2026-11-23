/** Shared by the recorder and the Remotion compositions. */
export const FPS = 30;

interface Shot {
  width: number;
  height: number;
  /** Device pixel ratio, so frames come out sharper than the layout size. */
  scale: number;
  /** How long to film. With `until`, this is the longest the take may run. */
  seconds: number;
  /** Stop once the scripted player has reached this point, plus `tail` seconds. */
  until?: string;
  tail?: number;
}

/** A small laptop or tablet in landscape: fills the 1080p frame at twice the size. */
const screen = { width: 960, height: 540, scale: 2 };
/** Half of the frame, for two takes side by side. */
const half = { width: 472, height: 532, scale: 2 };

export const SHOTS = {
  // Patient player, one wrong answer.
  blast: { ...screen, seconds: 16 },
  // A whole mission, start to results, so the stars and score at the end are real.
  result: { ...screen, seconds: 90, until: 'result', tail: 4 },
  fuel: { ...screen, seconds: 60, until: 'launch', tail: 3.4 },
  cave: { ...screen, seconds: 13 },
  // One addition mission with the same answers on three screen shapes, for the side-by-side shot.
  add: { ...screen, seconds: 12 },
  'add-wide': { width: 760, height: 360, scale: 2, seconds: 12 },
  'add-tall': { width: 360, height: 760, scale: 2, seconds: 12 },
  // Everything off against everything on.
  calm: { ...half, seconds: 13 },
  lively: { ...half, seconds: 13 },
  // The slowest and fastest speed settings.
  slow: { ...half, seconds: 9.5 },
  fast: { ...half, seconds: 9.5 },
  tune: { ...screen, seconds: 14, until: 'end', tail: 0.5 },
  progress: { ...screen, seconds: 8.5 },
} satisfies Record<string, Shot>;

export type ShotId = keyof typeof SHOTS;
