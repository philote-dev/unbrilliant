import { AbsoluteFill, Img, staticFile } from "remotion";

import { easeInOut, ramp, sceneOpacity } from "../anim";
import { useDesignFrame } from "../timing";
import { COLORS } from "../theme";

const TREE = 560;

// Autumn-decay leaf system, ported from the app's MasteryWillow CanopyDecay.
const DECAY_SPOTS = [
  { x: 42, y: 30 }, { x: 58, y: 28 }, { x: 50, y: 22 }, { x: 36, y: 36 },
  { x: 64, y: 35 }, { x: 46, y: 39 }, { x: 54, y: 41 }, { x: 40, y: 26 },
  { x: 61, y: 25 }, { x: 50, y: 34 }, { x: 33, y: 32 }, { x: 67, y: 43 },
];
const AUTUMN = ["#e6c14a", "#d99a3a", "#c2702c"];
const DLEAF = "M0 -1.9 C0.9 -1 0.8 1 0 1.9 C-0.8 1 -0.9 -1 0 -1.9 Z";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CanopyDecay: React.FC<{ amount: number }> = ({ amount }) => {
  const a = clamp01((amount - 0.06) / 0.94);
  if (a <= 0) return null;
  const shown = Math.round(a * DECAY_SPOTS.length);
  const rand = rng(4242);
  const leaves: { x: number; y: number; r: number; s: number; fill: string }[] = [];

  for (let i = 0; i < shown; i++) {
    const spot = DECAY_SPOTS[i];
    const k = 3 + Math.round(rand() * 2);
    for (let j = 0; j < k; j++) {
      const warm = clamp01(a * 0.8 + rand() * 0.4);
      const ci = warm > 0.72 ? 2 : warm > 0.4 ? 1 : 0;
      leaves.push({ x: spot.x + (rand() - 0.5) * 8, y: spot.y + (rand() - 0.5) * 7, r: rand() * 360, s: 0.85 + rand() * 0.6, fill: AUTUMN[ci] });
    }
  }
  if (a > 0.45) {
    const fell = Math.round((a - 0.45) * 12);
    for (let i = 0; i < fell; i++) {
      leaves.push({ x: 30 + rand() * 42, y: 70 + rand() * 5, r: rand() * 360, s: 0.9 + rand() * 0.5, fill: AUTUMN[1 + Math.round(rand())] });
    }
  }

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 3, pointerEvents: "none" }}>
      {leaves.map((l, i) => (
        <path key={i} d={DLEAF} fill={l.fill} opacity={0.92} transform={`translate(${l.x} ${l.y}) rotate(${l.r}) scale(${l.s})`} />
      ))}
    </svg>
  );
};

/** The willow as a full loop: mastery grows, memory fades (autumn + needs
 * review) when you stop, then heals when you return. The spaced-repetition story. */
export const S6Willow: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useDesignFrame();

  const p = ramp(frame, [0, 120], [0, 1]);
  const f = p * 6;
  const lower = Math.min(Math.max(Math.floor(f), 0), 6);
  const upper = Math.min(lower + 1, 6);
  const frac = f - lower;

  // Grow, then fade and hold in the "needs review" autumn stage for a good beat,
  // then heal. The review hold (270-400) is deliberately long so it reads.
  let retention = 1;
  if (frame < 160) retention = 1;
  else if (frame < 270) retention = ramp(frame, [160, 270], [1, 0.16], { easing: easeInOut });
  else if (frame < 400) retention = 0.16;
  else if (frame < 500) retention = ramp(frame, [400, 500], [0.16, 1], { easing: easeInOut });
  const health = clamp01(retention);

  const filter = `saturate(${(0.6 + 0.4 * health).toFixed(2)}) sepia(${((1 - health) * 0.28).toFixed(2)})`;
  const glow = clamp01(p) * health ** 1.4;
  const pill = ramp(frame, [215, 235, 395, 415], [0, 1, 1, 0]);

  const capGrow = ramp(frame, [22, 44, 150, 175], [0, 1, 1, 0]);
  const capFade = ramp(frame, [180, 205, 375, 400], [0, 1, 1, 0]);
  const capHeal = ramp(frame, [410, 435, 560, 585], [0, 1, 1, 0]);

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(frame, dur), justifyContent: "center", alignItems: "center" }}>
      <div style={{ position: "relative", height: 90, width: 1000, marginBottom: 6 }}>
        <Caption opacity={capGrow}>Mastery you actually develop.</Caption>
        <Caption opacity={capFade}>Stop practicing, and it fades.</Caption>
        <Caption opacity={capHeal}>Come back, and it heals.</Caption>
      </div>

      <div style={{ position: "relative", width: TREE, height: TREE }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: glow * 0.5,
            background: "radial-gradient(closest-side at 50% 40%, rgba(139,127,214,0.4), transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            mixBlendMode: "multiply",
            WebkitMaskImage: "radial-gradient(closest-side at 50% 46%, #000 56%, transparent 92%)",
            maskImage: "radial-gradient(closest-side at 50% 46%, #000 56%, transparent 92%)",
          }}
        >
          <Img src={staticFile(`willow-g${lower + 1}.webp`)} style={{ position: "absolute", inset: 0, width: TREE, height: TREE, objectFit: "contain", filter }} />
          <Img src={staticFile(`willow-g${upper + 1}.webp`)} style={{ position: "absolute", inset: 0, width: TREE, height: TREE, objectFit: "contain", opacity: frac, filter }} />
        </div>
        <CanopyDecay amount={1 - health} />

        {pill > 0.01 ? (
          <div
            style={{
              position: "absolute",
              right: 36,
              top: 70,
              opacity: pill,
              transform: `translateY(${(1 - pill) * -8}px)`,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: COLORS.warningFill,
              color: "#8A6D1A",
              border: "1px solid #E6CE8E",
              borderRadius: 999,
              padding: "8px 16px",
              fontSize: 19,
              fontWeight: 700,
              boxShadow: "0 8px 20px -10px rgba(40,50,80,0.3)",
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: 999, background: "#C7A53C" }} />
            Needs review
          </div>
        ) : null}
      </div>

      <div style={{ width: 460, height: 10, borderRadius: 999, background: COLORS.border, overflow: "hidden", marginTop: 10 }}>
        <div style={{ width: `${clamp01(p * health) * 100}%`, height: "100%", background: COLORS.lilac, borderRadius: 999 }} />
      </div>
    </AbsoluteFill>
  );
};

const Caption: React.FC<{ opacity: number; children: React.ReactNode }> = ({ opacity, children }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 56,
      fontWeight: 600,
      letterSpacing: -1.5,
      color: COLORS.ink,
      opacity,
    }}
  >
    {children}
  </div>
);
