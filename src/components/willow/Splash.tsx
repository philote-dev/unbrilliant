import { useCallback, useEffect, useRef } from "react"
import { motion, useReducedMotion } from "motion/react"

/**
 * The calm "Willow" load-in. Plays once before the first-run vision landing: the
 * wordmark fades, scales, and de-blurs in, holds, then lifts and fades out, and
 * calls `onDone`. Tap, click, or any key skips straight to the handoff. Under
 * `prefers-reduced-motion` there is no beat: it calls `onDone` on mount and
 * renders nothing. Owns one timeline and a single, idempotent `onDone`.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion() ?? false
  const done = useRef(false)

  const finish = useCallback(() => {
    if (done.current) return
    done.current = true
    onDone()
  }, [onDone])

  // Reduced motion: snap straight to the landing, no splash beat.
  useEffect(() => {
    if (reduce) finish()
  }, [reduce, finish])

  // Any real key skips. (Pointer skip is handled by the overlay's onClick.)
  // Lone modifier presses are ignored so a screen-reader chord or Cmd+Tab does
  // not dismiss the beat.
  useEffect(() => {
    if (reduce) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return
      finish()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [reduce, finish])

  if (reduce) return null

  return (
    <motion.div
      data-testid="willow-splash"
      role="presentation"
      onClick={finish}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
    >
      <motion.span
        aria-label="Willow"
        className="text-5xl font-semibold tracking-tight text-lilac-strong"
        initial={{ opacity: 0, scale: 0.92, filter: "blur(5px)", y: 0 }}
        animate={{
          opacity: [0, 1, 1, 0],
          scale: [0.92, 1, 1, 1],
          filter: ["blur(5px)", "blur(0px)", "blur(0px)", "blur(0px)"],
          y: [0, 0, 0, -22],
        }}
        transition={{
          duration: 2.02,
          times: [0, 0.36, 0.74, 1],
          ease: ["easeOut", "linear", "easeIn"],
        }}
        onAnimationComplete={finish}
      >
        Willow
      </motion.span>
    </motion.div>
  )
}
