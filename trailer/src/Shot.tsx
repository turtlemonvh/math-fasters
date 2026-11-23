import { Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CSSProperties } from 'react';
import recorded from './marks.json';
import { FPS, type ShotId } from './shots';

const TAKES = recorded as Record<ShotId, { frames: number; audio: boolean; marks: Record<string, number> }>;

/** When something happened in a take, in seconds from its start (written by record.ts). */
export function at(id: ShotId, mark: string): number {
  const t = TAKES[id]?.marks[mark];
  if (t === undefined) throw new Error(`Take "${id}" has no mark "${mark}". Run pnpm record.`);
  return t;
}

/**
 * One recorded take, played from `from` seconds in. Frames are the JPEGs
 * `record.ts` saved, so a frame here is exactly a frame of the game.
 */
export function Shot({
  id,
  from,
  sound = false,
  volume = 1,
  style,
}: {
  id: ShotId;
  from: number;
  sound?: boolean;
  volume?: number;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const first = Math.round(from * FPS);
  const index = Math.max(0, Math.min(TAKES[id].frames - 1, first + frame));
  return (
    <>
      <Img
        src={staticFile(`shots/${id}/f${String(index).padStart(4, '0')}.jpg`)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style }}
      />
      {sound && TAKES[id].audio && (
        <Audio
          src={staticFile(`shots/${id}/audio.wav`)}
          trimBefore={first}
          // A few frames of fade at each end, so a cut never lands as a click.
          volume={(f) =>
            volume *
            interpolate(f, [0, 4, durationInFrames - 5, durationInFrames - 1], [0, 1, 1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      )}
    </>
  );
}
