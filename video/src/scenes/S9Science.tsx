import { AbsoluteFill } from "remotion";

import { ramp, sceneOpacity } from "../anim";
import { useDesignFrame } from "../timing";
import { Eyebrow } from "../components/Eyebrow";
import { COLORS } from "../theme";

const PLOT = { x0: 90, x1: 950, yTop: 60, yBot: 380 };
const mapX = (t: number) => PLOT.x0 + t * (PLOT.x1 - PLOT.x0);
const mapY = (r: number) => PLOT.yBot - r * (PLOT.yBot - PLOT.yTop);

function toPath(pts: [number, number][]): string {
  return pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
}

// Standard Ebbinghaus forgetting curve: one exponential decay.
const STANDARD = (() => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    pts.push([mapX(t), mapY(Math.exp(-3.4 * t))]);
  }
  return pts;
})();

// Spaced reinforcement: each well-timed review resets retention high and the
// next decay is slower (the spacing effect), so the curve stays up.
const REVIEWS = [0.24, 0.48, 0.72];
const ENHANCED = (() => {
  const ks = [3.0, 1.8, 1.0, 0.55];
  const pts: [number, number][] = [];
  let seg = 0;
  let segStart = 0;
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    if (seg < REVIEWS.length && t >= REVIEWS[seg]) {
      pts.push([mapX(REVIEWS[seg]), mapY(Math.exp(-ks[seg] * (REVIEWS[seg] - segStart)))]);
      pts.push([mapX(REVIEWS[seg]), mapY(0.98)]);
      seg++;
      segStart = REVIEWS[seg - 1];
    }
    pts.push([mapX(t), mapY(Math.exp(-ks[seg] * (t - segStart)))]);
  }
  return pts;
})();

const STANDARD_D = toPath(STANDARD);
const ENHANCED_D = toPath(ENHANCED);

/** Backed by learning science: draw the forgetting curve, then morph it into the
 * spaced-reinforcement enhanced curve. */
export const S9Science: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useDesignFrame();

  const head = ramp(frame, [10, 34], [0, 1]);
  const stdDraw = ramp(frame, [44, 140], [0, 1]);
  const stdGhost = ramp(frame, [180, 214], [1, 0.18]);
  const enhDraw = ramp(frame, [190, 312], [0, 1]);

  const labelStd = ramp(frame, [120, 140, 184, 204], [0, 1, 1, 0]);
  const labelEnh = ramp(frame, [248, 272], [0, 1]);

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(frame, dur), justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center", opacity: head, transform: `translateY(${(1 - head) * 12}px)` }}>
        <Eyebrow style={{ marginBottom: 16 }}>Mastery Engine</Eyebrow>
        <div style={{ fontSize: 56, fontWeight: 600, letterSpacing: -2, color: COLORS.ink }}>
          Built on real learning science.
        </div>
      </div>

      <svg width={1100} height={460} viewBox="0 0 1040 440" style={{ marginTop: 18 }}>
        {/* axes */}
        <line x1={PLOT.x0} y1={PLOT.yTop - 14} x2={PLOT.x0} y2={PLOT.yBot} stroke={COLORS.border} strokeWidth={2} />
        <line x1={PLOT.x0} y1={PLOT.yBot} x2={PLOT.x1 + 14} y2={PLOT.yBot} stroke={COLORS.border} strokeWidth={2} />
        <text x={PLOT.x0 - 16} y={PLOT.yTop + 4} textAnchor="end" fontSize={20} fill={COLORS.faint} fontWeight={600}>100%</text>
        <text x={PLOT.x0 - 16} y={PLOT.yBot} textAnchor="end" fontSize={20} fill={COLORS.faint} fontWeight={600}>0%</text>
        <text x={(PLOT.x0 + PLOT.x1) / 2} y={PLOT.yBot + 34} textAnchor="middle" fontSize={20} fill={COLORS.muted} fontWeight={600}>Time since learning</text>

        {/* standard forgetting curve */}
        <path
          d={STANDARD_D}
          fill="none"
          stroke={COLORS.danger}
          strokeWidth={5}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - stdDraw}
          opacity={stdGhost}
        />

        {/* review markers */}
        {REVIEWS.map((r, i) => {
          const op = ramp(enhDraw, [r, r + 0.05], [0, 1]);
          return (
            <g key={i} opacity={op}>
              <line x1={mapX(r)} y1={PLOT.yTop - 6} x2={mapX(r)} y2={PLOT.yBot} stroke={COLORS.lilac} strokeWidth={1.5} strokeDasharray="4 6" opacity={0.5} />
              <circle cx={mapX(r)} cy={mapY(0.98)} r={8} fill={COLORS.lilac} />
              <text x={mapX(r)} y={PLOT.yTop - 16} textAnchor="middle" fontSize={17} fill={COLORS.lilacInk} fontWeight={700}>review</text>
            </g>
          );
        })}

        {/* enhanced curve */}
        <path
          d={ENHANCED_D}
          fill="none"
          stroke={COLORS.lilac}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - enhDraw}
        />
      </svg>

      <div style={{ position: "relative", height: 40, width: 900, marginTop: 4 }}>
        <Label opacity={labelStd} color={COLORS.danger}>Memory fades on its own: the forgetting curve.</Label>
        <Label opacity={labelEnh} color={COLORS.lilacInk}>Poly's spaced reinforcement keeps it high.</Label>
      </div>
    </AbsoluteFill>
  );
};

const Label: React.FC<{ opacity: number; color: string; children: React.ReactNode }> = ({ opacity, color, children }) => (
  <div style={{ position: "absolute", inset: 0, textAlign: "center", fontSize: 26, fontWeight: 600, color, opacity }}>
    {children}
  </div>
);
