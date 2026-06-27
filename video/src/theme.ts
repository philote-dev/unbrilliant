/**
 * Willow's visual tokens (from src/index.css / docs/design/design-system.md),
 * light theme. The film borrows Cursor's restraint (calm canvas, one accent used
 * scarcely, hairline depth) but stays unmistakably Willow: lilac on cool-neutral.
 */
export const COLORS = {
  bg: "#F2F4F7",
  bgGlow: "#ECEAFB",
  surface: "#FFFFFF",
  surfaceMuted: "#F7F8FB",
  border: "#E3E7EE",
  borderStrong: "#D7DCE6",
  ink: "#0F1115",
  muted: "#6B7280",
  faint: "#9AA3AF",
  lilacFill: "#D6D2F1",
  lilacSoft: "#EAE7F8",
  lilac: "#8B7FD6",
  lilacInk: "#5A4FA3",
  success: "#7FB089",
  successFill: "#E2F0E2",
  warning: "#C7A53C",
  warningFill: "#F6EECB",
  danger: "#CC7A7A",
  dangerFill: "#F6E2E2",
} as const;

export const SHADOW = {
  card: "0 6px 22px -10px rgba(40,50,80,.18)",
  cardSoft: "0 2px 10px -4px rgba(40,50,80,.12)",
  device: "0 40px 90px -40px rgba(40,45,80,.45)",
  lift: "0 18px 40px -22px rgba(40,45,80,.35)",
} as const;

export const RADIUS = {
  device: 56,
  group: 28,
  card: 20,
  chip: 999,
  tag: 8,
} as const;
