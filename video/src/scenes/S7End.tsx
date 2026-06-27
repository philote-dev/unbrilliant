import { AbsoluteFill, spring } from "remotion";

import { ramp } from "../anim";
import { BASE_FPS, useDesignFrame } from "../timing";
import { WillowLogo } from "../components/WillowLogo";
import { COLORS, RADIUS } from "../theme";

/** End card: the mark, the wordmark, the line, one CTA. */
export const S7End: React.FC<{ dur: number; cta: string }> = ({ dur, cta }) => {
  const frame = useDesignFrame();

  const mark = spring({ fps: BASE_FPS, frame, config: { damping: 200, mass: 0.8 } });
  const line = ramp(frame, [20, 42], [0, 1]);
  const ctaShow = spring({ fps: BASE_FPS, frame: frame - 36, config: { damping: 200 } });

  return (
    <AbsoluteFill
      style={{
        opacity: ramp(frame, [0, 16], [0, 1]),
        justifyContent: "center",
        alignItems: "center",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20, opacity: mark, transform: `scale(${0.9 + mark * 0.1})` }}>
        <WillowLogo height={92} color={COLORS.lilac} />
        <span style={{ fontSize: 84, fontWeight: 600, letterSpacing: -3, color: COLORS.ink }}>Willow</span>
      </div>

      <div
        style={{
          marginTop: 18,
          fontSize: 34,
          color: COLORS.muted,
          opacity: line,
          transform: `translateY(${(1 - line) * 10}px)`,
        }}
      >
        Think it through.
      </div>

      <div
        style={{
          marginTop: 40,
          background: COLORS.lilac,
          color: "#fff",
          fontSize: 26,
          fontWeight: 700,
          padding: "20px 44px",
          borderRadius: RADIUS.chip,
          boxShadow: "inset 0 -5px 0 rgba(74,63,140,0.45), 0 18px 40px -20px rgba(139,127,214,0.8)",
          opacity: ctaShow,
          transform: `translateY(${(1 - ctaShow) * 14}px)`,
        }}
      >
        {cta}
      </div>
    </AbsoluteFill>
  );
};
