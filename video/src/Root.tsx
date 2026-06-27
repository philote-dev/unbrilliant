import { Composition } from "remotion";

import { TOTAL, WillowPoly } from "./WillowPoly";
import { BASE_FPS, toRenderFrames } from "./timing";

/**
 * Two registrations of the same film. The motion is authored once in BASE_FPS
 * design frames, so each composition just samples it at its own rate:
 *  - WillowPoly   (30fps): fast prototyping / preview / quick renders.
 *  - WillowPoly60 (60fps): the smooth final render (npm run render:60).
 * durationInFrames scales with fps so the wall-clock length stays identical.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="WillowPoly"
        component={WillowPoly}
        durationInFrames={toRenderFrames(TOTAL, BASE_FPS)}
        fps={BASE_FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="WillowPoly60"
        component={WillowPoly}
        durationInFrames={toRenderFrames(TOTAL, 60)}
        fps={60}
        width={1920}
        height={1080}
      />
    </>
  );
};
