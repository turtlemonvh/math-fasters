import type { ReactNode } from 'react';
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { robotSvg } from '../../js/fx.js';
import { Shot, at } from './Shot';
import { FPS, type ShotId } from './shots';
import { theme } from './theme';

const sec = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Game footage sits in this box; the caption runs in the band underneath, so it never covers the game. */
const STAGE = { left: 152, top: 34, width: 1616, height: 909 };
const frameStyle = {
  borderRadius: 26,
  overflow: 'hidden',
  boxShadow: `0 0 0 3px ${theme.line}, 0 30px 80px rgba(0,0,0,.55)`,
} as const;

function Backdrop() {
  return (
    <AbsoluteFill
      style={{ background: `radial-gradient(120% 90% at 50% 0%, ${theme.space} 0%, ${theme.deep} 70%)` }}
    />
  );
}

/** Text in the band under the footage. `left`/`width` place it under one half of a split scene. */
function Caption({ children, left = 0, width = 1920, size = 58, still = false }: { children: ReactNode; left?: number; width?: number; size?: number; still?: boolean }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const show = still ? 1 : interpolate(frame, [2, 9, durationInFrames - 6, durationInFrames - 1], [0, 1, 1, 0], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left,
        width,
        top: STAGE.top + STAGE.height,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.display,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: '.02em',
        color: theme.ink,
        opacity: show,
        transform: `translateY(${(1 - show) * 14}px)`,
      }}
    >
      <span>{children}</span>
    </div>
  );
}
const Hi = ({ children }: { children: ReactNode }) => <span style={{ color: theme.amber }}>{children}</span>;

/** A cut of one take with its caption. `cut` skips the entrance, for a jump within the same game. */
function Scene({ caption, cut = false, children }: { caption: ReactNode; cut?: boolean; children: ReactNode }) {
  const frame = useCurrentFrame();
  const enter = cut ? 1 : interpolate(frame, [0, 6], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Backdrop />
      <div style={{ position: 'absolute', ...STAGE, ...frameStyle, opacity: enter, transform: `scale(${0.985 + 0.015 * enter})` }}>
        {children}
      </div>
      <Caption still={cut}>{caption}</Caption>
    </AbsoluteFill>
  );
}

/** Two takes of the same play side by side, each with its own label underneath. Sound comes from `heard`. */
function Split({ a, b, from, heard, labelA, labelB, cut = false }: { a: ShotId; b: ShotId; from: number; heard: 'a' | 'b'; labelA: ReactNode; labelB: ReactNode; cut?: boolean }) {
  const frame = useCurrentFrame();
  const enter = cut ? 1 : interpolate(frame, [0, 6], [0, 1], clamp);
  const width = 798;
  const height = 900;
  const xA = STAGE.left;
  const xB = STAGE.left + STAGE.width - width;
  return (
    <AbsoluteFill>
      <Backdrop />
      {[
        { id: a, x: xA, sound: heard === 'a', label: labelA },
        { id: b, x: xB, sound: heard === 'b', label: labelB },
      ].map((side) => (
        <div key={side.id}>
          <div style={{ position: 'absolute', left: side.x, top: STAGE.top + 4, width, height, ...frameStyle, opacity: enter }}>
            <Shot id={side.id} from={from} sound={side.sound} />
          </div>
          <Caption left={side.x} width={width} size={46} still={cut}>
            {side.label}
          </Caption>
        </div>
      ))}
    </AbsoluteFill>
  );
}

function Tock({ size, mood = 'cheer' }: { size: number; mood?: 'ready' | 'cheer' }) {
  const frame = useCurrentFrame();
  return (
    <div
      style={{ width: size, height: size * (130 / 120), transform: `translateY(${Math.sin(frame / 9) * 8}px)` }}
      dangerouslySetInnerHTML={{ __html: robotSvg(mood) }}
    />
  );
}

function Logo({ size }: { size: number }) {
  return (
    <div style={{ fontFamily: theme.display, fontWeight: 700, fontSize: size, letterSpacing: '.04em', color: theme.ink, lineHeight: 1 }}>
      MATH <span style={{ color: theme.amber }}>FASTERS</span>
    </div>
  );
}

