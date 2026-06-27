import type { CSSProperties } from "react";
import { COLORS } from "../theme";
import { useDesignFrame } from "../timing";

/**
 * Streams text the way someone types: letters appear fast within a word, then a
 * small beat before the next word's letters rattle in. Words in `boldWords`
 * render bold; an optional caret blinks while still typing.
 */
export const StreamText: React.FC<{
  text: string;
  start: number;
  perLetter?: number;
  wordGap?: number;
  style?: CSSProperties;
  boldWords?: string[];
  caret?: boolean;
}> = ({ text, start, perLetter = 1.4, wordGap = 4, style, boldWords = [], caret = true }) => {
  const frame = useDesignFrame();
  const elapsed = frame - start;
  const words = text.split(" ");
  const bold = new Set(boldWords);

  // Per-word letters shown at the current time, walking a shared clock.
  let clock = 0;
  let lastVisible = -1;
  const shown = words.map((w, wi) => {
    let n = 0;
    for (let i = 0; i < w.length; i++) {
      if (elapsed >= clock) n++;
      clock += perLetter;
    }
    if (n > 0) lastVisible = wi;
    clock += wordGap;
    return n;
  });

  const lastWord = words[words.length - 1];
  const done = lastVisible === words.length - 1 && shown[words.length - 1] === lastWord.length;

  return (
    <span style={style}>
      {words.map((w, wi) => {
        if (shown[wi] <= 0) return null;
        const isBold = bold.has(w.replace(/[.,?!:]/g, ""));
        const space = wi < lastVisible ? " " : "";
        return (
          <span key={wi} style={isBold ? { fontWeight: 700 } : undefined}>
            {w.slice(0, shown[wi])}
            {space}
          </span>
        );
      })}
      {caret && elapsed >= 0 && !done ? (
        <span
          style={{
            color: COLORS.lilac,
            fontWeight: 700,
            marginLeft: 1,
            opacity: Math.floor(frame / 7) % 2 === 0 ? 1 : 0.2,
          }}
        >
          |
        </span>
      ) : null}
    </span>
  );
};
