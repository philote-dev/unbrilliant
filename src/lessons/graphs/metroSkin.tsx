import { type ReactNode } from "react"

import { useOptionalTheme } from "@/lib/theme"
import { type TransitLine } from "./transitData"

/**
 * The Graphs metro skin in two coats: DAY (a real city in daylight) and NIGHT
 * (the same city after dark). It is a brand takeover for the transit beats (the
 * draw-transit question, the redraw morph, the same-graph proof), and it follows
 * the app theme: Day in light, Night in dark. None of it grades; the palette,
 * backdrops, and line tints are decoration over the engine's adjacency (the route
 * list is the data). The lilac interaction tone inside `SubwayMap` is the shared
 * accent, reused so grab / drop / selected reads the same as every lesson.
 */
export interface MetroSkin {
  id: "day" | "night"
  theme: "light" | "dark"
  /** Full-bleed scene background (the poster mat). */
  sceneBg: string
  /** Map base + line casing, panels, and the roundel fill. */
  paper: string
  /** Hairline borders (legend, buttons, panels, option default). */
  cardEdge: string
  /** Legend pill background. */
  legendBg: string
  /** Primary text (headers, prompts). */
  ink: string
  /** Secondary text (eyebrow, hints, labels). */
  sub: string
  /** The zone/status badge. */
  badgeBg: string
  badgeInk: string
  /** The ink, sign-style primary button. */
  btnBg: string
  btnInk: string
  /** The quiet secondary button (border comes from `cardEdge`). */
  btn2Bg: string
  btn2Ink: string
  /** City art (rivers, parks, blocks / lit windows) drawn behind the lines. */
  backdrop: ReactNode
  /** Recolor a daytime line hex for this skin (neon at night). */
  tint: (dayHex: string) => string
}

/* --------------------------------- backdrops --------------------------------- */
//
// Plain JSX helpers (not components) so this file can also export the skin values
// and hook without tripping react-refresh's only-export-components rule.

const RIVER = "M-12 84 C 70 60 92 150 168 138 C 232 128 250 214 320 188"

/** A grid of soft city blocks (daytime rooftops). */
function blocks(
  key: string,
  x: number,
  y: number,
  cols: number,
  rows: number,
  fill: string,
  size = 12,
  gap = 5,
): ReactNode {
  const cells: ReactNode[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      cells.push(
        <rect
          key={`${key}-${r}-${c}`}
          x={x + c * (size + gap)}
          y={y + r * (size + gap)}
          width={size}
          height={size}
          rx={2}
          fill={fill}
        />,
      )
  return cells
}

/** A facade of lit / dark windows for a night tower. */
function windows(key: string, x: number, y: number, cols: number, rows: number): ReactNode {
  const dots: ReactNode[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      dots.push(
        <rect
          key={`${key}-${r}-${c}`}
          x={x + c * 11}
          y={y + r * 11}
          width={3.5}
          height={3.5}
          rx={0.6}
          fill={(r * 7 + c * 3) % 4 === 0 ? "#ffd56b" : "#27324f"}
        />,
      )
  return dots
}

const DAY_BACKDROP: ReactNode = (
  <g opacity={0.92}>
    <path d={RIVER} fill="none" stroke="#bcdcf2" strokeWidth={24} strokeLinecap="round" />
    <path d="M-6 256 Q 64 244 118 274 L 118 312 L -6 312 Z" fill="#bcdcf2" />
    <rect x={206} y={26} width={80} height={48} rx={16} fill="#cfe6c2" />
    <rect x={22} y={150} width={50} height={42} rx={13} fill="#cfe6c2" />
    {blocks("a", 24, 26, 3, 2, "#e7e2d4")}
    {blocks("b", 210, 224, 3, 2, "#e7e2d4")}
  </g>
)

const NIGHT_BACKDROP: ReactNode = (
  <g>
    <path d={RIVER} fill="none" stroke="#16233f" strokeWidth={24} strokeLinecap="round" />
    <rect x={20} y={24} width={64} height={52} rx={6} fill="#15203a" />
    <rect x={206} y={24} width={78} height={48} rx={6} fill="#131c33" />
    <rect x={206} y={222} width={80} height={58} rx={6} fill="#15203a" />
    {windows("a", 26, 30, 5, 4)}
    {windows("b", 212, 30, 6, 3)}
    {windows("c", 212, 228, 6, 4)}
  </g>
)

/* ----------------------------------- skins ----------------------------------- */

/** Daytime line hex -> night neon. Falls back to the day color if unmapped. */
const NIGHT_LINE: Record<string, string> = {
  "#ef5350": "#ff6b6b", // harbor / red
  "#1aa7e0": "#38bdf8", // park / blue
  "#16b08a": "#34d399", // garden / green
  "#f4bb1c": "#fbbf24", // sun / amber
  "#b6bcc6": "#5b6680", // grey spur
}

const DAY: MetroSkin = {
  id: "day",
  theme: "light",
  sceneBg: "linear-gradient(180deg,#eef1f5,#e2e8f0)",
  paper: "#f7f2ea",
  cardEdge: "#dbe1ea",
  legendBg: "#ffffffe6",
  ink: "#1f2430",
  sub: "#5c6577",
  badgeBg: "#1f2430",
  badgeInk: "#f7f2ea",
  btnBg: "#1f2430",
  btnInk: "#f7f2ea",
  btn2Bg: "#ffffff",
  btn2Ink: "#1f2430",
  backdrop: DAY_BACKDROP,
  tint: (c) => c,
}

const NIGHT: MetroSkin = {
  id: "night",
  theme: "dark",
  sceneBg: "linear-gradient(180deg,#0c1222,#080d18)",
  paper: "#0c1222",
  cardEdge: "#1c2742",
  legendBg: "#0f1830d9",
  ink: "#e7ecf5",
  sub: "#9aa6c2",
  badgeBg: "#e7ecf5",
  badgeInk: "#0c1222",
  btnBg: "#e7ecf5",
  btnInk: "#0c1222",
  btn2Bg: "transparent",
  btn2Ink: "#e7ecf5",
  backdrop: NIGHT_BACKDROP,
  tint: (c) => NIGHT_LINE[c.toLowerCase()] ?? c,
}

/** The metro skin for the active app theme (Day in light, Night in dark). */
export function useMetroSkin(): MetroSkin {
  return useOptionalTheme() === "dark" ? NIGHT : DAY
}

/** Recolor a route set for the skin (identity in day, neon in night). */
export function tintLines(skin: MetroSkin, lines: TransitLine[]): TransitLine[] {
  if (skin.id === "day") return lines
  return lines.map((l) => ({ ...l, color: skin.tint(l.color) }))
}
