import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";

import { COLORS } from "../theme";

/**
 * The steady backdrop behind every scene: cool near-white with a faint lilac
 * glow up top and a soft cool pool at the base. One accent, used scarcely.
 */
export const Ambient: React.FC<{ children?: ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 640px at 50% -10%, ${COLORS.bgGlow} 0%, rgba(236,234,251,0) 62%)`,
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(1300px 760px at 50% 118%, rgba(214,210,241,0.22) 0%, rgba(242,244,247,0) 56%)",
      }}
    />
    {children}
  </AbsoluteFill>
);
