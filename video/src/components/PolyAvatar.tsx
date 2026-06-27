import { COLORS } from "../theme";

type Corner = "tl" | "tr" | "br" | "bl";

/**
 * Poly, the brand mascot: a minimal rounded-square robot whose single eye lives
 * in one corner. Pure, stateless and deterministic (no frame/time), so callers
 * animate it by wrapping (scale/translate) for everything from a tiny badge to a
 * large breathing voice orb. All sizing scales off the `size` prop.
 */
export const PolyAvatar: React.FC<{
  size: number;
  color?: string; // body color, default lilac
  eyeColor?: string;
  pupilColor?: string; // default ink
  corner?: Corner; // which corner holds the eye, default top-right
  pupil?: { x: number; y: number }; // pupil offset in px from eye center
  style?: React.CSSProperties; // merged onto the outer container (the body)
}> = ({
  size,
  color = COLORS.lilac,
  eyeColor = "#fff",
  pupilColor = COLORS.ink,
  corner = "tr",
  pupil = { x: 0, y: 0 },
  style,
}) => {
  const eyeSize = size * 0.42;
  const pupilSize = size * 0.18;
  const inset = size * 0.07;

  const cornerPos: Record<Corner, React.CSSProperties> = {
    tl: { top: inset, left: inset },
    tr: { top: inset, right: inset },
    br: { bottom: inset, right: inset },
    bl: { bottom: inset, left: inset },
  };

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: `linear-gradient(155deg, ${COLORS.lilacFill} 0%, ${color} 70%)`,
        boxShadow: `0 ${size * 0.08}px ${size * 0.18}px -${size * 0.08}px rgba(90,79,163,0.55)`,
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          ...cornerPos[corner],
          width: eyeSize,
          height: eyeSize,
          borderRadius: "50%",
          background: eyeColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: pupilSize,
            height: pupilSize,
            borderRadius: "50%",
            background: pupilColor,
            transform: `translate(${pupil.x}px, ${pupil.y}px)`,
          }}
        />
      </div>
    </div>
  );
};
