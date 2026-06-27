import type { CSSProperties, ReactNode } from "react";

import { COLORS } from "../theme";

/** Willow's lilac eyebrow thread (the "SECTION X OF N" accent), reused as the
 * Cursor-style numbered feature label. */
export const Eyebrow: React.FC<{ children: ReactNode; style?: CSSProperties }> = ({
  children,
  style,
}) => (
  <div
    style={{
      color: COLORS.lilac,
      fontSize: 22,
      fontWeight: 600,
      letterSpacing: 4.5,
      textTransform: "uppercase",
      ...style,
    }}
  >
    {children}
  </div>
);