function Title() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const pop = spring({ frame: frame - 4, fps, config: { damping: 13 } });
  const sub = interpolate(frame, [18, 30], [0, 1], clamp);
  const out = interpolate(frame, [durationInFrames - 6, durationInFrames - 1], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: theme.deep }}>
      {/* The last wave of a real mission, dimmed and silent, behind the name. */}
      <AbsoluteFill style={{ opacity: 0.32, filter: 'blur(3px)', transform: 'scale(1.04)' }}>
        <Shot id="result" from={at('result', 'wave3') + 1.2} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 34, opacity: out }}>
        <div style={{ transform: `scale(${pop})` }}>
          <Tock size={230} />
        </div>
        <div style={{ transform: `scale(${0.8 + 0.2 * pop})`, opacity: pop }}>
          <Logo size={170} />
        </div>
        <div style={{ fontFamily: theme.body, fontSize: 50, color: theme.muted, opacity: sub }}>
          A space arcade game for math facts
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** A drawn screen: `kind` only changes the frame around the footage. */
function Device({ kind, x, y, width, height, delay, children }: { kind: 'laptop' | 'phone'; x: number; y: number; width: number; height: number; delay: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 16 } });
  const bezel = kind === 'laptop' ? 16 : 13;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - bezel,
        top: y - bezel,
        opacity: Math.min(1, enter * 1.4),
        transform: `translateY(${(1 - enter) * 60}px)`,
        filter: 'drop-shadow(0 26px 40px rgba(0,0,0,.6))',
      }}
    >
      <div style={{ padding: bezel, background: '#2a3360', borderRadius: kind === 'laptop' ? 22 : 34, border: `2px solid ${theme.line}` }}>
        <div style={{ position: 'relative', width, height, borderRadius: kind === 'laptop' ? 8 : 22, overflow: 'hidden', background: theme.deep }}>
          {children}
        </div>
      </div>
      {kind === 'laptop' && (
        <div
          style={{
            height: 22,
            margin: '0 -70px',
            background: 'linear-gradient(#3a4580, #232b55)',
            borderRadius: '4px 4px 22px 22px',
            border: `2px solid ${theme.line}`,
            borderTop: 0,
          }}
        />
      )}
    </div>
  );
}

/** The same addition mission, same answers, on three screens at once. */
function Devices() {
  const from = at('add', 'a1') - 1.3;
  return (
    <AbsoluteFill>
      <Backdrop />
      <Device kind="laptop" x={120} y={84} width={1040} height={585} delay={0}>
        <Shot id="add" from={from} sound />
      </Device>
      <Device kind="phone" x={1500} y={130} width={320} height={676} delay={5}>
        <Shot id="add-tall" from={from} />
      </Device>
      <Device kind="phone" x={850} y={590} width={600} height={284} delay={10}>
        <Shot id="add-wide" from={from} />
      </Device>
      <Caption>
        On a <Hi>computer</Hi>, a <Hi>tablet</Hi> or a <Hi>phone</Hi>
      </Caption>
    </AbsoluteFill>
  );
}

