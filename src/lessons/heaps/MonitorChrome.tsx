import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { useOptionalTheme } from "@/lib/theme"

/**
 * Decorative SVG chrome for the ER triage monitor: the ambulance intake mark, the
 * red ECG lifeline, and the monitor masthead. All presentational (aria-hidden);
 * the lesson's meaning is carried by the figure's srLabel and the prompt/cards.
 * Everything here honours reduced motion.
 *
 * Theme-aware (the ER skin shows white in light AND dark). The ambulance keeps the
 * real-world livery in both coats (white body, red cross + stripe, amber beacon),
 * and only its hairline outline and cab glass follow the theme so the white body
 * still reads on a white page in light mode. The ECG keeps red as its signature and
 * only brightens for contrast on near-black.
 */

type Mode = "light" | "dark"

/** Resolve the rendering mode: an explicit override wins, else follow the app. */
function useMode(surface?: "auto" | "light" | "dark"): Mode {
  const appTheme = useOptionalTheme()
  if (surface === "light" || surface === "dark") return surface
  return appTheme
}

/**
 * The ambulance intake mark: white body, a red cross badge, a red side stripe, an
 * amber roof beacon, a dark cab window, grey wheels. A hairline outline (themed)
 * keeps the white body legible on a white monitor in light mode. Pure + stateless;
 * scales via `className` (viewBox 56x46).
 */
export function AmbulanceMark({
  className,
  surface,
}: {
  className?: string
  surface?: "auto" | "light" | "dark"
}) {
  const mode = useMode(surface)
  const outline = mode === "light" ? "#cbd5e1" : "rgba(255,255,255,0.22)"
  const glass = mode === "light" ? "#cdd7e6" : "#324155"
  const red = "#e5343a"
  const amber = "#f59e0b"
  return (
    <svg viewBox="0 0 56 46" className={className} aria-hidden focusable="false">
      {/* roof beacon */}
      <rect x="25" y="2" width="7" height="11" rx="3" fill={amber} />
      {/* body */}
      <path
        d="M10 13 H40 C44 13 46 14.6 48.5 18 L51 21.6 C51.7 22.7 52 24 52 25.6 V29 C52 31.2 50.2 33 48 33 H10 C7.8 33 6 31.2 6 29 V17 C6 14.8 7.8 13 10 13 Z"
        fill="#ffffff"
        stroke={outline}
        strokeWidth={1.4}
      />
      {/* side stripe */}
      <rect x="6" y="28" width="44" height="3.2" rx="1.6" fill={red} />
      {/* cab window */}
      <path d="M40 17 V26 H49 Z" fill={glass} />
      {/* cross badge */}
      <circle cx="19" cy="20" r="7" fill={red} />
      <rect x="17.5" y="15" width="3" height="10" rx="0.6" fill="#fff" />
      <rect x="14" y="18.5" width="10" height="3" rx="0.6" fill="#fff" />
      {/* wheels */}
      <circle cx="18" cy="35" r="6.5" fill="#4a5568" />
      <circle cx="18" cy="35" r="2.8" fill="#2d3a4a" />
      <circle cx="43" cy="35" r="6.5" fill="#4a5568" />
      <circle cx="43" cy="35" r="2.8" fill="#2d3a4a" />
    </svg>
  )
}

// A single QRS heartbeat: flat, a small step, the spike, flat to an end dot. No
// heart glyph (the lifeline now reads as a compact inline trace). pathLength is
// normalized so the sweep dash math is resolution independent.
const ECG_TRACE =
  "M2 16 H54 L62 12 L68 16 L82 16 L88 22 L94 4 L102 28 L108 16 H156"

/**
 * The vital-signs lifeline: a compact red ECG trace, the monitor's heartbeat. When
 * motion is allowed a brighter pulse sweeps left to right (a live scan); under
 * reduced motion it renders as a single static red line (no sweep). Red is the
 * signature in both themes and only brightens on near-black for contrast. Size it
 * via `className` (it has no intrinsic size), so it can sit inline in the header.
 */
export function EcgLine({
  reducedMotion,
  surface,
  className,
}: {
  reducedMotion?: boolean
  surface?: "auto" | "light" | "dark"
  className?: string
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false
  const mode = useMode(surface)
  const base = mode === "light" ? "#e5343a" : "#fb5a60"
  const faint = mode === "light" ? "rgba(229,52,58,0.22)" : "rgba(251,90,96,0.32)"
  const sweep = mode === "light" ? "#ef4444" : "#fb7185"

  return (
    <svg
      viewBox="0 0 160 32"
      preserveAspectRatio="none"
      aria-hidden
      focusable="false"
      className={cn("block", className)}
    >
      {reduced ? (
        <path
          d={ECG_TRACE}
          fill="none"
          stroke={base}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <>
          <path
            d={ECG_TRACE}
            fill="none"
            stroke={faint}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <motion.path
            d={ECG_TRACE}
            fill="none"
            stroke={sweep}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            strokeDasharray="0.18 0.82"
            animate={{ strokeDashoffset: [1, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "linear" }}
          />
        </>
      )}
      <circle cx={156} cy={16} r={2.6} fill={base} />
    </svg>
  )
}

/**
 * The triage monitor masthead: the ambulance + "Emergency Dept / Triage monitor" on
 * the left, the LIVE indicator on the right, and the compact ECG lifeline tucked
 * inline BETWEEN them (the heartbeat that runs across the top of the wall display).
 * Theme-aware: the type follows the coat so it reads on white or near-black; the
 * LIVE dot stays red in both (and only pulses when motion is allowed). Decorative.
 */
export function MonitorMasthead({
  reduced,
  surface,
  className,
}: {
  reduced: boolean
  surface?: "auto" | "light" | "dark"
  className?: string
}) {
  const mode = useMode(surface)
  const ink = mode === "light" ? "#0f1115" : "#e6e8ec"
  const sub = mode === "light" ? "#64748b" : "#94a3b8"
  return (
    <div aria-hidden className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex shrink-0 items-center gap-2.5">
        <AmbulanceMark className="h-7 w-9 shrink-0" surface={surface} />
        <div className="leading-tight">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: ink }}>
            Emergency Dept
          </p>
          <p className="text-[9px] uppercase tracking-[0.22em]" style={{ color: sub }}>
            Triage monitor
          </p>
        </div>
      </div>
      <div className="mx-2 min-w-0 max-w-[120px] flex-1">
        <EcgLine surface={surface} reducedMotion={reduced} className="h-5 w-full" />
      </div>
      <span
        className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: sub }}
      >
        <span className={cn("size-2 rounded-full bg-red-500", !reduced && "animate-pulse")} /> Live
      </span>
    </div>
  )
}
