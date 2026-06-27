import { AbsoluteFill } from "remotion";

import { sceneOpacity } from "../anim";
import { useDesignFrame } from "../timing";
import { Eyebrow } from "../components/Eyebrow";
import { KineticText } from "../components/KineticText";
import { COLORS } from "../theme";

/** The "explain it" beat: a numbered label and one clear statement, centered and
 * full-frame, the way Anthropic states a capability before showing it. */
export const TextCard: React.FC<{
  dur: number;
  n: string;
  label: string;
  statement: string;
}> = ({ dur, n, label, statement }) => {
  const frame = useDesignFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: sceneOpacity(frame, dur),
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        padding: "0 220px",
      }}
    >
      <Eyebrow style={{ marginBottom: 30 }}>
        {n} · {label}
      </Eyebrow>
      <KineticText
        text={statement}
        delay={8}
        stagger={3.9}
        rise={26}
        style={{
          justifyContent: "center",
          fontSize: 64,
          fontWeight: 600,
          letterSpacing: -2,
          color: COLORS.ink,
          lineHeight: 1.16,
          maxWidth: 1420,
        }}
      />
    </AbsoluteFill>
  );
};