/** A drawn phone home screen: the game's icon among blank apps, then the game opening with no connection. */
function Install() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const W = 380;
  const H = 800;
  const drop = spring({ frame: frame - 14, fps, config: { damping: 11 } });
  const tapAt = 50;
  const open = spring({ frame: frame - tapAt - 6, fps, config: { damping: 200 }, durationInFrames: 12 });
  const tap = interpolate(frame, [tapAt, tapAt + 12], [0, 1], clamp);
  const line = (n: number) => interpolate(frame, [8 + n * 40, 20 + n * 40], [0, 1], clamp);
  const blank = ['#39457f', '#2f3a6e', '#44508c', '#2b3565', '#3a4682', '#323d73', '#404c88', '#2f3a6e', '#3a4682', '#39457f', '#2b3565', '#44508c', '#323d73'];
  const cell = 76;
  const gap = (W - 48 - cell * 4) / 3;
  const spot = (i: number) => ({ left: 24 + (i % 4) * (cell + gap), top: 92 + Math.floor(i / 4) * (cell + 44) });
  const mine = spot(5);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Device kind="phone" x={330} y={120} width={W} height={H} delay={0}>
        <AbsoluteFill style={{ background: 'linear-gradient(160deg, #1b2450, #0c1024 70%)' }}>
          <div style={{ position: 'absolute', top: 22, left: 28, right: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: theme.body, fontWeight: 700, fontSize: 22, color: theme.ink }}>
            <span>8:30</span>
            <span style={{ fontSize: 17, padding: '3px 12px', borderRadius: 20, background: theme.coral, color: theme.deep, opacity: open }}>No connection</span>
          </div>
          {blank.map((colour, i) => {
            const p = spot(i < 5 ? i : i + 1);
            return <div key={i} style={{ position: 'absolute', ...p, width: cell, height: cell, borderRadius: 20, background: colour }} />;
          })}
          <div style={{ position: 'absolute', left: mine.left, top: mine.top, width: cell, transform: `scale(${drop})` }}>
            <Img src={staticFile('icon.png')} style={{ width: cell, height: cell, borderRadius: 20, display: 'block', boxShadow: `0 0 0 3px ${theme.amber}` }} />
            <div style={{ margin: '8px -30px 0', textAlign: 'center', fontFamily: theme.body, fontSize: 17, color: theme.ink }}>Math Fasters</div>
          </div>
          <div
            style={{
              position: 'absolute',
              left: mine.left + cell / 2 - 32,
              top: mine.top + cell / 2 - 32,
              width: 64,
              height: 64,
              borderRadius: '50%',
              border: `3px solid ${theme.ink}`,
              background: 'rgba(238,240,251,.28)',
              opacity: tap > 0 && tap < 1 ? 1 - tap : 0,
              transform: `scale(${0.5 + 0.7 * tap})`,
            }}
          />
          {/* The app opening from its icon: real play, filmed on a phone-shaped screen. */}
          <AbsoluteFill
            style={{
              opacity: Math.min(1, open * 1.5),
              transform: `scale(${0.2 + 0.8 * open})`,
              transformOrigin: `${mine.left + cell / 2}px ${mine.top + cell / 2}px`,
              top: 62,
              height: H - 62,
            }}
          >
            <Shot id="add-tall" from={at('add-tall', 'a2') - 2.6} style={{ objectPosition: 'bottom' }} />
          </AbsoluteFill>
        </AbsoluteFill>
      </Device>
      <div style={{ position: 'absolute', left: 860, right: 120, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 44, fontFamily: theme.display, fontWeight: 700, color: theme.ink }}>
        <div style={{ fontSize: 92, lineHeight: 1.08, opacity: line(0), transform: `translateX(${(1 - line(0)) * 30}px)` }}>
          Install it <Hi>like an app</Hi>
        </div>
        <div style={{ fontFamily: theme.body, fontWeight: 400, fontSize: 44, color: theme.muted, opacity: line(0) }}>
          Add it to the home screen from your browser. No app store.
        </div>
        <div style={{ fontSize: 92, lineHeight: 1.08, opacity: line(1), transform: `translateX(${(1 - line(1)) * 30}px)` }}>
          Works <span style={{ color: theme.teal }}>offline</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function EndCard() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 3, fps, config: { damping: 14 } });
  const line = (n: number) => interpolate(frame, [12 + n * 8, 22 + n * 8], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 30 }}>
        <div style={{ transform: `scale(${pop})` }}>
          <Tock size={190} />
        </div>
        <div style={{ opacity: pop }}>
          <Logo size={130} />
        </div>
        <div style={{ fontFamily: theme.display, fontWeight: 700, fontSize: 62, color: theme.teal, opacity: line(0) }}>
          Play free in your browser
        </div>
        <div
          style={{
            fontFamily: theme.display,
            fontWeight: 500,
            fontSize: 50,
            color: theme.ink,
            padding: '16px 40px',
            border: `3px solid ${theme.line}`,
            borderRadius: 20,
            background: theme.panel,
            opacity: line(1),
          }}
        >
          turtlemonvh.github.io/math-fasters
        </div>
        <div style={{ fontFamily: theme.body, fontSize: 38, color: theme.muted, opacity: line(2) }}>
          No sign-up. No ads. Progress stays on your device.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ---------- the cut ----------
// Each entry is one piece of film. `music` marks where the closing music comes in.
interface Piece {
  length: number;
  node: ReactNode;
  music?: boolean;
}

const TUNE_RATE = 1.4;
const tuneFrom = at('tune', 'settings') + 0.3;
/** Seconds into the (sped-up) settings scene at which something in the take happens. */
const tuneAt = (mark: string) => (at('tune', mark) - tuneFrom) / TUNE_RATE;
const tuneLength = sec(tuneAt('end') + 0.2);
const tuneNumbers = sec(tuneAt('tables') - 0.75);
const tuneSpeed = sec(tuneAt('speed') - 0.6);

const blastCaption = <>Blast the <Hi>right answer</Hi></>;
const fuelCaption = <>Type it to <Hi>fuel the rocket</Hi></>;
const calmLabel = <><span style={{ color: theme.teal }}>Calm:</span> plain look, soft beeps</>;
const livelyLabel = <><Hi>Lively:</Hi> every extra switched on</>;

