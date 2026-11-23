# Trailer

Makes the Math Fasters trailer by filming the real game. Nothing here ships with the game, and the game's code is not changed to make it.

Finished files are copied to `docs/trailer/`:

- `math-fasters-trailer.mp4`: 37 seconds, 1080p, with the game's own sounds.
- `math-fasters.gif`: six silent seconds of Asteroid Blast for the README.
- `poster.jpg`: one still frame.

## Make it again

Needs Node and pnpm. The first run downloads Remotion and a copy of Chromium (a few hundred MB).

```
cd trailer
pnpm install
pnpm exec playwright install chromium
pnpm render        # film every take, render everything, copy to docs/trailer
```

Or one step at a time:

```
pnpm record              # film every take (about three minutes)
pnpm record cave map     # film just these
pnpm studio              # preview and scrub the edit in a browser
pnpm render:trailer      # the MP4
pnpm render:loop && pnpm render:gif
pnpm render:poster
pnpm run publish         # copy the results to docs/trailer
```

## How it works

1. **Takes.** `record.ts` serves the repository folder and opens `index.html?take=<id>` in headless Chromium. Two scripts are injected before the game loads:
   - `virtual-time.js` replaces the page's clocks, timers, animation frames and sound output with a clock that only moves when the recorder says so. Every film frame is exactly 1/30 of a second after the last, however slowly the machine draws it. The game still runs at 60 frames a second: the recorder steps it twice per film frame.
   - `director.js` saves a demo pilot called Nova, fixes the random numbers so every recording comes out the same, and plays the game with a scripted player. The player reads the right answer from the game's `debug()` hook, waits a moment, then taps, types or steers with the same events a finger sends. A ring is drawn where each touch lands.
2. **Frames and sound.** Each take is saved under `public/shots/<id>/` as one JPEG per frame plus `audio.wav`. `src/marks.json` records when things happened in each take (first question, first bonus question, lift-off, results screen), in seconds.
3. **Edit.** `src/Trailer.tsx` is a Remotion composition. It cuts the takes together using those marks, with captions and title cards in the game's own fonts and colours.

The takes are listed in `src/shots.ts`. The three `blast` takes are the same mission at three screen sizes. Because the random numbers and the player are fixed, they stay in step, which is what the side-by-side shot relies on.

## Changing it

- **Different cut or caption:** edit the `SCENES` list in `src/Trailer.tsx`, then `pnpm render:trailer`. No need to film again.
- **Different play:** edit the `PLAN` list in `director.js` (which mission, what gets tapped), then `pnpm record <take>`.
- **The game changed:** `pnpm render` films everything again. If a take never reaches the point it waits for, the recorder prints a `PROBLEM` line.

`public/shots/` and `out/` are large and can always be made again, so git ignores them. `src/marks.json` is kept so the edit type-checks without filming first.
