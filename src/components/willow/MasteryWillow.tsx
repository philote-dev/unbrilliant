import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"
import { keyWillowFrame } from "./willowCutout"

/**
 * Mastery willow: one painterly willow that stands for the learner's whole
 * journey. Nine glow-free webp frames (sprout to full), one per lesson count, so
 * the tree snaps to a single accurate frame per state instead of dissolving two
 * frames over each other. The lilac glow and the autumn decay are coded overlays,
 * not baked into the art, so they animate and track vigor and retention without
 * re-exporting frames. Presentational only: all signals arrive as props.
 *
 * The art is watercolor on a luminous paper ground, so it sits on a light
 * "specimen plate" (`.willow-plate` in src/index.css). The plate is near-invisible
 * in light mode and a softly lit, lilac-ringed panel in dark mode, so a light
 * ground always reads as intentional instead of a stray white box on near-black.
 */

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))
const clamp01 = (x: number) => (Number.isFinite(x) ? clamp(x, 0, 1) : 0)

/** deterministic rng so decay scatter is stable per render */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Frame {
  label: string
  src: string
}

/**
 * Nine growth frames in increasing fullness; the last is the full willow. With
 * the eight-lesson course this is one frame per completed-count (0..8), so every
 * state has its own accurate art. `g2b`/`g5b` are the in-between stages.
 */
const FRAMES: Frame[] = [
  { label: "Sprout", src: "/willow-g1.webp" },
  { label: "Sapling", src: "/willow-g2.webp" },
  { label: "Young", src: "/willow-g2b.webp" },
  { label: "Taking shape", src: "/willow-g3.webp" },
  { label: "Half grown", src: "/willow-g4.webp" },
  { label: "Growing", src: "/willow-g5.webp" },
  { label: "Maturing", src: "/willow-g5b.webp" },
  { label: "Nearly full", src: "/willow-g6.webp" },
  { label: "Full", src: "/willow-g7.webp" },
]

/**
 * The single frame for a lesson count: snap to the nearest stage (no blending).
 * With `total + 1` frames it is exactly one frame per count; with any other total
 * it spreads the frames evenly and rounds, so the tree always shows one image.
 */
function frameIndex(done: number, total: number): number {
  if (total <= 0) return 0
  const d = clamp(done, 0, total)
  return clamp(Math.round((d / total) * (FRAMES.length - 1)), 0, FRAMES.length - 1)
}

/* ------------------------------ coded glow -------------------------------- */

const SPARKS = [
  { x: 79, y: 26, s: 11, d: 0 },
  { x: 89, y: 40, s: 7, d: 0.9 },
  { x: 72, y: 49, s: 6, d: 1.7 },
  { x: 85, y: 58, s: 9, d: 0.5 },
  { x: 93, y: 31, s: 5, d: 1.3 },
]

/** Soft lilac glow + twinkling sparkles, overlaid on the artwork (not baked in). */
function CanopyGlow({ intensity }: { intensity: number }) {
  if (intensity <= 0.02) return null
  return (
    <div
      data-testid="canopy-glow"
      style={{ position: "absolute", inset: 0, opacity: intensity, pointerEvents: "none" }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(closest-side at 79% 36%, color-mix(in srgb, var(--lilac-strong) 26%, transparent), transparent 72%)",
        }}
      />
      {SPARKS.map((p, i) => (
        <svg
          key={i}
          className="wt-spark"
          viewBox="-5 -5 10 10"
          fill="var(--lilac-strong)"
          style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, animationDelay: `${p.d}s` }}
        >
          <path d="M0,-5 L1.2,-1.2 L5,0 L1.2,1.2 L0,5 L-1.2,1.2 L-5,0 L-1.2,-1.2 Z" />
        </svg>
      ))}
    </div>
  )
}

/* ------------------------------ coded decay ------------------------------- */

/* Branch spots over the canopy (viewBox 0..100 x, 0..67 y), ordered so a couple
 * go autumn first and the rest follow as neglect deepens. */
const DECAY_SPOTS = [
  { x: 33, y: 32 },
  { x: 66, y: 30 },
  { x: 49, y: 21 },
  { x: 24, y: 40 },
  { x: 75, y: 38 },
  { x: 41, y: 41 },
  { x: 59, y: 43 },
  { x: 37, y: 24 },
  { x: 63, y: 24 },
  { x: 50, y: 34 },
  { x: 28, y: 29 },
  { x: 71, y: 47 },
]
const AUTUMN = ["#e6c14a", "#d99a3a", "#c2702c"]
const DLEAF = "M0 -1.7 C0.8 -0.9 0.7 0.9 0 1.7 C-0.7 0.9 -0.8 -0.9 0 -1.7 Z"
/** retention slack before any leaf turns; the point where leaves begin to fall */
const DECAY_FLOOR = 0.06
const FALL_THRESHOLD = 0.45

/**
 * Progressive autumn decay overlaid on the canopy: as retention falls, leaves on
 * a couple branches turn yellow, then orange, spreading branch by branch, with a
 * few drifting to the ground when long abandoned. Coded (not baked) so it tracks
 * retention continuously.
 */
