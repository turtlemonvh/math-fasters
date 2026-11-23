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

export const SHOTS = {
  // A whole mission, start to results, so the stars and score at the end are real.
  blast: { ...screen, seconds: 90, until: 'result', tail: 4 },
  // The same mission with the same answers on two phone shapes, for the side-by-side shot.
  'blast-wide': { width: 760, height: 360, scale: 2, seconds: 14 },
  'blast-tall': { width: 360, height: 760, scale: 2, seconds: 14 },
  fuel: { ...screen, seconds: 45, until: 'launch', tail: 3.4 },
  cave: { ...screen, seconds: 13 },
  map: { ...screen, seconds: 8.5 },
  progress: { ...screen, seconds: 8.5 },
} satisfies Record<string, Shot>;

export type ShotId = keyof typeof SHOTS;
