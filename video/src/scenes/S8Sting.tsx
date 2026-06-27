import { AbsoluteFill, spring } from "remotion";

import { WillowLogo } from "../components/WillowLogo";
import { BASE_FPS, useDesignFrame } from "../timing";
import { COLORS } from "../theme";

/** Final brand sting: a hard cut to lilac, the white willow mark settling in.
 * They know it's Willow now from the tree alone. */
export const S8Sting: React.FC<{ dur: number }> = () => {
  const frame = useDesignFrame();

  const logo = spring({ fps: BASE_FPS, frame: frame - 12, config: { damping: 200, mass: 0.9 } });
  const drift = (1 - logo) * 16;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1300px 900px at 50% 44%, #9b90e2 0%, ${COLORS.lilac} 52%, ${COLORS.lilacInk} 130%)`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ opacity: logo, transform: `translateY(${drift}px) scale(${0.86 + logo * 0.14})` }}>
        <WillowLogo height={188} color="#ffffff" />
      </div>
    </AbsoluteFill>
  );
};