function CanopyDecay({ amount }: { amount: number }) {
  const a = clamp01((amount - DECAY_FLOOR) / (1 - DECAY_FLOOR))
  if (a <= 0) return null
  const shown = Math.round(a * DECAY_SPOTS.length)
  const rand = rng(4242)
  const leaves: { x: number; y: number; r: number; s: number; fill: string }[] = []

  for (let i = 0; i < shown; i++) {
    const spot = DECAY_SPOTS[i]
    const k = 3 + Math.round(rand() * 2)
    for (let j = 0; j < k; j++) {
      // earlier branches + deeper neglect skew from yellow toward orange/rust
      const warm = clamp01(a * 0.8 + rand() * 0.4)
      const ci = warm > 0.72 ? 2 : warm > 0.4 ? 1 : 0
      leaves.push({
        x: spot.x + (rand() - 0.5) * 8,
        y: spot.y + (rand() - 0.5) * 7,
        r: rand() * 360,
        s: 0.85 + rand() * 0.5,
        fill: AUTUMN[ci],
      })
    }
  }

  // a few leaves drift to the ground once long abandoned
  if (a > FALL_THRESHOLD) {
    const fell = Math.round((a - FALL_THRESHOLD) * 10)
    for (let i = 0; i < fell; i++) {
      leaves.push({
        x: 30 + rand() * 42,
        y: 60 + rand() * 4,
        r: rand() * 360,
        s: 0.9 + rand() * 0.4,
        fill: AUTUMN[1 + Math.round(rand())],
      })
    }
  }

  return (
    <svg data-testid="canopy-decay" viewBox="0 0 100 67" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 2, pointerEvents: "none" }}>
      {leaves.map((l, i) => (
        <path key={i} d={DLEAF} fill={l.fill} opacity={0.9} transform={`translate(${l.x} ${l.y}) rotate(${l.r}) scale(${l.s})`} />
      ))}
    </svg>
  )
}

/* -------------------------------- the tree -------------------------------- */

/**
 * In "cutout" mode, resolve the transparent + brightened srcs for every frame so
 * crossfades stay smooth. Returns `{}` until ready (and always in "plate" mode),
 * so callers fall back to the original art; keying is cached, so this is cheap.
 */
function useKeyedWillowFrames(enabled: boolean): Record<string, string> {
  const [keyed, setKeyed] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!enabled) return
    let active = true
    Promise.all(
      FRAMES.map((f) => keyWillowFrame(f.src).then((url) => [f.src, url] as const)),
    )
      .then((pairs) => {
        if (active) setKeyed(Object.fromEntries(pairs))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [enabled])
  return keyed
}

export interface MasteryWillowProps {
  lessonsDone: number
  totalLessons: number
  /** 0..1 memory strength; below 1 the canopy fades + yellows (deprogression) */
  retention?: number
  /** Plate width: a px number, or any CSS length (e.g. "100%") to fill its column. */
  width?: number | string
  glow?: boolean
  /**
   * How the art meets the surface behind it. "plate" (default) sets the willow on
   * a light specimen plate that works in both themes. "cutout" removes the baked
   * paper and brightens the tree so it sits directly on a dark background.
   */
  variant?: "plate" | "cutout"
  className?: string
}

export function MasteryWillow({
  lessonsDone,
  totalLessons,
  retention = 1,
  width = 320,
  glow = true,
  variant = "plate",
  className,
}: MasteryWillowProps) {
  const idx = frameIndex(lessonsDone, totalLessons)
  const stage = FRAMES[idx].label.toLowerCase()
  const health = clamp01(retention)
  const growth = totalLessons > 0 ? clamp01(lessonsDone / totalLessons) : 0
  // a mild global dulling; the visible decay signal is the autumn overlay
  const filter = `saturate(${(0.62 + 0.38 * health).toFixed(2)}) sepia(${((1 - health) * 0.2).toFixed(2)})`
  const overall = 0.82 + 0.18 * health
  const glowIntensity = glow && totalLessons > 0 ? (0.35 + 0.65 * growth) * health ** 1.3 : 0

  const isCutout = variant === "cutout"
  const keyed = useKeyedWillowFrames(isCutout)
  // In cutout mode, swap in the keyed (transparent) art once ready; until then
  // render nothing rather than flash the original light paper.
  const src = isCutout ? keyed[FRAMES[idx].src] : FRAMES[idx].src

  return (
    <div
      className={cn(isCutout ? "select-none" : "willow-plate select-none", className)}
      style={{ width }}
      role="img"
      aria-label={`Mastery willow, ${stage}`}
    >
      <div className="relative" style={{ width: "100%", aspectRatio: "1024 / 683" }}>
        {src ? (
          <img
            key={src}
            src={src}
            alt=""
            draggable={false}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: overall, filter, transition: "opacity 200ms ease" }}
          />
        ) : null}
        <CanopyDecay amount={1 - health} />
        <CanopyGlow intensity={glowIntensity} />
      </div>
    </div>
  )
}
