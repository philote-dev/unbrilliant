import { easeOut, ramp } from "../anim";
import { useDesignFrame } from "../timing";

/**
 * Graphs as a subway map. A published metro diagram where one stop pair (C to D)
 * is listed in the adjacency list but not yet drawn: a lilac drag gesture is
 * rubber-banding the missing segment into place. The "1 gap" badge counts it.
 *
 * Self-contained and self-animating. Designed for a ~1180 x 700 parent card.
 */

const PAPER = "#f7f2ea";
const PAPER_DEEP = "#efe7d8";
const INK = "#16181d";
const MUTED = "#8a7f6a";
const RED = "#ef5350";
const BLUE = "#1aa7e0";
const GREEN = "#16b08a";
const LILAC = "#8B7FD6";

// Octolinear layout in a 300 x 220 field. Diagonals are true 45 degrees.
type Station = { id: string; x: number; y: number; hub?: boolean };
const STATIONS: Station[] = [
  { id: "F", x: 80, y: 55 },
  { id: "B", x: 220, y: 55 },
  { id: "C", x: 135, y: 110, hub: true },
  { id: "D", x: 220, y: 110 },
  { id: "A", x: 80, y: 165 },
  { id: "E", x: 135, y: 165 },
  { id: "G", x: 220, y: 165 },
];

const LINES: { d: string; color: string }[] = [
  // Harbor Loop: the outer rectangle through F, B, G, A (passes D and E).
  { d: "M 80 165 L 80 55 L 220 55 L 220 165 L 80 165 Z", color: RED },
  // Park Line: a chord through the interchange, F -> C -> E.
  { d: "M 80 55 L 135 110 L 135 165", color: BLUE },
  // Branch into the interchange, A -> C.
  { d: "M 80 165 L 135 110", color: GREEN },
];

const C_X = 135;
const D_X = 220;
const LINE_Y = 110;

