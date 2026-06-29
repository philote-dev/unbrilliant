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
import { useNavigation } from "@/lib/navigation"
import { LIVE_LESSON_ID } from "@/lessons/catalog"
import { createFirestoreProgressRepository } from "@/features/progress/firestoreProgressRepository"
import { reconcileRun } from "@/features/progress/reconcileRun"
import { activityDelta, answerTallies } from "@/features/progress/activityDelta"
import { dayKeyToUTCDate, localDayKey } from "@/features/progress/activityDate"
import { useConceptReviews } from "@/features/progress/ConceptReviewProvider"
import { risenConcepts } from "@/features/progress/concepts"
import { getLessonModule } from "@/features/lesson/lessons"
import {
  lessonRunKeyForScreen,
  screenHasLessonRun,
} from "@/features/lesson/lessonRunRoute"
import { reconcileModule, type LessonModule } from "@/features/lesson/lessonModule"
import type { LessonAction } from "@/features/lesson/engine"
import type { ActivityDay } from "@/features/progress/ProgressRepository"

/**
 * Wraps the pure lesson modules with persistence. Lives ABOVE the screen router
 * so the in-memory run survives a detour to the sign-in screen (carry-up). It
 * keeps one run per lessonId (a Map), so switching lessons. Stacks & Queues to
 * the now-unlocked Arrays. Never loses progress, and the active lesson follows
 * navigation. Writes are optimistic/off the hot path; reconcile resumes a
 * returning account or carries up a brand-new one, once per signed-in user/lesson.
 */
type RunDispatch = Dispatch<LessonAction | { type: "hydrate"; state: unknown }>

interface LessonRunValue {
  lessonId: string
  module: LessonModule<unknown>
  state: unknown
  dispatch: RunDispatch
  /** This session's per-day answer activity (overlay for the progress page). */
  sessionActivity: ActivityDay[]
}

const LessonRunContext = createContext<LessonRunValue | null>(null)

