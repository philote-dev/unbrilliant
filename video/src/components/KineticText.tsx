import type { CSSProperties } from "react";
import { spring } from "remotion";

import { BASE_FPS, useDesignFrame } from "../timing";

/**
 * Staggered word-by-word reveal (the hero kinetic-typography moment). Each word
 * springs up and fades in, a beat after the previous one.
 */
export const KineticText: React.FC<{
  text: string;
  delay?: number;
  stagger?: number;
  rise?: number;
  style?: CSSProperties;
  wordStyle?: (i: number) => CSSProperties;
}> = ({ text, delay = 0, stagger = 3.5, rise = 30, style, wordStyle }) => {
  const frame = useDesignFrame();
  const words = text.split(" ");

  return (
    <div style={{ display: "flex", flexWrap: "wrap", ...style }}>
      {words.map((w, i) => {
        const s = spring({
          fps: BASE_FPS,
          frame: frame - delay - i * stagger,
          config: { damping: 200, mass: 1 },
        });
        return (
          <span
            key={`${w}-${i}`}
            style={{
              display: "inline-block",
              marginRight: "0.3em",
              transform: `translateY(${(1 - s) * rise}px)`,
              opacity: s,
              ...(wordStyle?.(i) ?? {}),
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};
