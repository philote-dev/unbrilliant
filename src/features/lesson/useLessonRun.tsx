import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from "react"

import { useAuth } from "@/lib/auth"
import { db } from "@/lib/firebase"
import { useNavigation } from "@/lib/navigation"
import { LIVE_LESSON_ID } from "@/lessons/catalog"
import { createFirestoreProgressRepository } from "@/features/progress/firestoreProgressRepository"
import { reconcileRun } from "@/features/progress/reconcileRun"
import { getLessonModule } from "@/features/lesson/lessons"
import { reconcileModule, type LessonModule } from "@/features/lesson/lessonModule"
import type { LessonAction } from "@/features/lesson/engine"

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
}

const LessonRunContext = createContext<LessonRunValue | null>(null)

export function LessonRunProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { screen } = useNavigation()
  const repo = useMemo(() => createFirestoreProgressRepository(db), [])

  // The active lesson follows navigation; on non-lesson screens (the sign-in
  // detour) we keep the last lesson so its in-run state survives the round trip.
  const activeLessonRef = useRef<string>(LIVE_LESSON_ID)
  if (screen.name === "lesson" || screen.name === "complete") {
    activeLessonRef.current = screen.lessonId
  }
  const lessonId = activeLessonRef.current
  const module = getLessonModule(lessonId) as LessonModule<unknown>

  // One in-memory run per lesson id. A ref-backed map + a render bump keeps the
  // manual reducer synchronous (no flash when switching lessons mid-render).
  const runsRef = useRef<Record<string, unknown>>({})
  if (!(lessonId in runsRef.current)) {
    runsRef.current[lessonId] = module.create()
  }
  const [, bump] = useReducer((n: number) => n + 1, 0)
  const state = runsRef.current[lessonId]

  const dispatch = useCallback<RunDispatch>((action) => {
    const id = activeLessonRef.current
    const mod = getLessonModule(id)
    if (action.type === "hydrate") {
      runsRef.current[id] = action.state
    } else {
      runsRef.current[id] = mod.reducer(runsRef.current[id], action)
    }
    bump()
  }, [])

  const reconciledKey = useRef<string | null>(null)
  const streakRef = useRef<{ current: number; longest: number }>({
    current: 0,
    longest: 0,
  })

  // Reconcile once per signed-in user + active lesson. Gating on the COMPLETED
  // key (not a "started" flag) stays correct under React StrictMode's double
  // mount: a cancelled first pass leaves it unreconciled so the second runs.
  useEffect(() => {
    if (!user) {
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
          () => runsRef.current[lessonId],
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
  }, [user, lessonId, repo, module, dispatch])

  // Persist durable changes once reconciled (optimistic, off the hot path). The
  // serialized progress signature drives when to write. Lesson-agnostic.
  const progressSig = JSON.stringify(module.toProgress(state))
  useEffect(() => {
    if (!user || reconciledKey.current !== `${user.uid}:${lessonId}`) return
    void repo
      .saveProgress(user.uid, lessonId, module.toProgress(runsRef.current[lessonId]))
      .catch(() => {})
  }, [user, lessonId, repo, module, progressSig])

  // Persist the on-fire streak from the run's combo: current tracks the live
  // combo; longest is preserved as the all-time best (carries across sessions
  // and up on sign-in). The transient combo itself is unchanged.
  const combo = module.combo(state)
  useEffect(() => {
    if (!user || reconciledKey.current !== `${user.uid}:${lessonId}`) return
    const prev = streakRef.current
    const longest = Math.max(prev.longest, combo)
    if (prev.current === combo && prev.longest === longest) return
    streakRef.current = { current: combo, longest }
    void repo.updateUser(user.uid, { streak: streakRef.current }).catch(() => {})
  }, [user, lessonId, repo, combo])

  const value = useMemo<LessonRunValue>(
    () => ({ lessonId, module, state, dispatch }),
    [lessonId, module, state, dispatch],
  )

  return <LessonRunContext value={value}>{children}</LessonRunContext>
}

export function useLessonRun(): LessonRunValue {
  const ctx = useContext(LessonRunContext)
  if (!ctx)
    throw new Error("useLessonRun must be used within LessonRunProvider")
  return ctx
}
