import type { ReactNode } from 'react';
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { robotSvg } from '../../js/fx.js';
import { Shot, at } from './Shot';
import { FPS } from './shots';
import { theme } from './theme';

const sec = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Game footage sits in this box; the caption runs in the band underneath, so it never covers the game. */
const STAGE = { left: 152, top: 34, width: 1616, height: 909 };

function Backdrop() {
  return (
    <AbsoluteFill
      style={{ background: `radial-gradient(120% 90% at 50% 0%, ${theme.space} 0%, ${theme.deep} 70%)` }}
    />
  );
}

function Caption({ children }: { children: ReactNode }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const show = interpolate(frame, [3, 11, durationInFrames - 7, durationInFrames - 1], [0, 1, 1, 0], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: STAGE.top + STAGE.height,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.display,
        fontWeight: 700,
        fontSize: 58,
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

/** A cut of one take with its caption. */
function Scene({ caption, children }: { caption: ReactNode; children: ReactNode }) {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 6], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Backdrop />
      <div
        style={{
          position: 'absolute',
          ...STAGE,
          borderRadius: 26,
          overflow: 'hidden',
          boxShadow: `0 0 0 3px ${theme.line}, 0 30px 80px rgba(0,0,0,.55)`,
          opacity: enter,
          transform: `scale(${0.985 + 0.015 * enter})`,
        }}
      >
        {children}
      </div>
      <Caption>{caption}</Caption>
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
      {/* The last wave of a real mission, dimmed, behind the name. */}
      <AbsoluteFill style={{ opacity: 0.38, filter: 'blur(3px)', transform: 'scale(1.04)' }}>
        <Shot id="blast" from={at('blast', 'wave3') + 1.2} sound volume={0.35} />
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
function Device({
  kind,
  x,
  y,
  width,
  height,
  delay,
  children,
}: {
  kind: 'laptop' | 'phone';
  x: number;
  y: number;
  width: number;
  height: number;
  delay: number;
  children: ReactNode;
}) {
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
        <div style={{ width, height, borderRadius: kind === 'laptop' ? 8 : 22, overflow: 'hidden', background: theme.deep }}>
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

/** The same mission, same answers, on three screens at once. */
function Devices() {
  const from = at('blast', 'q5') - 0.5;
  return (
    <AbsoluteFill>
      <Backdrop />
      <Device kind="laptop" x={120} y={84} width={1040} height={585} delay={0}>
        <Shot id="blast" from={from} sound />
      </Device>
      <Device kind="phone" x={1500} y={130} width={320} height={676} delay={5}>
        <Shot id="blast-tall" from={from} />
      </Device>
      <Device kind="phone" x={850} y={590} width={600} height={284} delay={10}>
        <Shot id="blast-wide" from={from} />
      </Device>
      <Caption>
        On a <Hi>computer</Hi>, a <Hi>tablet</Hi> or a <Hi>phone</Hi>
      </Caption>
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
      {/* The game's own "new wave" sparkle, heard but not seen. */}
      <Sequence from={4} durationInFrames={sec(1.5)} layout="none">
        <div style={{ display: 'none' }}>
          <Shot id="blast" from={at('blast', 'wave2') - 0.02} sound volume={0.9} />
        </div>
      </Sequence>
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

/** Two cuts of one take inside a single scene, so the caption holds across the jump. */
function Cuts({ parts }: { parts: { length: number; node: ReactNode }[] }) {
  let start = 0;
  return (
    <>
      {parts.map((part, i) => {
        const from = start;
        start += part.length;
        return (
          <Sequence key={i} from={from} durationInFrames={part.length} layout="none">
            {part.node}
          </Sequence>
        );
      })}
    </>
  );
}

const fuelA = sec(2.9);
const fuelB = sec(2.5);
const resultLead = 1.0;

const SCENES: { length: number; node: ReactNode }[] = [
  { length: sec(2.6), node: <Title /> },
  {
    length: sec(5.6),
    node: (
      <Scene caption={<>Blast the <Hi>right answer</Hi></>}>
        <Shot id="blast" from={at('blast', 'q2') - 0.25} sound />
      </Scene>
    ),
  },
  {
    length: fuelA + fuelB,
    node: (
      <Scene caption={<>Type it to <Hi>fuel the rocket</Hi></>}>
        <Cuts
          parts={[
            { length: fuelA, node: <Shot id="fuel" from={at('fuel', 'q2') - 0.1} sound /> },
            { length: fuelB, node: <Shot id="fuel" from={at('fuel', 'launch') - 0.35} sound /> },
          ]}
        />
      </Scene>
    ),
  },
  {
    length: sec(4.8),
    node: (
      <Scene caption={<>Fly through it, then <Hi>boost</Hi></>}>
        <Shot id="cave" from={at('cave', 'q1') - 0.15} sound />
      </Scene>
    ),
  },
  {
    length: sec(3.7),
    node: (
      <Scene caption={<><Hi>×</Hi> <Hi>÷</Hi> <Hi>+</Hi> <Hi>−</Hi> &nbsp;with missions that level up</>}>
        <Shot id="map" from={at('map', 'div') - 0.45} sound />
      </Scene>
    ),
  },
  { length: sec(4.2), node: <Devices /> },
  {
    length: sec(3.6),
    node: (
      <Scene caption={<>Earn <Hi>stars</Hi> and new ranks</>}>
        <Shot id="blast" from={at('blast', 'result') - resultLead} sound />
      </Scene>
    ),
  },
  {
    length: sec(3.7),
    node: (
      <Scene caption={<>Grown-ups can see <Hi>every fact</Hi></>}>
        <Shot id="progress" from={at('progress', 'grid') - 0.5} sound volume={0.6} />
      </Scene>
    ),
  },
  { length: sec(3.4), node: <EndCard /> },
];

export const TRAILER_FRAMES = SCENES.reduce((n, s) => n + s.length, 0);

export function Trailer() {
  let start = 0;
  return (
    <AbsoluteFill style={{ background: theme.deep }}>
      {SCENES.map((scene, i) => {
        const from = start;
        start += scene.length;
        return (
          <Sequence key={i} from={from} durationInFrames={scene.length}>
            {scene.node}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

/** A short silent piece of real play for the README. */
export const LOOP_FRAMES = sec(6);
export function Loop() {
  return (
    <AbsoluteFill style={{ background: theme.deep }}>
      <Shot id="blast" from={at('blast', 'q2') - 0.25} />
    </AbsoluteFill>
  );
}
