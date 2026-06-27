import { easeOut, ramp } from "../anim";
import { useDesignFrame } from "../timing";

/**
 * Hash tables as a warehouse stow station. Every package looks like identical
 * kraft tan, so storage is chaotic, but a hash of the SKU indexes exactly one
 * bin: a direct O(1) jump. The scanned formula points at bin 3, the armed bin
 * already holds a carton (a collision chain), and the package drops straight in.
 *
 * Self-contained and self-animating. Designed for a ~1180 x 700 parent card.
 */

const INK = "#232f3e";
const ORANGE = "#ff9900";
const CYAN = "#08aae3";
const KRAFT_A = "#ddbd87";
const KRAFT_B = "#b78d52";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const SOURCE = { x: 590, y: 196 };
const TARGET = { x: 766, y: 540 };
const BOX = 100;

type Bin = { idx: number; x: number; y: number; w: number; h: number };
const BINS: Bin[] = [
  { idx: 0, x: 250, y: 366, w: 327, h: 116 },
  { idx: 1, x: 603, y: 366, w: 327, h: 116 },
  { idx: 2, x: 250, y: 500, w: 327, h: 116 },
  { idx: 3, x: 603, y: 500, w: 327, h: 116 },
];
const ARMED = 3;

export const WarehouseMini: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const frame = useDesignFrame();

  const field = ramp(frame, [0, 12], [0, 1]);
  const head = ramp(frame, [2, 22], [0, 1], { easing: easeOut });
  const scanIn = ramp(frame, [10, 30], [0, 1], { easing: easeOut });
  const foot = ramp(frame, [18, 40], [0, 1], { easing: easeOut });
  const boxIn = ramp(frame, [8, 24], [0, 1], { easing: easeOut });

  // The drop: arc the package from the inbound slot into bin 3.
  const drop = ramp(frame, [25, 70], [0, 1], { easing: easeOut });
  const px = SOURCE.x + (TARGET.x - SOURCE.x) * drop;
  const py = SOURCE.y + (TARGET.y - SOURCE.y) * drop - 64 * Math.sin(Math.PI * drop);
  const pscale = (0.4 + boxIn * 0.6) * (1 - 0.12 * drop);
  const protate = -7 * Math.sin(Math.PI * drop);

  const arm = 0.5 + 0.5 * Math.sin(frame * 0.16);
  const guide = ramp(frame, [25, 48], [0, 0.5]);
  const march = -(frame * 0.6);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: INK,
        opacity: field,
        ...style,
      }}
    >
      {/* Header */}
      <div style={{ position: "absolute", top: 36, left: 48, opacity: head, transform: `translateY(${(1 - head) * -10}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <BoxGlyph />
          <span style={{ fontSize: 22, fontWeight: 600, color: "#ffffff", letterSpacing: 0.2 }}>Fulfilment Center</span>
        </div>
        <Swoosh />
        <div style={{ marginTop: 8, fontSize: 34, fontWeight: 800, letterSpacing: -0.6, color: "#ffffff" }}>Stow station</div>
      </div>

      {/* Inbound meta badge */}
      <div
        style={{
          position: "absolute",
          top: 44,
          right: 48,
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.16)",
          borderRadius: 999,
          padding: "9px 18px",
          fontSize: 17,
          fontWeight: 600,
          color: "rgba(255,255,255,0.85)",
          opacity: head,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 999, background: ORANGE }} />
        Inbound
      </div>

      {/* Trajectory guide */}
      <svg viewBox="0 0 1180 700" width={1180} height={700} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <path
          d={`M ${SOURCE.x} ${SOURCE.y + 56} Q 678 230 ${TARGET.x} ${TARGET.y - 30}`}
          fill="none"
          stroke={ORANGE}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray="6 9"
          strokeDashoffset={march}
          opacity={guide}
        />
      </svg>

      {/* Inbound source slot + identity */}
      <div
        style={{
          position: "absolute",
          left: SOURCE.x - BOX / 2,
          top: SOURCE.y - BOX / 2,
          width: BOX,
          height: BOX,
          borderRadius: 12,
          border: "2px dashed rgba(255,255,255,0.18)",
          opacity: boxIn * 0.9,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: SOURCE.y + BOX / 2 + 12,
          textAlign: "center",
          opacity: boxIn,
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: "#ffffff", letterSpacing: 1 }}>IVY-58</div>
        <div style={{ marginTop: 3, fontSize: 17, color: "rgba(255,255,255,0.6)" }}>Running shoes</div>
      </div>

      {/* SCAN pill */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 304, display: "flex", justifyContent: "center", opacity: scanIn, transform: `translateY(${(1 - scanIn) * 8}px)` }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            background: "rgba(8,170,227,0.1)",
            border: "1.5px solid rgba(8,170,227,0.4)",
            borderRadius: 999,
            padding: "11px 20px",
            boxShadow: "0 0 26px rgba(8,170,227,0.32)",
          }}
        >
          <span
            style={{
              background: "rgba(8,170,227,0.18)",
              color: CYAN,
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: 1.5,
              borderRadius: 6,
              padding: "4px 10px",
            }}
          >
            SCAN
          </span>
          <span style={{ fontFamily: MONO, fontSize: 21, color: "#ffffff", letterSpacing: 0.3 }}>
            {"\u03A3"} ivy = 39 {"\u00B7"} mod 4 = ?
          </span>
        </div>
      </div>

      {/* Bin wall */}
      {BINS.map((b, i) => {
        const pop = ramp(frame, [14 + i * 5, 34 + i * 5], [0, 1], { easing: easeOut });
        const armed = b.idx === ARMED;
        return (
          <div
            key={b.idx}
            style={{
              position: "absolute",
              left: b.x,
              top: b.y,
              width: b.w,
              height: b.h,
              borderRadius: 10,
              border: armed ? `2px dashed ${ORANGE}` : "2px solid rgba(255,255,255,0.15)",
              background: armed ? `rgba(255,153,0,${(0.1 + 0.06 * arm).toFixed(3)})` : "rgba(255,255,255,0.04)",
              boxShadow: armed ? `0 0 ${(16 + 12 * arm).toFixed(1)}px rgba(255,153,0,${(0.22 + 0.16 * arm).toFixed(3)})` : "none",
              opacity: pop,
              transform: `translateY(${(1 - pop) * 14}px)`,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                width: 32,
                height: 32,
                borderRadius: 6,
                background: ORANGE,
                color: INK,
                fontFamily: MONO,
                fontSize: 18,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {b.idx}
            </span>

            {armed ? (
              <span
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  color: ORANGE,
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: 2,
                  opacity: 0.6 + 0.4 * arm,
                }}
              >
                DROP
              </span>
            ) : null}

            {/* Existing carton (the collision chain item) in the armed bin */}
            {armed ? (
              <div style={{ position: "absolute", left: "50%", bottom: 12, transform: "translateX(-50%)" }}>
                <KraftBox w={104} h={40} />
              </div>
            ) : null}
          </div>
        );
      })}

      {/* The travelling package */}
      <div
        style={{
          position: "absolute",
          left: px - BOX / 2,
          top: py - BOX / 2,
          width: BOX,
          height: BOX,
          opacity: boxIn,
          transform: `scale(${pscale}) rotate(${protate.toFixed(2)}deg)`,
          transformOrigin: "center",
        }}
      >
        <KraftBox w={BOX} h={BOX} />
      </div>

      {/* Footer action */}
      <div
        style={{
          position: "absolute",
          left: 250,
          top: 636,
          width: 680,
          background: ORANGE,
          color: INK,
          fontSize: 22,
          fontWeight: 800,
          borderRadius: 12,
          padding: "15px 0",
          textAlign: "center",
          opacity: foot,
          transform: `translateY(${(1 - foot) * 12}px)`,
        }}
      >
        Check
      </div>
    </div>
  );
};

const KraftBox: React.FC<{ w: number; h: number }> = ({ w, h }) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: Math.min(w, h) * 0.12,
      background: `linear-gradient(150deg, ${KRAFT_A}, ${KRAFT_B})`,
      position: "relative",
      overflow: "hidden",
      boxShadow: "0 16px 30px -14px rgba(0,0,0,0.6)",
    }}
  >
    {/* top flap seam */}
    <div style={{ position: "absolute", left: 0, right: 0, top: h * 0.3, height: 2, background: "rgba(74,52,20,0.4)" }} />
    {/* packing tape */}
    <div style={{ position: "absolute", top: 0, bottom: 0, left: w * 0.42, width: w * 0.16, background: "rgba(255,246,228,0.3)" }} />
  </div>
);

const BoxGlyph: React.FC = () => (
  <svg width={30} height={30} viewBox="0 0 30 30">
    <rect x={4} y={8} width={22} height={18} rx={3} fill={KRAFT_A} stroke={KRAFT_B} strokeWidth={1.5} />
    <path d="M4 13 H26" stroke={KRAFT_B} strokeWidth={1.5} />
    <rect x={13} y={8} width={4} height={18} fill="rgba(255,246,228,0.4)" />
  </svg>
);

const Swoosh: React.FC = () => (
  <svg width={218} height={20} viewBox="0 0 218 20" style={{ marginTop: 4, marginLeft: 42, display: "block" }}>
    <path
      d="M4 6 C 70 20 150 20 206 5 L 198 3 M206 5 L 202 13"
      fill="none"
      stroke={ORANGE}
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
