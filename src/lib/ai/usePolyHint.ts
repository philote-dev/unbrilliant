import { useEffect, useRef, useState } from "react"

import {
  requestHint as defaultRequestHint,
  type HintRequest,
  type HintResponse,
} from "@/lib/ai/polyClient"

export interface UsePolyHintArgs {
  stageId: string
  skill: string
  discipline: "stack" | "queue"
  /** Non-null when a wrong build just happened. `id` is a monotonically rising
   * attempt marker so each new wrong attempt triggers at most one fetch. */
  wrongAttempt: { id: number; learnerOrder: string[] } | null
  maxHints?: number
  requestHint?: (req: HintRequest) => Promise<HintResponse>
}

export interface PolyHintState {
  loading: boolean
  text: string | null
}

export function usePolyHint({
  stageId,
  skill,
  discipline,
  wrongAttempt,
  maxHints = 2,
  requestHint = defaultRequestHint,
}: UsePolyHintArgs): PolyHintState {
  const [state, setState] = useState<PolyHintState>({ loading: false, text: null })
  const countRef = useRef(0)
  const priorRef = useRef<string | undefined>(undefined)
  const skillRef = useRef(skill)

  // Reset the per-problem cap when the beat (skill) changes.
  if (skillRef.current !== skill) {
    skillRef.current = skill
    countRef.current = 0
    priorRef.current = undefined
  }

  const attemptId = wrongAttempt?.id ?? null

  useEffect(() => {
    if (!wrongAttempt) {
      setState({ loading: false, text: null })
      return
    }

    if (countRef.current >= maxHints) {
      setState({ loading: false, text: null })
      return
    }

    let cancelled = false
    setState({ loading: true, text: null })
    void (async () => {
      try {
        const res = await requestHint({
          stageId,
          skill,
          discipline,
          learnerOrder: wrongAttempt.learnerOrder,
          priorHint: priorRef.current,
        })
        if (cancelled) return
        countRef.current += 1
        if (res.hint) priorRef.current = res.hint
        setState({ loading: false, text: res.hint })
      } catch {
        if (cancelled) return
        setState({ loading: false, text: null })
      }
    })()
    return () => {
      cancelled = true
    }
    // Fire once per new wrong attempt. stageId/skill/discipline/requestHint are
    // read fresh inside and must NOT be deps, or a re-render would refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId])

  return state
}
