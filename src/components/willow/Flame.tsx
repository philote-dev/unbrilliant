import { AnimatePresence, motion } from "motion/react"

import { cn } from "@/lib/utils"

export type FlameTier = 0 | 1 | 2 | 3

/** Lesson-wide combo → flame tier. Builds 1→2→3, then maxes out (no number). */
export function comboToTier(combo: number): FlameTier {
  if (combo <= 0) return 0
  if (combo === 1) return 1
  if (combo === 2) return 2
  return 3
}

const FLAME =
  "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"

const TIERS: Record<
  FlameTier,
  { scale: number; bodyOpacity: number; glow: number }
> = {
  0: { scale: 0.78, bodyOpacity: 0, glow: 0 },
  1: { scale: 0.74, bodyOpacity: 0.85, glow: 0.4 },
  2: { scale: 0.92, bodyOpacity: 0.95, glow: 0.68 },
  3: { scale: 1.08, bodyOpacity: 1, glow: 1 },
}

/**
 * The numberless "on fire" flame. Genuinely animated: a soft flicker, a glow
 * that pulses, smooth tier transitions, and a one-shot flourish at max.
 * Reduced-motion is honored globally (see index.css). Pastel lilac only.
 */
export function Flame({
  tier = 0,
  size = 30,
  className,
}: {
  tier?: FlameTier
  size?: number
  className?: string
}) {
  const cfg = TIERS[tier]
  const lit = tier > 0

  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* pulsing glow halo behind the flame */}
      <AnimatePresence>
        {lit && (
          <motion.span
            key="glow"
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full animate-glow-pulse"
            style={{
              width: size * 1.5,
              height: size * 1.5,
              background:
                "radial-gradient(circle, var(--lilac-strong) 0%, transparent 68%)",
              filter: `blur(${Math.round(size * 0.16)}px)`,
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: cfg.glow * 0.7, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.35 }}
          />
        )}
      </AnimatePresence>

      <motion.svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={cn("relative", lit ? "text-lilac-strong" : "text-faint")}
        animate={{ scale: cfg.scale }}
        transition={{ type: "spring", stiffness: 220, damping: 16 }}
        key={tier === 3 ? "max" : "lit"}
      >
        {/* flourish: a quick pop the moment the flame reaches max */}
        <motion.g
          className={cn("origin-bottom", lit && "animate-flame-flicker")}
          style={{ transformOrigin: "12px 20px" }}
          animate={tier === 3 ? { scale: [1, 1.18, 1] } : { scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {lit ? (
            <>
              <motion.path
                d={FLAME}
                fill="currentColor"
                initial={{ opacity: 0 }}
                animate={{ opacity: cfg.bodyOpacity }}
                transition={{ duration: 0.3 }}
              />
              {/* hot inner core, lighter */}
              <path
                d={FLAME}
                transform="translate(6.5 10.4) scale(0.46)"
                fill="#ffffff"
                opacity={0.42}
              />
            </>
          ) : (
            <path
              d={FLAME}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinejoin="round"
              opacity={0.7}
            />
          )}
        </motion.g>
      </motion.svg>
    </span>
  )
}
