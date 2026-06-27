import { easeOut, ramp } from "../anim";
import { useDesignFrame } from "../timing";

/**
 * Linked lists as a music queue. A playlist is a chain of nodes, each pointing
 * at the next track. Inserting a song is just re-aiming one pointer: a dashed
 * green arrow extends into the new "Ferris Wheel" row (the insert gesture).
 *
 * Self-contained and self-animating. Designed for a ~1180 x 700 parent card.
 */

const BG = "#121212";
const GREEN = "#1db954";
const WHITE = "#ffffff";

const PAD = 44;
const INNER_W = 1180 - PAD * 2; // 1092
const GUTTER_W = 92;
const ROW_W = INNER_W - GUTTER_W; // 1000
const ROW_H = 100;
const ROW_GAP = 20;
const REGION_H = ROW_H * 4 + ROW_GAP * 3; // 460
const GUTTER_MID = ROW_W + 46; // arrow elbow runs down here

type Track = { title: string; artist: string; grad: string; head?: boolean; isNew?: boolean };
const TRACKS: Track[] = [
  { title: "Golden Hour", artist: "Whitfield & Vale", grad: "linear-gradient(135deg,#7c3aed,#2563eb)", head: true },
  { title: "Velvet Hours", artist: "Mara Quill", grad: "linear-gradient(135deg,#0ea5e9,#22d3ee)" },
  { title: "Paper Skylines", artist: "The Lantern Hour", grad: "linear-gradient(135deg,#f59e0b,#ef4444)" },
  { title: "Ferris Wheel", artist: "Odd Comfort", grad: "linear-gradient(135deg,#1db954,#0f8a3e)", isNew: true },
];

const rowTop = (i: number) => i * (ROW_H + ROW_GAP);

type Pt = { x: number; y: number };

function polyPartial(pts: Pt[], t: number): { d: string; tip: Pt; ang: number } {
  const segs: { a: Pt; b: Pt; len: number }[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segs.push({ a, b, len });
    total += len;
  }
  let remaining = Math.max(0, Math.min(1, t)) * total;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  let tip: Pt = pts[0];
  let ang = 0;
  for (const s of segs) {
    ang = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x);
    if (remaining >= s.len) {
      d += ` L ${s.b.x} ${s.b.y}`;
      tip = s.b;
      remaining -= s.len;
    } else if (remaining > 0) {
      const k = remaining / s.len;
      tip = { x: s.a.x + (s.b.x - s.a.x) * k, y: s.a.y + (s.b.y - s.a.y) * k };
      d += ` L ${tip.x.toFixed(1)} ${tip.y.toFixed(1)}`;
      remaining = 0;
      break;
    } else {
      break;
    }
  }
  return { d, tip, ang };
}

