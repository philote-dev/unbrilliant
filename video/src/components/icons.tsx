import { COLORS } from "../theme";

/** Minimal line icons (Lucide register: thin, consistent stroke). */

type IconProps = { size?: number; color?: string; strokeWidth?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
});

export const CloseIcon: React.FC<IconProps> = ({ size = 22, color = COLORS.muted, strokeWidth = 2 }) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 20, color = COLORS.success, strokeWidth = 2.6 }) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12.5l5 5L20 6" />
  </svg>
);

export const CrossIcon: React.FC<IconProps> = ({ size = 20, color = COLORS.danger, strokeWidth = 2.6 }) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const MicIcon: React.FC<IconProps> = ({ size = 22, color = "#fff", strokeWidth = 2 }) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

export const SendIcon: React.FC<IconProps> = ({ size = 20, color = "#fff", strokeWidth = 2 }) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
);

/** The numberless "on fire" flame, pastel lilac (never red). */
export const FlameIcon: React.FC<IconProps & { active?: boolean }> = ({
  size = 24,
  active = true,
}) => (
  <svg {...base(size)} >
    <path
      d="M12 3c2.5 3 4.5 4.8 4.5 8.2A4.5 4.5 0 0 1 12 16a4.5 4.5 0 0 1-4.5-4.8C7.5 9 9 7.5 9.6 6.4 10.4 8 11 8.6 12 9c.4-1.8-.3-3.6 0-6Z"
      fill={active ? COLORS.lilac : COLORS.faint}
      opacity={active ? 1 : 0.5}
    />
  </svg>
);

/** Poly's spark mark. */
export const SparkIcon: React.FC<IconProps> = ({ size = 18, color = "#fff" }) => (
  <svg {...base(size)} fill={color}>
    <path d="M12 2.5c.5 3.6 1.4 4.5 5 5-3.6.5-4.5 1.4-5 5-.5-3.6-1.4-4.5-5-5 3.6-.5 4.5-1.4 5-5Z" />
  </svg>
);
