import { useEffect, useState } from "react"

/**
 * Replays an entrance animation on a fixed cadence by bumping a remount key: pass
 * the returned number as a React `key` to the node you want to re-enter, and it
 * will re-mount (and so re-animate) every `periodMs`. Used to loop the grow
 * choreography so a learner sees the copy happen "again and again". Inactive
 * (reduced motion, or tests) holds at 0, so the figure stays static and leaves no
 * timer behind.
 */
export function useReplayCycle(active: boolean, periodMs: number): number {
  const [cycle, setCycle] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setCycle((c) => c + 1), periodMs)
    return () => window.clearInterval(id)
  }, [active, periodMs])
  return cycle
}
