/**
 * Films each trailer shot from the real game. Serves the repository folder,
 * opens `index.html?take=<id>` in headless Chromium with `virtual-time.js`
 * and `director.js` injected, and steps the page's clock one frame at a
 * time, saving a JPEG per frame plus the shot's sound as a WAV under
 * `public/shots/<id>/`. Remotion edits those frames together.
 *
 *   pnpm record            # every shot
 *   pnpm record cave map   # just these
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { FPS, SHOTS, type ShotId } from './src/shots';

/** What `virtual-time.js` and `director.js` put on `window`. Callbacks passed to
 * `page.evaluate` run in the browser, so each one casts `window` itself. */
interface FilmSet {
  __vt: {
    step(ms: number): Promise<void>;
    frame(): void;
    markAudioStart(): void;
    renderAudio(durationMs: number): Promise<string | null>;
  };
  __trailer?: { ready: boolean; marks: Record<string, number>; start(): void };
}

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 8932;
const BASE = `http://127.0.0.1:${PORT}`;
/** The game runs at 60 frames a second; the film keeps every second one. */
const SUBSTEPS = 2;
const MARKS_FILE = join(here, 'src', 'marks.json');

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`The file server did not start on ${BASE}`);
}

/** Advance the page's clock by one film frame, running the game's own frames on the way. */
async function tick(page: Page) {
  for (let i = 0; i < SUBSTEPS; i++) {
    await page.evaluate((step) => (window as unknown as FilmSet).__vt.step(step), 1000 / FPS / SUBSTEPS);
    await page.evaluate(() => (window as unknown as FilmSet).__vt.frame());
  }
}

async function recordShot(id: ShotId) {
  const shot: (typeof SHOTS)[ShotId] & { until?: string; tail?: number } = SHOTS[id];
  const outDir = join(here, 'public', 'shots', id);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: shot.scale,
    hasTouch: true,
  });
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  await page.addInitScript({ path: join(here, 'virtual-time.js') });
  await page.addInitScript({ path: join(here, 'director.js') });
  await page.goto(`${BASE}/index.html?take=${id}`);
  // Checked from here, not with waitForFunction: that polls on the page's own timers, which are frozen.
  for (let tries = 0; ; tries++) {
    if (await page.evaluate(() => (window as unknown as FilmSet).__trailer?.ready)) break;
    if (tries > 150) throw new Error(`[${id}] never became ready: ${problems.join(' | ')}`);
    await new Promise((r) => setTimeout(r, 100));
  }

  for (let i = 0; i < 10; i++) await tick(page);
  await page.evaluate(() => {
    (window as unknown as FilmSet).__vt.markAudioStart();
    (window as unknown as FilmSet).__trailer!.start();
  });

  const maxFrames = Math.round(shot.seconds * FPS);
  let frames = 0;
  let stopAt = maxFrames;
  let marks: Record<string, number> = {};
  for (; frames < stopAt; frames++) {
    await tick(page);
    await page.screenshot({
      path: join(outDir, `f${String(frames).padStart(4, '0')}.jpg`),
      type: 'jpeg',
      quality: 90,
    });
    if (shot.until && stopAt === maxFrames) {
      marks = await page.evaluate(() => (window as unknown as FilmSet).__trailer!.marks);
      if (shot.until in marks) stopAt = Math.min(maxFrames, frames + 1 + Math.round((shot.tail ?? 0) * FPS));
    }
  }
  marks = await page.evaluate(() => (window as unknown as FilmSet).__trailer!.marks);
  if (shot.until && !(shot.until in marks)) problems.push(`never reached "${shot.until}"`);

  const wav = await page.evaluate(
    (ms) => (window as unknown as FilmSet).__vt.renderAudio(ms),
    (frames / FPS) * 1000,
  );
  if (wav) await writeFile(join(outDir, 'audio.wav'), Buffer.from(wav, 'base64'));
  await browser.close();

  // Where things happened in each take, in seconds, for the edit to cut on.
  const all = JSON.parse(await readFile(MARKS_FILE, 'utf8').catch(() => '{}'));
  all[id] = { frames, audio: Boolean(wav), marks };
  await writeFile(MARKS_FILE, JSON.stringify(all, null, 2) + '\n');

  console.log(`[${id}] ${frames} frames${wav ? ' + audio' : ''}`);
  for (const problem of new Set(problems)) console.error(`[${id}] PROBLEM: ${problem}`);
}

const requested = process.argv.slice(2) as ShotId[];
const ids = requested.length ? requested : (Object.keys(SHOTS) as ShotId[]);

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
  cwd: join(here, '..'),
  stdio: 'ignore',
});
try {
  await waitForServer();
  for (const id of ids) await recordShot(id);
} finally {
  server.kill('SIGTERM');
}
