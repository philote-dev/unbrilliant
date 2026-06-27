import { useCurrentFrame, useVideoConfig } from "remotion";

/**
 * One frame rate to author against.
 *
 * The whole film is timed in "design frames" at BASE_FPS (30). Every scene reads
 * its clock through `useDesignFrame()` instead of `useCurrentFrame()`, and every
 * spring passes `BASE_FPS` (not the render fps). That makes all the existing
 * frame literals (delays, interpolate breakpoints, durations) mean the same wall-
 * clock time no matter what fps we render at, so the same source renders at 30
 * (fast prototyping) or 60 (smooth final) with identical motion, just sampled
 * more finely.
 *
 * This is the low-churn equivalent of Remotion's "seconds * fps" guidance: a
 * design frame is simply `seconds * BASE_FPS`, so the numbers authored at 30fps
 * stay valid.
 */
export const BASE_FPS = 30;

/**
 * The current frame expressed in BASE_FPS design units. At 30fps this equals
 * `useCurrentFrame()`; at 60fps it returns half-integer values, so animations
 * keep the exact same timing while being sampled twice as often.
 */
export function useDesignFrame(): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (frame * BASE_FPS) / fps;
}

/** Convert a design-frame count to real frames at a given render fps. */
export function toRenderFrames(designFrames: number, fps: number): number {
  return Math.round((designFrames * fps) / BASE_FPS);
}

/**
 * Scaler from design frames to the active composition's real frames. Use at the
 * timeline boundary only (Sequence `from`/`durationInFrames`, Audio offsets),
 * where Remotion needs real integer frames.
 */
export function useToRenderFrames(): (designFrames: number) => number {
  const { fps } = useVideoConfig();
  return (designFrames: number) => toRenderFrames(designFrames, fps);
}
