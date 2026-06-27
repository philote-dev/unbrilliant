import { Easing, interpolate } from "remotion";

/** Calm, confident easing (matches the Cursor-style restraint). */
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

type Opts = Partial<{ easing: (n: number) => number }>;

/** interpolate with clamped edges (the 99% case here). */
export function ramp(
  frame: number,
  points: number[],
  values: number[],
  opts: Opts = {},
): number {
  return interpolate(frame, points, values, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: opts.easing,
  });
}

/** Whole-scene fade in then out, in local sequence frames. */
export function sceneOpacity(
  frame: number,
  duration: number,
  fadeIn = 16,
  fadeOut = 18,
): number {
  return ramp(
    frame,
    [0, fadeIn, duration - fadeOut, duration],
    [0, 1, 1, 0],
  );
}
