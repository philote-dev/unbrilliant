import type { ReactNode } from "react";
import { AbsoluteFill, spring } from "remotion";

import { sceneOpacity } from "../anim";
import { BASE_FPS, useDesignFrame } from "../timing";
import { WebShell } from "../components/WebShell";

/** The "show it fully" beat: the Willow web app on screen, gliding up into the
 * frame. The demo UI is passed as children. */
export const DemoScene: React.FC<{
  dur: number;
  url: string;
  children: ReactNode;
}> = ({ dur, url, children }) => {
  const frame = useDesignFrame();

  const enter = spring({ fps: BASE_FPS, frame, config: { damping: 200, mass: 0.9 } });
  const y = (1 - enter) * 80;
  const scale = 0.97 + enter * 0.03;

  return (
    <AbsoluteFill
      style={{ opacity: sceneOpacity(frame, dur), justifyContent: "center", alignItems: "center" }}
    >
      <div style={{ transform: `translateY(${y}px) scale(${scale})` }}>
        <WebShell url={url} active="learn">
          {children}
        </WebShell>
      </div>
    </AbsoluteFill>
  );
};
