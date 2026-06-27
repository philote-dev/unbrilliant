import type { ReactNode } from "react";
import { AbsoluteFill, Sequence } from "remotion";

import { ramp, sceneOpacity } from "../anim";
import { useDesignFrame, useToRenderFrames } from "../timing";
import { Eyebrow } from "../components/Eyebrow";
import { QueueMini } from "../lessons/QueueMini";
import { SubwayMini } from "../lessons/SubwayMini";
import { WarehouseMini } from "../lessons/WarehouseMini";
import { COLORS, SHADOW } from "../theme";

const CARD_W = 1180;
const CARD_H = 700;

const VIGN: { node: ReactNode; concept: string; skin: string }[] = [
  { node: <SubwayMini />, concept: "Graphs", skin: "are a subway map" },
  { node: <QueueMini />, concept: "Linked lists", skin: "are your music queue" },
  { node: <WarehouseMini />, concept: "Hash tables", skin: "are a warehouse" },
];

const STEP = 185; // back-to-back with a small cross-dissolve overlap
const VIGN_DUR = 205;

/** "Learn by doing": a quick montage of three interactive lessons, each a real
 * concept wearing a real-world skin, shown full in a floating screen. */
export const S3Interactivity: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useDesignFrame();
  const toReal = useToRenderFrames();
  const eyebrow = ramp(frame, [6, 26, dur - 24, dur - 6], [0, 1, 1, 0]);

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(frame, dur), justifyContent: "center", alignItems: "center" }}>
      <div style={{ position: "absolute", top: 96, opacity: eyebrow }}>
        <Eyebrow>Learn by doing</Eyebrow>
      </div>

      {VIGN.map((v, i) => (
        <Sequence key={i} from={toReal(i * STEP)} durationInFrames={toReal(VIGN_DUR)} layout="none" name={`vignette ${i + 1}`}>
          <Vignette concept={v.concept} skin={v.skin}>
            {v.node}
          </Vignette>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const Vignette: React.FC<{ concept: string; skin: string; children: ReactNode }> = ({
  concept,
  skin,
  children,
}) => {
  const frame = useDesignFrame();
  const op = ramp(frame, [0, 14, VIGN_DUR - 12, VIGN_DUR], [0, 1, 1, 0]);
  const rise = ramp(frame, [0, 18], [22, 0]);
  const scale = ramp(frame, [0, 18], [0.985, 1]);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: op }}>
      <div style={{ transform: `translateY(${rise}px) scale(${scale})` }}>
        <div
          style={{
            width: CARD_W,
            height: CARD_H,
            borderRadius: 24,
            overflow: "hidden",
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            boxShadow: SHADOW.device,
          }}
        >
          {children}
        </div>
        <div style={{ marginTop: 30, textAlign: "center" }}>
          <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: -1, color: COLORS.ink }}>{concept}</span>
          <span style={{ fontSize: 38, fontWeight: 400, letterSpacing: -1, color: COLORS.muted }}> {skin}.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