export const QueueMini: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const frame = useDesignFrame();

  const field = ramp(frame, [0, 12], [0, 1]);
  const head = ramp(frame, [2, 22], [0, 1], { easing: easeOut });
  const foot = ramp(frame, [18, 40], [0, 1], { easing: easeOut });

  // The insert: re-aim the pointer into the new last row.
  const reaim = ramp(frame, [25, 70], [0, 1], { easing: easeOut });
  const march = -(frame * 0.6);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: BG,
        opacity: field,
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: PAD,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            opacity: head,
            transform: `translateY(${(1 - head) * -10}px)`,
          }}
        >
          <div>
            <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -0.8, color: WHITE }}>Queue</div>
            <div style={{ marginTop: 6, fontSize: 20 }}>
              <span style={{ color: "rgba(255,255,255,0.6)" }}>Playing </span>
              <span style={{ color: WHITE, fontWeight: 700 }}>Liked Songs</span>
            </div>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              color: WHITE,
              fontSize: 19,
              fontWeight: 600,
              borderRadius: 999,
              padding: "9px 24px",
            }}
          >
            Edit
          </div>
        </div>

        {/* Rows + pointer gutter */}
        <div style={{ position: "relative", width: INNER_W, height: REGION_H }}>
          {TRACKS.map((t, i) => {
            const appear = ramp(frame, [6 + i * 6, 26 + i * 6], [0, 1], { easing: easeOut });
            return (
              <div
                key={t.title}
                style={{
                  position: "absolute",
                  top: rowTop(i),
                  left: 0,
                  width: ROW_W,
                  height: ROW_H,
                  display: "flex",
                  alignItems: "center",
                  gap: 22,
                  opacity: appear,
                  transform: `translateX(${(1 - appear) * 18}px)`,
                }}
              >
                <AlbumArt grad={t.grad} />
                <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {t.head ? <Equalizer frame={frame} /> : null}
                    <span
                      style={{
                        fontSize: 26,
                        fontWeight: 600,
                        color: t.head ? GREEN : WHITE,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {t.title}
                    </span>
                    {t.isNew ? (
                      <span
                        style={{
                          background: GREEN,
                          color: "#0a0a0a",
                          fontSize: 14,
                          fontWeight: 800,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                          borderRadius: 6,
                          padding: "3px 9px",
                        }}
                      >
                        New
                      </span>
                    ) : null}
                  </div>
                  <span style={{ fontSize: 19, color: "rgba(255,255,255,0.55)" }}>{t.artist}</span>
                </div>
                <DragHandle />
              </div>
            );
          })}

          {/* Pointer arrows in the right gutter */}
          <svg viewBox={`0 0 ${INNER_W} ${REGION_H}`} width={INNER_W} height={REGION_H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {[0, 1, 2].map((i) => {
              const by = rowTop(i) + ROW_H - 16;
              const ty = rowTop(i + 1) + 16;
              const pts: Pt[] = [
                { x: ROW_W, y: by },
                { x: GUTTER_MID, y: by },
                { x: GUTTER_MID, y: ty },
                { x: ROW_W + 6, y: ty },
              ];
              const isReaim = i === 2;
              return (
                <PointerArrow
                  key={i}
                  pts={pts}
                  t={isReaim ? reaim : 1}
                  dashed={isReaim}
                  march={march}
                />
              );
            })}
          </svg>
        </div>

        {/* Footer action */}
        <div
          style={{
            width: INNER_W,
            background: GREEN,
            color: "#0a0a0a",
            fontSize: 23,
            fontWeight: 800,
            borderRadius: 999,
            padding: "17px 0",
            textAlign: "center",
            opacity: foot,
            transform: `translateY(${(1 - foot) * 12}px)`,
          }}
        >
          Check
        </div>
      </div>
    </div>
  );
};

const AlbumArt: React.FC<{ grad: string }> = ({ grad }) => (
  <div
    style={{
      width: 72,
      height: 72,
      flexShrink: 0,
      borderRadius: 12,
      background: grad,
      position: "relative",
      boxShadow: "0 8px 18px -10px rgba(0,0,0,0.7)",
    }}
  >
    <svg width={26} height={26} viewBox="0 0 24 24" style={{ position: "absolute", right: 9, bottom: 9, opacity: 0.55 }} fill="#ffffff">
      <path d="M9 18V6l10-2v12" stroke="#ffffff" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <circle cx="7" cy="18" r="2.4" />
      <circle cx="17" cy="16" r="2.4" />
    </svg>
  </div>
);

const Equalizer: React.FC<{ frame: number }> = ({ frame }) => {
  const bars = [0, 1, 2].map((i) => 7 + 15 * (0.5 + 0.5 * Math.sin(frame * 0.32 + i * 1.25)));
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 3, height: 24, width: 22 }}>
      {bars.map((h, i) => (
        <span key={i} style={{ width: 5, height: h, borderRadius: 2, background: GREEN }} />
      ))}
    </span>
  );
};

const DragHandle: React.FC = () => (
  <span style={{ display: "inline-flex", flexDirection: "column", gap: 5, flexShrink: 0, paddingRight: 6 }}>
    {[0, 1, 2].map((i) => (
      <span key={i} style={{ width: 26, height: 2.5, borderRadius: 2, background: "rgba(255,255,255,0.4)" }} />
    ))}
  </span>
);

const PointerArrow: React.FC<{ pts: Pt[]; t: number; dashed?: boolean; march?: number }> = ({ pts, t, dashed, march = 0 }) => {
  const { d, tip, ang } = polyPartial(pts, t);
  if (t <= 0.001) return null;
  return (
    <g opacity={0.85}>
      <path
        d={d}
        fill="none"
        stroke={GREEN}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? "9 7" : undefined}
        strokeDashoffset={dashed ? march : undefined}
      />
      <path
        d="M0 0 L-12 -6.5 L-12 6.5 Z"
        fill={GREEN}
        transform={`translate(${tip.x.toFixed(1)} ${tip.y.toFixed(1)}) rotate(${((ang * 180) / Math.PI).toFixed(1)})`}
      />
    </g>
  );
};
