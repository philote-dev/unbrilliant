import { spring } from "remotion";

import { ramp } from "../../anim";
import { BASE_FPS, useDesignFrame } from "../../timing";
import { Cursor } from "../../components/Cursor";
import { CrossIcon } from "../../components/icons";
import { PolyAvatar } from "../../components/PolyAvatar";
import { StreamText } from "../../components/StreamText";
import { pointAt, type PathPoint } from "../../cursorPath";
import { COLORS, RADIUS } from "../../theme";

const CARD_W = 138;
const CARD_H = 92;

const TRAY_12 = { x: 470, y: 430 };
const PLATFORM = { x: 350, y: 254 };

// Hand-like drag: ease into the card, then a quick arced, eased drag to the platform.
const DRAG: PathPoint[] = [
  { frame: 12, x: 600, y: 482 },
  { frame: 40, x: TRAY_12.x, y: TRAY_12.y, curve: 22 },
  { frame: 92, x: PLATFORM.x, y: PLATFORM.y, curve: -78 },
];

const HINT = "You placed 12 first. A stack only grows from the top.";

const Card: React.FC<{ x: number; y: number; value: number; danger?: boolean }> = ({ x, y, value, danger }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: CARD_W,
      height: CARD_H,
      marginLeft: -CARD_W / 2,
      marginTop: -CARD_H / 2,
      borderRadius: RADIUS.card,
      background: danger ? COLORS.dangerFill : COLORS.lilacSoft,
      border: `2.5px solid ${danger ? COLORS.danger : COLORS.lilac}`,
      boxShadow: "0 10px 24px -12px rgba(40,50,80,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 46,
      fontWeight: 700,
      color: COLORS.ink,
    }}
  >
    {value}
    {danger ? (
      <span
        style={{
          position: "absolute",
          top: -14,
          right: -14,
          display: "flex",
          width: 34,
          height: 34,
          borderRadius: 999,
          background: "#fff",
          border: `2.5px solid ${COLORS.danger}`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CrossIcon size={20} />
      </span>
    ) : null}
  </div>
);

/** Desktop "build a stack" beat. Natural eased+curved drag, wrong order, then a
 * zoom into Poly streaming a no-spoiler hint. Shown full-frame. */
export const StackConstructWeb: React.FC = () => {
  const frame = useDesignFrame();

  const grabbed = frame >= 40;
  const card12 = grabbed ? pointAt(DRAG, frame) : TRAY_12;
  const danger = frame >= 92;
  const shake = frame >= 92 && frame < 118 ? Math.sin((frame - 92) * 1.5) * (1 - (frame - 92) / 26) * 9 : 0;
  const card7Pulse = frame >= 120 ? 1 + Math.sin((frame - 120) * 0.17) * 0.05 : 1;

  const thinking = frame >= 100;
  const hintStart = 150;
  const showHint = frame >= hintStart;
  const dots = ".".repeat((Math.floor(frame / 10) % 3) + 1);
  const panelIn = ramp(frame, [100, 128], [0, 1]);
  const z = spring({ fps: BASE_FPS, frame: frame - 150, config: { damping: 26, mass: 0.8 } });
  const zoom = 1 + z * 0.1;

  return (
    <div style={{ height: "100%", transform: `scale(${zoom})`, transformOrigin: "86% 32%" }}>
      <div style={{ display: "flex", height: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "40px 48px 0", minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1.2, color: COLORS.lilac }}>
            DATA STRUCTURES · STACKS &amp; QUEUES
          </div>
          <div style={{ marginTop: 14, height: 8, width: 280, borderRadius: 999, background: COLORS.border }}>
            <div style={{ width: "38%", height: "100%", borderRadius: 999, background: COLORS.lilac }} />
          </div>

          <div style={{ marginTop: 30, fontSize: 40, fontWeight: 700, letterSpacing: -1, color: COLORS.ink }}>Build the stack</div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, fontSize: 24, color: COLORS.muted }}>
            push <Chip>7</Chip> then <Chip>12</Chip>
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "relative", width: 700, height: 520 }}>
              <div style={{ position: "absolute", left: 350, top: 300, width: 240, height: 18, marginLeft: -120, borderRadius: 999, background: COLORS.borderStrong }} />
              <div
                style={{
                  position: "absolute",
                  left: 350,
                  top: 150,
                  width: 200,
                  height: 200,
                  marginLeft: -100,
                  borderRadius: RADIUS.card,
                  border: `2px dashed ${COLORS.border}`,
                  opacity: frame < 92 ? 0.9 : 0,
                }}
              />

              <div style={{ transform: `scale(${card7Pulse})`, transformOrigin: "230px 430px" }}>
                <Card x={230} y={430} value={7} />
              </div>
              {frame >= 118 && frame < 150 ? (
                <div style={{ position: "absolute", left: 230, top: 372, transform: "translateX(-50%)", fontSize: 18, fontWeight: 700, color: COLORS.lilac }}>
                  this one first?
                </div>
              ) : null}

              <div style={{ transform: `translateX(${shake}px)` }}>
                <Card x={card12.x} y={card12.y} value={12} danger={danger} />
              </div>

              <Cursor path={DRAG} taps={[40, 92]} />
            </div>
          </div>
        </div>

        <div
          style={{
            width: 384,
            flexShrink: 0,
            borderLeft: `1px solid ${COLORS.border}`,
            background: COLORS.surfaceMuted,
            padding: 30,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <PolyAvatar size={40} />
            <span style={{ fontSize: 22, fontWeight: 700, color: COLORS.ink }}>Poly Hints</span>
          </div>

          {thinking ? (
            <div
              style={{
                opacity: panelIn,
                transform: `translateY(${(1 - panelIn) * 12}px)`,
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 18,
                borderTopLeftRadius: 6,
                padding: "18px 20px",
                fontSize: 21,
                lineHeight: 1.5,
                color: COLORS.ink,
                minHeight: 60,
              }}
            >
              {showHint ? (
                <StreamText text={HINT} start={hintStart} boldWords={["12"]} />
              ) : (
                <span style={{ color: COLORS.lilacInk, fontWeight: 600 }}>Poly is thinking{dots}</span>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 18, color: COLORS.faint, lineHeight: 1.5 }}>
              Stuck on a build? Poly steps in with a nudge.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      display: "inline-flex",
      width: 46,
      height: 46,
      borderRadius: 13,
      background: COLORS.lilacSoft,
      border: `2px solid ${COLORS.lilac}`,
      alignItems: "center",
      justifyContent: "center",
      fontSize: 24,
      fontWeight: 700,
      color: COLORS.ink,
    }}
  >
    {children}
  </span>
);
