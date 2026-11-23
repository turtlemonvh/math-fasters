import { Composition } from 'remotion';
import { FPS } from './shots';
import { LOOP_FRAMES, Loop, TRAILER_FRAMES, Trailer } from './Trailer';

export function Root() {
  return (
    <>
      <Composition id="Trailer" component={Trailer} durationInFrames={TRAILER_FRAMES} fps={FPS} width={1920} height={1080} />
      <Composition id="Loop" component={Loop} durationInFrames={LOOP_FRAMES} fps={FPS} width={960} height={540} />
    </>
  );
}
