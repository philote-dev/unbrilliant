import { AbsoluteFill, spring } from "remotion";

import { ramp, sceneOpacity } from "../anim";
import { BASE_FPS, useDesignFrame } from "../timing";
import { PolyAvatar } from "../components/PolyAvatar";
import { COLORS } from "../theme";

/** Poly gets its own introduction: the mascot lands, looks around, and the line
 * names it. The gateway into the Poly feature beats that follow. */
export const S4MeetPoly: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useDesignFrame();

  const land = spring({ fps: BASE_FPS, frame: frame - 6, config: { damping: 200, mass: 0.9 } });
  const float = Math.sin(frame * 0.06) * 8;
  const breathe = 1 + Math.sin(frame * 0.08) * 0.012;

  // Pupil glances around for a touch of life, then settles forward.
  const look = ramp(frame, [40, 70, 92, 116], [0, 1, 1, 0]);
  const px = Math.sin(frame * 0.05) * 5 * look;
  const py = (Math.cos(frame * 0.07) * 3 - 1) * look;

  const line = ramp(frame, [54, 78], [0, 1]);
  const sub = ramp(frame, [70, 96], [0, 1]);
  const glow = land * (0.5 + 0.5 * Math.sin(frame * 0.08));

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(frame, dur), justifyContent: "center", alignItems: "center" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", height: 280 }}>
        <div
          style={{
            position: "absolute",
            width: 360,
            height: 360,
            borderRadius: 999,
            background: "radial-gradient(closest-side, rgba(139,127,214,0.32), transparent 70%)",
            opacity: glow,
          }}
        />
        <div style={{ transform: `translateY(${float - (1 - land) * 40}px) scale(${(0.6 + land * 0.4) * breathe})`, opacity: land }}>
          <PolyAvatar size={184} pupil={{ x: px, y: py }} />
        </div>
      </div>

      <div
        style={{
          marginTop: 54,
          fontSize: 76,
          fontWeight: 600,
          letterSpacing: -2.5,
          color: COLORS.ink,
          opacity: line,
          transform: `translateY(${(1 - line) * 14}px)`,
        }}
      >
        Now meet <span style={{ color: COLORS.lilacInk }}>Poly</span>.
      </div>

      <div
        style={{
          marginTop: 18,
          fontSize: 34,
          color: COLORS.muted,
          opacity: sub,
          transform: `translateY(${(1 - sub) * 12}px)`,
        }}
      >
        Your AI tutor.
      </div>
    </AbsoluteFill>
  );
};