export function LessonRunProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { screen } = useNavigation()
  const repo = useMemo(() => createFirestoreProgressRepository(db), [])

  // The active lesson follows navigation; on non-lesson screens (the sign-in
  // detour) we keep the last lesson so its in-run state survives the round trip.
  const activeLessonRef = useRef<string>(LIVE_LESSON_ID)
  const activeRunKeyRef = useRef<string>(LIVE_LESSON_ID)
  if (screenHasLessonRun(screen)) {
    activeLessonRef.current = screen.lessonId
    activeRunKeyRef.current = lessonRunKeyForScreen(screen) ?? screen.lessonId
  }
  const lessonId = activeLessonRef.current
  const runKey = activeRunKeyRef.current
  const persistenceEnabled = !runKey.startsWith("playtest:")
  const module = getLessonModule(lessonId) as LessonModule<unknown>

  // One in-memory run per run key. Playtests use a separate key so they never
  // mutate the normal in-memory lesson run or any persisted progress.
  const runsRef = useRef<Record<string, unknown>>({})
  if (!(runKey in runsRef.current)) {
    runsRef.current[runKey] = module.create()
  }
  const [, bump] = useReducer((n: number) => n + 1, 0)
  const state = runsRef.current[runKey]

  const dispatch = useCallback<RunDispatch>((action) => {
    const id = activeLessonRef.current
    const key = activeRunKeyRef.current
    const mod = getLessonModule(id)
    if (action.type === "hydrate") {
      runsRef.current[key] = action.state
    } else {
      runsRef.current[key] = mod.reducer(runsRef.current[key], action)
    }
    bump()
  }, [])

  const reconciledKey = useRef<string | null>(null)
  const streakRef = useRef<{ current: number; longest: number }>({
    current: 0,
    longest: 0,
  })

  // The cumulative answer tally last recorded per lesson, so each record adds
  // only the delta since the previous one (StrictMode- and resume-safe).
  const activityBaseRef = useRef<
    Record<string, { attempted: number; correct: number }>
  >({})
  const [sessionActivityMap, setSessionActivityMap] = useState<
    Record<string, { attempted: number; correct: number }>
  >({})

  // The concept-memory write path plus the per-lesson counters baseline its diff
  // rides (same StrictMode-/resume-safe idiom as activityBaseRef above).
  const { recordReview } = useConceptReviews()
  const reviewBaseRef = useRef<Record<string, Record<string, number>>>({})

  // Reconcile once per signed-in user + active lesson. Gating on the COMPLETED
  // key (not a "started" flag) stays correct under React StrictMode's double
  // mount: a cancelled first pass leaves it unreconciled so the second runs.
  useEffect(() => {
    if (!persistenceEnabled || !user) {
      reconciledKey.current = null
      return
    }
    const key = `${user.uid}:${lessonId}`
    if (reconciledKey.current === key) return

    let cancelled = false
    void (async () => {
      try {
        const plan = await reconcileRun(
          repo,
          { uid: user.uid, displayName: user.displayName || "Learner", lessonId },
          () => runsRef.current[runKey],
          (local, server) => reconcileModule(module, local, server),
          () => cancelled,
        )
        if (cancelled) return
        if (plan.kind === "resume") dispatch({ type: "hydrate", state: plan.state })
        const u = await repo.getUser(user.uid)
        if (cancelled) return
        streakRef.current = u?.streak ?? { current: 0, longest: 0 }
        reconciledKey.current = key
      } catch {
        // Optimistic by design: a failed reconcile never blocks play.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, lessonId, runKey, persistenceEnabled, repo, module, dispatch])

  // Persist durable changes once reconciled (optimistic, off the hot path). The
  // serialized progress signature drives when to write. Lesson-agnostic.
  const progressSig = JSON.stringify(module.toProgress(state))
  useEffect(() => {
    if (
      !persistenceEnabled ||
      !user ||
      reconciledKey.current !== `${user.uid}:${lessonId}`
    ) {
      return
    }
    void repo
      .saveProgress(user.uid, lessonId, module.toProgress(runsRef.current[runKey]))
      .catch(() => {})
  }, [user, lessonId, runKey, persistenceEnabled, repo, module, progressSig])

  // Record per-day answer activity (the contribution calendar / trends source).
  // The delta is the change in cumulative answer tallies since the last record,
  // so a double-fired effect (StrictMode) or a resume-hydrate jump never
  // double-counts: while signed-in-but-unreconciled we only (re)baseline. The
  // in-memory overlay always accrues (so anonymous runs show this session); only
  // a signed-in, reconciled run persists (history starts at sign-in, no backfill).
  useEffect(() => {
    if (!persistenceEnabled) return
    const current = answerTallies(
      module.toProgress(runsRef.current[runKey]).counters,
    )
    if (user && reconciledKey.current !== `${user.uid}:${lessonId}`) {
      activityBaseRef.current[runKey] = current
      return
    }
    const base = activityBaseRef.current[runKey]
    if (!base) {
      activityBaseRef.current[runKey] = current
      return
    }
    const delta = activityDelta(base, current)
    activityBaseRef.current[runKey] = current
    if (delta.attempted <= 0) return
    const dayKey = localDayKey(Date.now())
    setSessionActivityMap((prev) => {
      const prevDay = prev[dayKey] ?? { attempted: 0, correct: 0 }
      return {
        ...prev,
        [dayKey]: {
          attempted: prevDay.attempted + delta.attempted,
          correct: prevDay.correct + delta.correct,
        },
      }
    })
    if (user) void repo.recordActivity(user.uid, dayKey, delta).catch(() => {})
  }, [user, lessonId, runKey, persistenceEnabled, repo, module, progressSig])

  // Feed the concept-memory substrate from normal play: each rise in a lesson's
  // durable correct-count records a correct rep for that concept. Baseline while
  // signed-in-but-unreconciled (so a resume-hydrate jump never back-fills), then
  // diff. Anonymous runs no-op inside recordReview (signed-in only).
  useEffect(() => {
    if (!persistenceEnabled) return
    const counters = module.toProgress(runsRef.current[runKey]).counters
    if (user && reconciledKey.current !== `${user.uid}:${lessonId}`) {
      reviewBaseRef.current[runKey] = counters
      return
    }
    const base = reviewBaseRef.current[runKey]
    if (!base) {
      reviewBaseRef.current[runKey] = counters
      return
    }
    for (const id of risenConcepts(lessonId, base, counters)) {
      recordReview(id, true)
    }
    reviewBaseRef.current[runKey] = counters
  }, [user, lessonId, runKey, persistenceEnabled, module, recordReview, progressSig])

  // Persist the on-fire streak from the run's combo: current tracks the live
  // combo; longest is preserved as the all-time best (carries across sessions
  // and up on sign-in). The transient combo itself is unchanged.
  const combo = module.combo(state)
  useEffect(() => {
    if (
      !persistenceEnabled ||
      !user ||
      reconciledKey.current !== `${user.uid}:${lessonId}`
    ) {
      return
    }
    const prev = streakRef.current
    const longest = Math.max(prev.longest, combo)
    if (prev.current === combo && prev.longest === longest) return
    streakRef.current = { current: combo, longest }
    void repo.updateUser(user.uid, { streak: streakRef.current }).catch(() => {})
  }, [user, lessonId, persistenceEnabled, repo, combo])

  const sessionActivity = useMemo<ActivityDay[]>(
    () =>
      Object.entries(sessionActivityMap)
        .map(([dayKey, v]) => ({
          date: dayKeyToUTCDate(dayKey),
          attempted: v.attempted,
          correct: v.correct,
        }))
        .sort((a, b) => a.date - b.date),
    [sessionActivityMap],
  )

  const value = useMemo<LessonRunValue>(
    () => ({ lessonId, module, state, dispatch, sessionActivity }),
    [lessonId, module, state, dispatch, sessionActivity],
  )

  return <LessonRunContext value={value}>{children}</LessonRunContext>
}

export function useLessonRun(): LessonRunValue {
  const ctx = useContext(LessonRunContext)
  if (!ctx)
    throw new Error("useLessonRun must be used within LessonRunProvider")
  return ctx
}
