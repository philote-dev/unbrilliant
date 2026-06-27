import { AbsoluteFill, spring } from "remotion";

import { ramp, sceneOpacity } from "../anim";
import { BASE_FPS, useDesignFrame } from "../timing";
import { WillowLogo } from "../components/WillowLogo";
import { COLORS } from "../theme";

/** Product reveal as a brand beat: the wordmark and the one-line promise. The
 * interactive lessons, then Poly, follow in their own beats. */
export const S2Reveal: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useDesignFrame();

  const mark = spring({ fps: BASE_FPS, frame, config: { damping: 200, mass: 0.8 } });
  const head = ramp(frame, [20, 46], [0, 1]);

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(frame, dur), justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22, opacity: mark, transform: `scale(${0.9 + mark * 0.1})` }}>
        <WillowLogo height={88} color={COLORS.lilac} />
        <span style={{ fontSize: 96, fontWeight: 600, letterSpacing: -3, color: COLORS.ink }}>Willow</span>
      </div>

      <div
        style={{
          marginTop: 30,
          fontSize: 42,
          color: COLORS.muted,
          opacity: head,
          transform: `translateY(${(1 - head) * 12}px)`,
        }}
      >
        Learn algorithmic thinking by doing.
      </div>
    </AbsoluteFill>
  );
};
