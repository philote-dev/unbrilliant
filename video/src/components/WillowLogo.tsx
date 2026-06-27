import { staticFile } from "remotion";

const RATIO = 414 / 375; // official mark aspect (favicon.svg viewBox)

/** The real Willow mark (public/favicon.svg artwork), rendered as a recolorable
 * CSS mask exactly like the app's Logo.tsx. Set any color (lilac, or white for
 * the end sting). */
export const WillowLogo: React.FC<{ height: number; color: string; title?: string }> = ({
  height,
  color,
  title = "Willow",
}) => {
  const src = staticFile("willow-mark.svg");
  return (
    <span
      role="img"
      aria-label={title}
      style={{
        display: "inline-block",
        width: Math.round(height * RATIO),
        height,
        backgroundColor: color,
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
    />
  );
};
