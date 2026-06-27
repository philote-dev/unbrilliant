import { AbsoluteFill } from "remotion";

import { ramp, sceneOpacity } from "../anim";
import { useDesignFrame } from "../timing";
import { KineticText } from "../components/KineticText";
import { COLORS } from "../theme";

/** The thesis cold-open: the problem line, then Willow's POV in lilac. */
export const S1Hook: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useDesignFrame();
  const aOut = ramp(frame, [70, 88], [1, 0]);

  return (
    <AbsoluteFill
      style={{
        opacity: sceneOpacity(frame, dur),
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 1360,
          height: 280,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ position: "absolute", width: "100%", opacity: aOut }}>
          <KineticText
            text="Most learning apps just hand you the answer."
            delay={0}
            style={{
              justifyContent: "center",
              fontSize: 74,
              fontWeight: 600,
              letterSpacing: -2,
              color: COLORS.ink,
              lineHeight: 1.1,
              textAlign: "center",
            }}
          />
        </div>
        <div style={{ position: "absolute", width: "100%" }}>
          <KineticText
            text="Willow makes you figure it out."
            delay={94}
            stagger={4}
            rise={34}
            style={{
              justifyContent: "center",
              fontSize: 96,
              fontWeight: 600,
              letterSpacing: -3,
              color: COLORS.ink,
              lineHeight: 1.04,
              textAlign: "center",
            }}
            wordStyle={(i) => (i >= 3 ? { color: COLORS.lilac } : {})}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