const PIECES: Piece[] = [
  { length: sec(3.2), node: <Title /> },

  // Asteroid Blast, multiplication: a right answer, then a wrong one.
  { length: sec(2.3), node: <Scene caption={blastCaption}><Shot id="blast" from={at('blast', 'a1') - 1.3} sound /></Scene> },
  {
    length: sec(3.4),
    node: (
      <Scene cut caption={<>Miss one? It shows <span style={{ color: theme.teal }}>the answer</span></>}>
        <Shot id="blast" from={at('blast', 'a2') - 1.0} sound />
      </Scene>
    ),
  },

  // Fuel-Up, division: one answer, then the lift-off that ten answers earn.
  { length: sec(2.5), node: <Scene caption={fuelCaption}><Shot id="fuel" from={at('fuel', 'a1') - 1.0} sound /></Scene> },
  { length: sec(2.3), node: <Scene cut caption={fuelCaption}><Shot id="fuel" from={at('fuel', 'launch') - 0.3} sound /></Scene> },

  // Cave Flight, subtraction.
  {
    length: sec(4.4),
    node: (
      <Scene caption={<>Fly through it, then <Hi>boost</Hi></>}>
        <Shot id="cave" from={at('cave', 'q1') + 0.2} sound />
      </Scene>
    ),
  },

  // Addition, on three screens.
  { length: sec(4.0), node: <Devices /> },

  // The plain look and sounds against all the extras: first the mission map, then play.
  { length: sec(1.3), node: <Split a="calm" b="lively" from={at('calm', 'map') + 0.25} heard="a" labelA={calmLabel} labelB={livelyLabel} /> },
  { length: sec(4.1), node: <Split cut a="calm" b="lively" from={at('calm', 'a1') - 1.1} heard="a" labelA={calmLabel} labelB={livelyLabel} /> },

  {
    length: sec(3.2),
    node: (
      <Scene caption={<>Earn <Hi>stars</Hi> and new ranks</>}>
        <Shot id="result" from={at('result', 'result') - 1.0} sound />
      </Scene>
    ),
  },

  // Grown-up settings, a little faster than life, with the caption following what is tapped.
  {
    length: tuneLength,
    node: (
      <AbsoluteFill>
        <Scene caption={null}>
          <Shot id="tune" from={tuneFrom} rate={TUNE_RATE} sound volume={0.6} />
        </Scene>
        <Sequence durationInFrames={tuneNumbers}>
          <Caption>Grown-ups choose <Hi>the subjects</Hi></Caption>
        </Sequence>
        <Sequence from={tuneNumbers} durationInFrames={tuneSpeed - tuneNumbers}>
          <Caption>…<Hi>the numbers</Hi> in play</Caption>
        </Sequence>
        <Sequence from={tuneSpeed}>
          <Caption>…and <Hi>the speed</Hi></Caption>
        </Sequence>
      </AbsoluteFill>
    ),
  },
  {
    length: sec(3.7),
    node: (
      <Split
        a="slow"
        b="fast"
        from={at('slow', 'a1') - 3.0}
        heard="b"
        labelA={<>Speed: <span style={{ color: theme.teal }}>slow</span></>}
        labelB={<>Speed: <Hi>fast</Hi></>}
      />
    ),
  },

  {
    length: sec(3.5),
    node: (
      <Scene caption={<>…and see <Hi>every fact</Hi> learned</>}>
        <Shot id="progress" from={at('progress', 'grid') - 0.5} sound volume={0.6} />
      </Scene>
    ),
  },

  { length: sec(4.4), node: <Install />, music: true },
  { length: sec(4.6), node: <EndCard /> },
];

export const TRAILER_FRAMES = PIECES.reduce((n, s) => n + s.length, 0);
const MUSIC_OUT = PIECES.slice(0, PIECES.findIndex((p) => p.music)).reduce((n, s) => n + s.length, 0);
const INTRO_MUSIC = sec(4.3);
/** Quieter than the game's own sounds, so it sits behind them. */
const MUSIC_VOLUME = 0.7;

export function Trailer() {
  let start = 0;
  return (
    <AbsoluteFill style={{ background: theme.deep }}>
      {PIECES.map((piece, i) => {
        const from = start;
        start += piece.length;
        return (
          <Sequence key={i} from={from} durationInFrames={piece.length}>
            {piece.node}
          </Sequence>
        );
      })}
      {/* Music only where no game is being played: under the title (fading as play starts) and from the install scene on. */}
      <Sequence durationInFrames={INTRO_MUSIC}>
        <Audio
          src={staticFile('music/intro.wav')}
          volume={(f) => interpolate(f, [sec(3.0), INTRO_MUSIC - 1], [MUSIC_VOLUME, 0], clamp)}
        />
      </Sequence>
      <Sequence from={MUSIC_OUT}>
        <Audio
          src={staticFile('music/outro.wav')}
          volume={(f) => interpolate(f, [TRAILER_FRAMES - MUSIC_OUT - sec(1.6), TRAILER_FRAMES - MUSIC_OUT - 1], [MUSIC_VOLUME, 0], clamp)}
        />
      </Sequence>
    </AbsoluteFill>
  );
}

/** A short silent piece of real play for the README. */
export const LOOP_FRAMES = sec(6);
export function Loop() {
  return (
    <AbsoluteFill style={{ background: theme.deep }}>
      <Shot id="result" from={at('result', 'q2') - 0.25} />
    </AbsoluteFill>
  );
}
