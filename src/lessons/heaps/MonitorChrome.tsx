import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

/**
 * Decorative SVG chrome for the ER triage monitor, matching the flat medical
 * references: a clinical lavender ambulance and a red ECG vital-signs ticker.
 * Both are presentational (aria-hidden); the lesson's meaning is carried by the
 * figure's srLabel and the prompt/cards. Everything here honours reduced motion.
 */

/** Flat ambulance, built to match the reference: lavender body (~#b9c0e0), a red
 * cross in a circle, a red side stripe (~#e53e3e), a dark window, grey wheels, and
 * a red roof light. Pure, stateless, scales via `className` (viewBox 56x46). */
export function AmbulanceMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 46" className={className} aria-hidden focusable="false">
      {/* roof light */}
      <rect x="25" y="2" width="7" height="11" rx="3" fill="#e53e3e" />
      {/* body */}
      <path
        d="M10 13 H40 C44 13 46 14.6 48.5 18 L51 21.6 C51.7 22.7 52 24 52 25.6 V29 C52 31.2 50.2 33 48 33 H10 C7.8 33 6 31.2 6 29 V17 C6 14.8 7.8 13 10 13 Z"
        fill="#b9c0e0"
      />
      {/* side stripe */}
      <rect x="6" y="28" width="44" height="3.2" rx="1.6" fill="#e53e3e" />
      {/* cab window */}
      <path d="M40 17 V26 H49 Z" fill="#3f4b5e" />
      {/* cross badge */}
      <circle cx="19" cy="20" r="7" fill="#e53e3e" />
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

// Heart (closed) + flat baseline with two QRS complexes, ending at a dot. A single
// red stroke, like the reference. pathLength is normalized so the sweep dash math
// is resolution-independent.
const ECG_D =
  "M24 30 C10 20 4 14 4 9.5 C4 5.5 7.5 3 11.5 3 C15 3 18.5 5 24 9 C29.5 5 33 3 36.5 3 C40.5 3 44 5.5 44 9.5 C44 14 38 20 24 30 Z " +
  "M46 18 H120 L128 14 L134 18 L144 18 L150 23 L156 3 L164 33 L170 18 H214 L222 12 L230 24 L236 18 H300"

/**
 * The vital-signs ticker: the red ECG line. When motion is allowed a brighter
 * pulse sweeps left to right along the trace (a live monitor scan); under reduced
 * motion it renders as a single static red line (no sweep).
 */
export function EcgLine({
  reducedMotion,
  className,
}: {
  reducedMotion?: boolean
  className?: string
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false

  return (
    <svg
      viewBox="0 0 320 36"
      preserveAspectRatio="none"
      aria-hidden
      focusable="false"
      className={cn("block w-full", className)}
      style={{ height: 34 }}
    >
      {reduced ? (
        <path
          d={ECG_D}
          fill="none"
          stroke="#ef4444"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <>
          <path
            d={ECG_D}
            fill="none"
            stroke="#ef4444"
            strokeOpacity={0.28}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <motion.path
            d={ECG_D}
            fill="none"
            stroke="#fb7185"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            strokeDasharray="0.14 0.86"
            animate={{ strokeDashoffset: [1, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
          />
        </>
      )}
      <circle cx={303} cy={18} r={3} fill="#ef4444" />
    </svg>
  )
}
