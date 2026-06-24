import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useReducedMotion } from "motion/react"

/**
 * The cross-lesson playback brain for snapshot-driven operation animations. It
 * owns ONLY transient VIEW state (a frame index + playback flags); it never
 * touches engine state, so a learner scrubbing frames can never advance a graded
 * answer. Pair it with `StepTransport` for the UI.
 *
 * Reduced motion is honored at the source: a reduced-motion player starts on the
 * END frame (the snapped end-state) and never auto-plays, so the result is shown
 * at rest while stepping stays available for anyone who wants to walk it.
 */

export const STEP_SPEEDS = [0.25, 0.5, 1, 2, 4] as const
export type StepSpeed = (typeof STEP_SPEEDS)[number]

/** Base dwell per frame at 1x; the real interval is `BASE_STEP_MS / speed`. */
export const BASE_STEP_MS = 720

export interface StepPlayer {
  index: number
  total: number
  atStart: boolean
  atEnd: boolean
  playing: boolean
  speed: number
  play: () => void
  pause: () => void
  toggle: () => void
  next: () => void
  prev: () => void
  first: () => void
  last: () => void
  goTo: (index: number) => void
  /** Jump to the start and play again (no-op auto-play under reduced motion). */
  replay: () => void
  setSpeed: (speed: number) => void
}

export interface StepPlayerOptions {
  /** Force reduced motion (defaults to the live `prefers-reduced-motion`). */
  reduced?: boolean
  /** Auto-advance from the first frame on mount (ignored under reduced motion). */
  autoPlay?: boolean
  /** Speed multiplier to start at (clamped to the supported range). */
  initialSpeed?: number
  /** Dwell per frame at 1x, in ms (mostly for tests). */
  baseStepMs?: number
}

const MIN_SPEED = STEP_SPEEDS[0]
const MAX_SPEED = STEP_SPEEDS[STEP_SPEEDS.length - 1]

const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(Math.max(n, lo), hi)

const lastIndex = (total: number): number => Math.max(0, total - 1)

export function useStepPlayer(
  total: number,
  options: StepPlayerOptions = {},
): StepPlayer {
  const systemReduced = useReducedMotion() ?? false
  const reduced = options.reduced ?? systemReduced
  const autoPlay = options.autoPlay ?? false
  const baseStepMs = options.baseStepMs ?? BASE_STEP_MS
  const canPlay = !reduced && total > 1

  const [index, setIndex] = useState(reduced ? lastIndex(total) : 0)
  const [playing, setPlaying] = useState(autoPlay && canPlay)
  const [speed, setSpeedState] = useState<number>(() =>
    clamp(options.initialSpeed ?? 1, MIN_SPEED, MAX_SPEED),
  )

  const playingRef = useRef(playing)
  useEffect(() => {
    playingRef.current = playing
  }, [playing])

  // Re-seed when the frame sequence itself changes (a new question/op): land on
  // the right starting frame and resume auto-play only when motion is allowed.
  useEffect(() => {
    setIndex(reduced ? lastIndex(total) : 0)
    setPlaying(autoPlay && !reduced && total > 1)
  }, [total, reduced, autoPlay])

  const pause = useCallback(() => setPlaying(false), [])

  const play = useCallback(() => {
    if (reduced || total <= 1) return
    setIndex((i) => (i >= lastIndex(total) ? 0 : i)) // rewind if parked at the end
    setPlaying(true)
  }, [reduced, total])

  const toggle = useCallback(() => {
    if (playingRef.current) {
      setPlaying(false)
      return
    }
    play()
  }, [play])

  const goTo = useCallback(
    (next: number) => {
      setPlaying(false)
      const target = clamp(Math.round(next), 0, lastIndex(total))
      if (!Number.isNaN(target)) setIndex(target)
    },
    [total],
  )
  const next = useCallback(() => goTo(index + 1), [goTo, index])
  const prev = useCallback(() => goTo(index - 1), [goTo, index])
  const first = useCallback(() => goTo(0), [goTo])
  const last = useCallback(() => goTo(lastIndex(total)), [goTo, total])

  const replay = useCallback(() => {
    setIndex(0)
    setPlaying(!reduced && total > 1)
  }, [reduced, total])

  const setSpeed = useCallback((s: number) => {
    setSpeedState(clamp(s, MIN_SPEED, MAX_SPEED))
  }, [])

  // The auto-advance loop just walks the index forward; a fresh interval is
  // created when speed changes so the new tempo takes effect immediately.
  useEffect(() => {
    if (!playing || total <= 1) return
    const intervalMs = Math.max(16, baseStepMs / speed)
    const id = setInterval(() => {
      setIndex((i) => Math.min(i + 1, lastIndex(total)))
    }, intervalMs)
    return () => clearInterval(id)
  }, [playing, speed, total, baseStepMs])

  // Stop at the end (no looping). Pairing this with the loop above keeps the
  // advance side-effect-free, so it stays correct under StrictMode double-mounts.
  useEffect(() => {
    if (playing && index >= lastIndex(total)) setPlaying(false)
  }, [playing, index, total])

  return useMemo<StepPlayer>(
    () => ({
      index,
      total,
      atStart: index <= 0,
      atEnd: index >= lastIndex(total),
      playing,
      speed,
      play,
      pause,
      toggle,
      next,
      prev,
      first,
      last,
      goTo,
      replay,
      setSpeed,
    }),
    [
      index,
      total,
      playing,
      speed,
      play,
      pause,
      toggle,
      next,
      prev,
      first,
      last,
      goTo,
      replay,
      setSpeed,
    ],
  )
}
