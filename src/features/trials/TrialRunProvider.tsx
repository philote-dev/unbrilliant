import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from "react"

import { useAuth } from "@/lib/auth"
import { db } from "@/lib/firebase"
import { createFirestoreProgressRepository } from "@/features/progress/firestoreProgressRepository"
import type { ProgressRepository } from "@/features/progress/ProgressRepository"
import {
  createTrialModule,
  type TrialAction,
  type TrialRunState,
} from "@/features/trials/trialModule"
import type { TrialSpec } from "@/features/trials/types"

/** Dispatch accepts the trial actions plus an internal hydrate (resume/reconcile). */
export type TrialRunDispatch = Dispatch<
  TrialAction | { type: "hydrate"; state: TrialRunState }
>

interface TrialRunValue {
  trialId: string
  spec: TrialSpec
  state: TrialRunState
  dispatch: TrialRunDispatch
}

const TrialRunContext = createContext<TrialRunValue | null>(null)

/**
 * Wraps a pure {@link createTrialModule} run with persistence, mirroring
 * `LessonRunProvider`: one in-memory run per trialId in a ref (so a detour to
 * sign-in never loses it), an optimistic fire-and-forget autosave whenever the
 * durable slice changes, a once-per `uid:trialId` reconcile where the server
 * wins (rehydrate via `resume`), and a single completion hook. Anonymous runs
 * stay entirely in memory.
 *
 * `onTrialComplete` is injected rather than wired in here so the completion side
 * effect (the clean-pass mastery boost, landed in a later task) stays out of the
 * provider and the whole flow is unit-testable with the in-memory repo.
 */
export function TrialRunProvider({
  spec,
  children,
  repo: repoProp,
  onTrialComplete,
}: {
  spec: TrialSpec
  children: ReactNode
  /** Defaults to the Firestore repo; tests inject the in-memory fake. */
  repo?: ProgressRepository
  /** Fired once when the run completes (signed-in only); wires the mastery boost. */
  onTrialComplete?: (spec: TrialSpec, cleanPass: boolean) => void
}) {
  const { user } = useAuth()
  const repo = useMemo(
    () => repoProp ?? createFirestoreProgressRepository(db),
    [repoProp],
  )
  const trialModule = useMemo(() => createTrialModule(spec), [spec])
  const trialId = spec.id

  // One in-memory run per trialId. Keyed so switching trials never clobbers an
  // in-flight run, matching the lesson provider's run map.
  const runsRef = useRef<Record<string, TrialRunState>>({})
  if (!(trialId in runsRef.current)) {
    runsRef.current[trialId] = trialModule.create()
  }
  const [, bump] = useReducer((n: number) => n + 1, 0)
  const state = runsRef.current[trialId]

  const dispatch = useCallback<TrialRunDispatch>(
    (action) => {
      if (action.type === "hydrate") {
        runsRef.current[trialId] = action.state
      } else {
        runsRef.current[trialId] = trialModule.reducer(
          runsRef.current[trialId],
          action,
        )
      }
      bump()
    },
    [trialId, trialModule],
  )

  // Gate persistence on a completed reconcile, keyed to uid:trialId. Held as
  // state (not a ref) so flipping it re-runs the autosave effect, which is what
  // carries a brand-new account's local run up to the server.
  const [reconciled, setReconciled] = useState<string | null>(null)
  // The completion hook fires once per trialId per session. A server slice that
  // is already complete pre-arms this so a resume never re-fires the boost.
  const completionFiredRef = useRef<Set<string>>(new Set())

  // Reconcile once per signed-in user + trial. Server wins: a saved slice
  // rehydrates the run via resume. A brand-new account keeps its local run, which
  // the autosave effect carries up once `reconciled` flips.
  useEffect(() => {
    if (!user) {
      setReconciled(null)
      return
    }
    const key = `${user.uid}:${trialId}`
    if (reconciled === key) return

    let cancelled = false
    void (async () => {
      try {
        await repo.ensureUser(user.uid, {
          displayName: user.displayName || "Learner",
        })
        const server = await repo.getTrialProgress(user.uid, trialId)
        if (cancelled) return
        if (server) {
          // A trial finished in a prior session has already had its boost; never
          // re-fire it on resume.
          if (server.completed) completionFiredRef.current.add(trialId)
          dispatch({ type: "hydrate", state: trialModule.resume(server) })
        }
        setReconciled(key)
      } catch {
        // Optimistic by design: a failed reconcile never blocks play.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, trialId, reconciled, repo, trialModule, dispatch])

  // Persist the durable slice once reconciled (optimistic, off the hot path). On
  // the transition to complete, fire the injected hook exactly once before the
  // final save. Anonymous runs no-op here: memory only, no persistence.
  const progressSig = JSON.stringify(trialModule.toProgress(state))
  useEffect(() => {
    if (!user || reconciled !== `${user.uid}:${trialId}`) return
    const current = runsRef.current[trialId]
    if (
      trialModule.completed(current) &&
      !completionFiredRef.current.has(trialId)
    ) {
      completionFiredRef.current.add(trialId)
      onTrialComplete?.(spec, current.cleanPass)
    }
    void repo
      .saveTrialProgress(user.uid, trialId, trialModule.toProgress(current))
      .catch(() => {})
  }, [
    user,
    trialId,
    reconciled,
    repo,
    trialModule,
    spec,
    onTrialComplete,
    progressSig,
  ])

  const value = useMemo<TrialRunValue>(
    () => ({ trialId, spec, state, dispatch }),
    [trialId, spec, state, dispatch],
  )

  return <TrialRunContext value={value}>{children}</TrialRunContext>
}

export function useTrialRun(): TrialRunValue {
  const ctx = useContext(TrialRunContext)
  if (!ctx) throw new Error("useTrialRun must be used within TrialRunProvider")
  return ctx
}
