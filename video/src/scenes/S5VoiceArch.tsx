import { AbsoluteFill } from "remotion";

import { ramp, sceneOpacity } from "../anim";
import { useDesignFrame } from "../timing";
import { Eyebrow } from "../components/Eyebrow";
import { MicIcon } from "../components/icons";
import { PolyAvatar } from "../components/PolyAvatar";
import { StreamText } from "../components/StreamText";
import { COLORS } from "../theme";

const ROW_Y = 560;
const REPLY = "so a queue is first in, first out";

type NodeDef = { cx: number; w: number; h: number };
const N = {
  poly: { cx: 230, w: 180, h: 150 },
  you: { cx: 470, w: 140, h: 150 },
  rt: { cx: 830, w: 250, h: 150 },
  words: { cx: 1240, w: 430, h: 150 },
  score: { cx: 1660, w: 230, h: 150 },
} as const;

const left = (n: NodeDef) => n.cx - n.w / 2;
const right = (n: NodeDef) => n.cx + n.w / 2;

/** Live voice, under the hood: Poly speaks the question (secure TTS), your voice
 * streams in over WebRTC for live transcription, and the same scorer reads it.
 * The key never leaves the server. Elegant, mostly-visual. */
export const S5VoiceArch: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useDesignFrame();

  // Leisurely reveal with lots of read time; the security card lands LAST.
  const head = ramp(frame, [10, 36], [0, 1]);
  const aPoly = ramp(frame, [44, 64], [0, 1]);
  const aYou = ramp(frame, [84, 106], [0, 1]);
  const aRt = ramp(frame, [150, 174], [0, 1]);
  const aWords = ramp(frame, [212, 236], [0, 1]);
  const aScore = ramp(frame, [348, 372], [0, 1]);
  const aLock = ramp(frame, [440, 468], [0, 1]);

  const pipe1 = ramp(frame, [60, 80], [0, 1]);
  const pipe2 = ramp(frame, [106, 134], [0, 1]);
  const pipe3 = ramp(frame, [172, 196], [0, 1]);
  const pipe4 = ramp(frame, [320, 346], [0, 1]);

  const packet2 = ramp(frame, [134, 160], [0, 1]);
  const packet3 = ramp(frame, [196, 222], [0, 1]);

  const dotShow = (i: number) => ramp(frame, [380 + i * 18, 404 + i * 18], [0, 1]);

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(frame, dur) }}>
      <div style={{ position: "absolute", top: 150, width: "100%", textAlign: "center", opacity: head, transform: `translateY(${(1 - head) * 12}px)` }}>
        <Eyebrow style={{ marginBottom: 16 }}>Under the hood</Eyebrow>
        <div style={{ fontSize: 56, fontWeight: 600, letterSpacing: -2, color: COLORS.ink }}>
          Streamed in real time, kept private.
        </div>
      </div>

      {/* connectors + packets */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <Pipe x1={right(N.poly)} x2={left(N.you)} draw={pipe1} />
        <Pipe x1={right(N.you)} x2={left(N.rt)} draw={pipe2} packet={packet2} />
        <Pipe x1={right(N.rt)} x2={left(N.words)} draw={pipe3} packet={packet3} />
        <Pipe x1={right(N.words)} x2={left(N.score)} draw={pipe4} />
      </svg>

      {/* Poly asks (secure TTS) */}
      <Node n={N.poly} appear={aPoly} title="Poly asks" sub="secure TTS">
        <PolyAvatar size={74} />
      </Node>

      {/* You answer */}
      <Node n={N.you} appear={aYou} title="You answer" sub="just talk">
        <span style={{ display: "inline-flex", width: 64, height: 64, borderRadius: 999, background: COLORS.lilac, alignItems: "center", justifyContent: "center" }}>
          <MicIcon size={30} />
        </span>
      </Node>

      {/* OpenAI Realtime */}
      <Node n={N.rt} appear={aRt} title="OpenAI Realtime" sub="gpt-4o-transcribe">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Bolt />
          <span style={{ fontSize: 22, fontWeight: 700, color: COLORS.ink }}>Realtime</span>
        </div>
      </Node>

      {/* Live words */}
      <Node n={N.words} appear={aWords} title="Your words, instantly" sub="finalized + interim">
        <div style={{ width: N.words.w - 56, minHeight: 50, textAlign: "center", fontSize: 26, fontWeight: 600, lineHeight: 1.3, color: COLORS.ink }}>
          <StreamText text={REPLY} start={244} perLetter={1.8} wordGap={6} />
        </div>
      </Node>

      {/* Same scorer */}
      <Node n={N.score} appear={aScore} title="The same scorer" sub="voice or typed">
        <div style={{ display: "flex", gap: 12 }}>
          <Dot color={COLORS.success} appear={dotShow(0)} />
          <Dot color={COLORS.warning} appear={dotShow(1)} />
          <Dot color={COLORS.faint} appear={dotShow(2)} />
        </div>
      </Node>

      {/* Connector labels as chips, rendered on top so a card never hides them */}
      {[
        { x: (right(N.poly) + left(N.you)) / 2, t: pipe1, text: "asks, aloud" },
        { x: (right(N.you) + left(N.rt)) / 2, t: pipe2, text: "mic · WebRTC" },
        { x: (right(N.rt) + left(N.words)) / 2, t: pipe3, text: "live deltas" },
        { x: (right(N.words) + left(N.score)) / 2, t: pipe4, text: "transcript" },
      ].map((l) => (
        <div
          key={l.text}
          style={{
            position: "absolute",
            left: l.x,
            top: ROW_Y,
            transform: "translate(-50%, -50%)",
            opacity: l.t,
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 999,
            padding: "4px 13px",
            fontSize: 15,
            fontWeight: 600,
            color: COLORS.faint,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 14px -8px rgba(40,50,80,0.45)",
          }}
        >
          {l.text}
        </div>
      ))}

      {/* Security callout */}
      <div
        style={{
          position: "absolute",
          top: 760,
          left: 0,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          opacity: aLock,
          transform: `translateY(${(1 - aLock) * 10}px)`,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 999,
            padding: "16px 28px",
            boxShadow: "0 10px 30px -18px rgba(40,50,80,0.35)",
            fontSize: 24,
            color: COLORS.muted,
          }}
        >
          <Lock />
          Your API key never leaves the server. The browser only holds a short-lived token.
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Node: React.FC<{ n: NodeDef; appear: number; title: string; sub: string; children: React.ReactNode }> = ({
  n,
  appear,
  title,
  sub,
  children,
}) => (
  <div
    style={{
      position: "absolute",
      left: left(n),
      top: ROW_Y - n.h / 2,
      width: n.w,
      height: n.h,
      opacity: appear,
      transform: `translateY(${(1 - appear) * 12}px) scale(${0.96 + appear * 0.04})`,
    }}
  >
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 22,
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        boxShadow: "0 16px 40px -26px rgba(40,50,80,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
    <div style={{ position: "absolute", top: "100%", left: 0, width: "100%", marginTop: 16, textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.ink }}>{title}</div>
      <div style={{ marginTop: 4, fontSize: 17, color: COLORS.faint }}>{sub}</div>
    </div>
  </div>
);

const Pipe: React.FC<{ x1: number; x2: number; draw: number; packet?: number }> = ({ x1, x2, draw, packet }) => {
  const xEnd = x1 + (x2 - x1) * draw;
  const px = x1 + (x2 - x1) * (packet ?? 0);
  return (
    <g>
      <line x1={x1} y1={ROW_Y} x2={x2} y2={ROW_Y} stroke={COLORS.border} strokeWidth={3} strokeDasharray="2 7" strokeLinecap="round" />
      <line x1={x1} y1={ROW_Y} x2={xEnd} y2={ROW_Y} stroke={COLORS.lilac} strokeWidth={3} strokeLinecap="round" />
      {draw > 0.98 ? <polygon points={`${x2},${ROW_Y} ${x2 - 11},${ROW_Y - 6} ${x2 - 11},${ROW_Y + 6}`} fill={COLORS.lilac} /> : null}
      {packet && packet > 0.02 && packet < 0.99 ? <circle cx={px} cy={ROW_Y} r={6} fill={COLORS.lilacInk} /> : null}
    </g>
  );
};

const Dot: React.FC<{ color: string; appear: number }> = ({ color, appear }) => (
  <span style={{ width: 20, height: 20, borderRadius: 999, background: color, opacity: appear, transform: `scale(${0.4 + appear * 0.6})` }} />
);

const Bolt: React.FC = () => (
  <svg width={26} height={26} viewBox="0 0 24 24" fill={COLORS.lilac}>
    <path d="M13 2 L4 14 h6 l-1 8 9-12 h-6 z" />
  </svg>
);

const Lock: React.FC = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={COLORS.lilacInk} strokeWidth={2}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
