import { useEffect } from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTime,
  useTransform,
} from "motion/react"

import { cn } from "@/lib/utils"

export type FlameTier = 0 | 1 | 2 | 3 | 4

/**
 * Lesson combo → flame tier. Nothing until a 2-streak, then it grows through the
 * stages: candle at 2–3, droplet at 4–5, blaze at 6–9, and the inferno at 10+
 * (which, in the lesson top bar, consumes the progress bar).
 */
export function comboToTier(combo: number): FlameTier {
  if (combo < 2) return 0
  if (combo < 4) return 1
  if (combo < 6) return 2
  if (combo < 10) return 3
  return 4
}

/**
 * Build a flame silhouette in the 24×24 box, base anchored at `baseY`, centered
 * on `cx`. A teardrop with a single cubic per side meeting at a movable tip, and
 * a rounded base. `tipDX` slides the tip; `sway` bows the edges; `h`/`w` size it;
 * `neck` pinches the base (low = candle wick, ~1 = round droplet).
 */
function flamePath({
  h,
  w,
  neck = 0.85,
  tipDX = 0,
  sway = 0,
  cx = 12,
  baseY = 21,
}: {
  h: number
  w: number
  neck?: number
  tipDX?: number
  sway?: number
  cx?: number
  baseY?: number
}) {
  const baseHalf = w * neck
  const Lx = cx - baseHalf
  const Rx = cx + baseHalf
  const Tx = cx + tipDX
  const Ty = baseY - h
  // Ogee sides: bulge OUT to the full belly low down, then curve IN toward the
  // tip, so the silhouette reads as a flame rather than a straight-sided cone.
  const l1x = cx - w * 1.12 - sway
  const l1y = baseY - h * 0.34
  const l2x = cx - w * 0.05 + sway * 0.6
  const l2y = baseY - h * 0.8
  const r1x = cx + w * 0.05 + sway * 0.6
  const r1y = baseY - h * 0.8
  const r2x = cx + w * 1.12 - sway
  const r2y = baseY - h * 0.34
  const by = baseY + 1.4
  return (
    `M${Lx} ${baseY}` +
    `C${l1x} ${l1y} ${l2x} ${l2y} ${Tx} ${Ty}` +
    `C${r1x} ${r1y} ${r2x} ${r2y} ${Rx} ${baseY}` +
    `Q${cx} ${by} ${Lx} ${baseY}Z`
  )
}

interface FlowCfg {
  cx: number
  period: number
  ampTip: number
  ampSway: number
  phase: number
  hPulse?: number
  lean?: number
}

/**
 * An animated `d` motion value: height/width/neck spring toward their tier
 * targets (the grow/transition), while the tip + edges ride sine waves every
 * frame (the flow). Honors reduced-motion by holding a still shape.
 */
function useMorphPath(targetH: number, targetW: number, targetNeck: number, cfg: FlowCfg) {
  const reduced = useReducedMotion()
  const h = useMotionValue(targetH)
  const w = useMotionValue(targetW)
  const nk = useMotionValue(targetNeck)

  useEffect(() => {
    const spring = { type: "spring", stiffness: 130, damping: 17 } as const
    const ch = animate(h, targetH, spring)
    const cw = animate(w, targetW, spring)
    const cn = animate(nk, targetNeck, spring)
    return () => {
      ch.stop()
      cw.stop()
      cn.stop()
    }
  }, [targetH, targetW, targetNeck, h, w, nk])

  const t = useTime()
  return useTransform([t, h, w, nk], ([ms, hh, ww, nn]: number[]) => {
    if (reduced) {
      return flamePath({ h: hh, w: ww, neck: nn, cx: cfg.cx, tipDX: cfg.lean ?? 0 })
    }
    const a = ms / cfg.period + cfg.phase
    const tipDX = Math.sin(a) * cfg.ampTip + (cfg.lean ?? 0)
    const sway = Math.sin(a * 1.7 + 0.6) * cfg.ampSway
    const hp = hh * (1 + Math.sin(a * 0.9 + 1.1) * (cfg.hPulse ?? 0.05))
    return flamePath({ h: hp, w: ww, neck: nn, tipDX, sway, cx: cfg.cx })
  })
}

/** Soft lilac glow; strength + spread tween between tiers, pulses only at max. */
function Glow({
  size,
  strength,
  pulse,
  spread = 1.7,
}: {
  size: number
  strength: number
  pulse: boolean
  spread?: number
}) {
  return (
    <motion.span
      className={cn(
        "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
        pulse && "animate-glow-pulse",
      )}
      style={{
        width: size * spread,
        height: size * spread,
        background: "radial-gradient(circle, var(--lilac-strong) 0%, transparent 68%)",
        filter: `blur(${Math.round(size * 0.16)}px)`,
      }}
      initial={false}
      animate={{ opacity: strength }}
      transition={{ duration: 0.4 }}
    />
  )
}

/** Rising embers. Amount + speed scale with the tier. Off under reduced-motion. */
function Embers({ size, count, duration }: { size: number; count: number; duration: number }) {
  const reduced = useReducedMotion()
  if (reduced || count <= 0) return null
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const dx = (i % 2 === 0 ? -1 : 1) * (2 + (i % 3))
        return (
          <motion.span
            key={i}
            className="pointer-events-none absolute rounded-full"
            style={{
              width: 2.5,
              height: 2.5,
              left: "50%",
              bottom: size * 0.26,
              background: "var(--lilac-strong)",
            }}
            initial={{ opacity: 0, x: dx, y: 0 }}
            animate={{ opacity: [0, 0.85, 0], x: [dx, dx * 1.7], y: [0, -size * 0.9] }}
            transition={{
              duration,
              repeat: Infinity,
              delay: (i * duration) / count,
              ease: "easeOut",
            }}
          />
        )
      })}
    </>
  )
}

