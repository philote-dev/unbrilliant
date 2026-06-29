import { useEffect, useRef } from "react"

export interface UseStallNudgeArgs {
  /** Only arm the timer on a complex beat that can show a nudge. */
  enabled: boolean
  /** Change this on any learner action to reset the idle timer. */
  resetKey: unknown
  /** Idle window before a nudge fires. */
  delayMs?: number
  onStall: () => void
}

/** Fires `onStall` once after `delayMs` of inactivity. The timer restarts when
 * `resetKey` changes (an action) or `enabled` toggles. */
export function useStallNudge({
  enabled,
  resetKey,
  delayMs = 20000,
  onStall,
}: UseStallNudgeArgs): void {
  const onStallRef = useRef(onStall)
  onStallRef.current = onStall

  useEffect(() => {
    if (!enabled) return
    const t = setTimeout(() => onStallRef.current(), delayMs)
    return () => clearTimeout(t)
  }, [enabled, resetKey, delayMs])
}