export const SubwayMini: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const frame = useDesignFrame();

  // Entrance (staggered fade + slide), then a settled poster.
  const field = ramp(frame, [0, 14], [0, 1]);
  const head = ramp(frame, [2, 22], [0, 1], { easing: easeOut });
  const badge = ramp(frame, [10, 28], [0, 1], { easing: easeOut });
  const legend = ramp(frame, [16, 36], [0, 1], { easing: easeOut });
  const mapIn = ramp(frame, [4, 30], [0, 1], { easing: easeOut });

  // The drag gesture: extend a lilac dashed line from C toward D (the gap).
  const dragT = ramp(frame, [25, 70], [0, 1], { easing: easeOut });
  const dragX = C_X + (D_X - 4 - C_X) * dragT;
  const march = -(frame * 0.7);
  const tipPulse = 1 + Math.sin(frame * 0.18) * 0.16;
  const dotPulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(frame * 0.16));

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: `radial-gradient(130% 110% at 28% -10%, ${PAPER} 0%, ${PAPER_DEEP} 100%)`,
        opacity: field,
        ...style,
      }}
    >
      {/* Roundel + title */}
      <div
        style={{
          position: "absolute",
          top: 42,
          left: 54,
          display: "flex",
          alignItems: "center",
          gap: 18,
          opacity: head,
          transform: `translateY(${(1 - head) * -10}px)`,
        }}
      >
        <Roundel />
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: MUTED }}>
            Network planning
          </span>
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.4, color: INK }}>City Metro</span>
        </div>
      </div>

      {/* Status badge */}
      <div
        style={{
          position: "absolute",
          top: 50,
          right: 54,
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          background: "#f6eecb",
          color: "#8a6d1a",
          border: "1px solid #e6ce8e",
          borderRadius: 999,
          padding: "9px 18px",
          fontSize: 18,
          fontWeight: 700,
          opacity: badge,
          transform: `translateY(${(1 - badge) * -10}px)`,
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: 999, background: "#caa53a", opacity: dotPulse }} />
        1 gap
      </div>

      {/* The map */}
      <svg viewBox="0 0 300 220" style={{ position: "absolute", top: 14, left: 140, width: 900, height: 660 }}>
        <g opacity={mapIn} transform={`translate(150 110) scale(${0.95 + mapIn * 0.05}) translate(-150 -110)`}>
          {/* White casing under every colored line */}
          {LINES.map((l, i) => (
            <path key={`case-${i}`} d={l.d} fill="none" stroke="#ffffff" strokeWidth={12.5} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {/* Colored lines */}
          {LINES.map((l, i) => (
            <path key={`line-${i}`} d={l.d} fill="none" stroke={l.color} strokeWidth={8.5} strokeLinecap="round" strokeLinejoin="round" />
          ))}

          {/* The gap: faint dashed placeholder C -> D */}
          <path
            d={`M ${C_X} ${LINE_Y} L ${D_X} ${LINE_Y}`}
            fill="none"
            stroke="#bcae93"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="3 7"
            opacity={0.8}
          />

          {/* The lilac drag in progress */}
          {dragT > 0.02 ? (
            <>
              <path
                d={`M ${C_X} ${LINE_Y} L ${dragX} ${LINE_Y}`}
                fill="none"
                stroke={LILAC}
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray="7 6"
                strokeDashoffset={march}
              />
              <circle cx={dragX} cy={LINE_Y} r={6.5} fill={LILAC} opacity={0.18} />
              <circle cx={dragX} cy={LINE_Y} r={3.6 * tipPulse} fill={LILAC} />
              <Cursor x={dragX + 3} y={LINE_Y + 3} />
            </>
          ) : null}

          {/* Stations on top */}
          {STATIONS.map((s, i) => {
            const pop = ramp(frame, [8 + i * 3, 28 + i * 3], [0, 1], { easing: easeOut });
            const r = s.hub ? 10 : 7;
            return (
              <g key={s.id} opacity={pop} transform={`translate(${s.x} ${s.y}) scale(${0.4 + pop * 0.6})`}>
                <circle r={r} fill="#ffffff" stroke={INK} strokeWidth={s.hub ? 3.6 : 2.6} />
                <text
                  x={0}
                  y={0}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={s.hub ? 11 : 9.5}
                  fontWeight={800}
                  fill={INK}
                  stroke="#ffffff"
                  strokeWidth={2.2}
                  style={{ paintOrder: "stroke" }}
                >
                  {s.id}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          left: 54,
          bottom: 42,
          display: "inline-flex",
          alignItems: "center",
          gap: 20,
          background: "rgba(255,255,255,0.72)",
          border: "1px solid #e3d9c4",
          borderRadius: 999,
          padding: "11px 20px",
          fontSize: 16,
          color: MUTED,
          fontWeight: 600,
          opacity: legend,
          transform: `translateY(${(1 - legend) * 10}px)`,
        }}
      >
        <Swatch color={RED} label="Harbor Loop" />
        <Swatch color={BLUE} label="Park Line" />
        <Swatch color={GREEN} label="Branch" />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <TransferIcon /> transfer
        </span>
      </div>
    </div>
  );
};

const Roundel: React.FC = () => (
  <svg width={40} height={40} viewBox="0 0 40 40">
    <circle cx={20} cy={20} r={15} fill="none" stroke={RED} strokeWidth={5.5} />
    <rect x={4} y={16.5} width={32} height={7} rx={3.5} fill={RED} />
  </svg>
);

const Swatch: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
    <span style={{ width: 16, height: 8, borderRadius: 999, background: color }} />
    {label}
  </span>
);

const TransferIcon: React.FC = () => (
  <svg width={22} height={16} viewBox="0 0 22 16">
    <rect x={1.5} y={3} width={19} height={10} rx={5} fill="#ffffff" stroke={INK} strokeWidth={2.4} />
  </svg>
);

const Cursor: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x} ${y}) scale(0.55)`}>
    <path
      d="M0 0 L0 17 L4.2 13.2 L7.4 19.5 L10 18.2 L6.8 12 L12 12 Z"
      fill="#ffffff"
      stroke={INK}
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  </g>
);
