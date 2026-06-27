import { ramp } from "../anim";
import { useDesignFrame } from "../timing";
import { pointAt, type PathPoint } from "../cursorPath";
import { COLORS } from "../theme";

/** A desktop arrow cursor that follows an eased, curved path (see cursorPath),
 * with click ripples at the given tap frames. Coords are in the parent
 * positioned container's pixels. */
export const Cursor: React.FC<{ path: PathPoint[]; taps?: number[] }> = ({ path, taps = [] }) => {
  const frame = useDesignFrame();
  const { x, y } = pointAt(path, frame);
  const appear = ramp(frame, [path[0].frame - 8, path[0].frame], [0, 1]);
  const press = taps.some((t) => frame >= t && frame < t + 6) ? 0.9 : 1;

  return (
    <>
      {taps.map((t) => {
        const r = ramp(frame, [t, t + 26], [6, 48]);
        const o = ramp(frame, [t, t + 26], [0.4, 0]);
        return (
          <div
            key={t}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: r * 2,
              height: r * 2,
              marginLeft: -r,
              marginTop: -r,
              borderRadius: 999,
              border: `3px solid ${COLORS.lilac}`,
              opacity: o,
            }}
          />
        );
      })}
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        style={{
          position: "absolute",
          left: x,
          top: y,
          opacity: appear,
          transform: `scale(${press})`,
          transformOrigin: "4px 2px",
          filter: "drop-shadow(0 3px 5px rgba(30,35,60,0.3))",
        }}
      >
        <path
          d="M4 2 L4 18 L8.6 13.6 L11.6 20.6 L13.7 19.7 L10.7 13 L16 13 Z"
          fill="#fff"
          stroke={COLORS.ink}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
};