/**
 * The flowing flame itself. Stage shapes differ by design:
 *   tier 1  slender candle-wick flame (pinched neck, gentle)
 *   tier 2  rounder droplet with a visible inner flame
 *   tier 3  big blaze: inner flame + two lighter licking tongues + ember stream
 * Each layer is rebuilt every frame (sine-driven tip + edges), and the height/
 * width/neck spring between tiers so the stages morph and grow into each other.
 */
function LivingFlame({ tier, size }: { tier: FlameTier; size: number }) {
  const H = tier >= 4 ? 17.2 : tier >= 3 ? 16.0 : tier === 2 ? 11.8 : 10.4
  const W = tier >= 4 ? 6.2 : tier >= 3 ? 5.8 : tier === 2 ? 4.7 : 2.9
  const neck = tier >= 4 ? 0.56 : tier >= 3 ? 0.58 : tier === 2 ? 0.92 : 0.4
  const period = tier >= 4 ? 600 : tier >= 3 ? 700 : tier === 2 ? 1000 : 1450
  const ampTip = tier >= 4 ? 1.9 : tier >= 3 ? 1.7 : tier === 2 ? 1.1 : 0.8
  const ampSway = tier >= 4 ? 1.15 : tier >= 3 ? 1.0 : tier === 2 ? 0.6 : 0.45

  // A tall thin tongue behind the body whose tip licks ABOVE the blaze (it's the
  // body colour, so only the part poking past the body shows: a whippy peak). The
  // factor is lower at tier 4 so the taller flame's peak still fits the box.
  const peakD = useMorphPath(H * (tier >= 4 ? 1.0 : 1.12), W * 0.32, 0.55, {
    cx: 12.1,
    period: period * 0.58,
    ampTip: 1.8,
    ampSway: 0.9,
    phase: 1.2,
    hPulse: 0.16,
  })
  const bodyD = useMorphPath(H, W, neck, { cx: 12, period, ampTip, ampSway, phase: 0, hPulse: 0.05 })
  const coreD = useMorphPath(H * 0.6, W * 0.52, 0.72, {
    cx: 12,
    period: period * 0.82,
    ampTip: ampTip * 0.7,
    ampSway: ampSway * 0.6,
    phase: 1.7,
    hPulse: 0.08,
  })
  // Max-blaze only: two lighter inner tongues licking over the body on their own
  // phases, so it reads as a lively multi-tongue fire (not splayed prongs).
  const tongueL = useMorphPath(H * 0.54, W * 0.34, 0.6, {
    cx: 10.7,
    period: period * 0.7,
    ampTip: 1.3,
    ampSway: 0.6,
    phase: 0.9,
    lean: -0.4,
    hPulse: 0.15,
  })
  const tongueR = useMorphPath(H * 0.46, W * 0.3, 0.6, {
    cx: 13.4,
    period: period * 0.62,
    ampTip: 1.3,
    ampSway: 0.6,
    phase: 2.6,
    lean: 0.5,
    hPulse: 0.15,
  })

  const coreOpacity = tier >= 4 ? 0.68 : tier >= 3 ? 0.62 : tier === 2 ? 0.5 : 0
  const tongueOpacity = tier >= 4 ? 0.5 : tier >= 3 ? 0.45 : 0
  const peakOpacity = tier >= 3 ? 0.8 : 0
  const glow = tier >= 4 ? 1.0 : tier >= 3 ? 0.95 : tier === 2 ? 0.5 : 0.45
  const glowSpread = tier >= 4 ? 2.3 : tier >= 3 ? 2.05 : tier === 1 ? 1.85 : 1.7

  return (
    <>
      <Glow size={size} strength={glow} pulse={tier >= 3} spread={glowSpread} />
      <svg viewBox="0 0 24 24" width={size} height={size} className="relative text-lilac-strong">
        <motion.path d={peakD} fill="currentColor" initial={false} animate={{ opacity: peakOpacity }} transition={{ duration: 0.4 }} />
        <motion.path d={bodyD} fill="currentColor" initial={false} animate={{ opacity: tier === 1 ? 0.95 : 0.98 }} transition={{ duration: 0.4 }} />
        <motion.path d={coreD} fill="#ffffff" initial={false} animate={{ opacity: coreOpacity }} transition={{ duration: 0.4 }} />
        <motion.path d={tongueL} fill="#ffffff" initial={false} animate={{ opacity: tongueOpacity }} transition={{ duration: 0.4 }} />
        <motion.path d={tongueR} fill="#ffffff" initial={false} animate={{ opacity: tongueOpacity }} transition={{ duration: 0.4 }} />
      </svg>
      <Embers
        size={size}
        count={tier >= 4 ? 9 : tier >= 3 ? 6 : tier === 2 ? 2 : 0}
        duration={tier >= 4 ? 0.85 : tier >= 3 ? 1.0 : 1.7}
      />
    </>
  )
}

/**
 * The "on fire" flame. Nothing below a 2-streak; otherwise a living flame that
 * pops in from the top-right and grows through its stages, with edges that flow
 * like fire (not the whole icon wobbling). The box always reserves `size` so the
 * surrounding layout never shifts as the flame appears or leaves. Pastel lilac.
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
  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <AnimatePresence>
        {tier > 0 && (
          <motion.span
            key="lit"
            className="absolute inset-0 inline-flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.3, x: size * 0.2, y: -size * 0.2 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.3, x: size * 0.2, y: -size * 0.2 }}
            transition={{ type: "spring", stiffness: 240, damping: 18 }}
          >
            <LivingFlame tier={tier} size={size} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
