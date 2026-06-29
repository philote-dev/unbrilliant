import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { useAuth } from "@/lib/auth"
import { db } from "@/lib/firebase"
import { createFirestoreProgressRepository } from "@/features/progress/firestoreProgressRepository"
import { mergeActivity } from "@/features/progress/mergeActivity"
import { lastNDayKeys } from "@/features/progress/activityDate"
import { useLessonRun } from "@/features/lesson/useLessonRun"
import {
  DATA_STRUCTURES_LESSONS,
  deriveCourseProgress,
  type ProgressByLesson,
} from "@/lessons/catalog"
import type { ActivityDay } from "@/features/progress/ProgressRepository"

/**
 * The learner's real progress, read once per signed-in user through the
 * `ProgressRepository` boundary and overlaid with the live in-run state so the
 * catalog / dashboard / progress surfaces reflect honest, derived numbers.
 *
 * It also owns `currentCourseId` — the "has entered a course" signal that flips
 * Home from vision to dashboard. For a signed-in learner it persists on the user
 * doc (and a course entered anonymously carries up on sign-in); for an anonymous
 * learner it lives only in memory (a refresh returns them to the vision hero).
 */
interface CourseProgressValue {
  progressByLesson: ProgressByLesson
  courseProgress: (courseId: string) => number
  currentCourseId: string | null
  /** The on-fire streak (persisted best, overlaid with the live run's combo). */
  streak: { current: number; longest: number }
  /** Per-day answer activity (persisted log overlaid with this session's deltas). */
  activity: ActivityDay[]
  /** Ids of Trials the learner has completed (signed-in only; empty otherwise). */
  completedTrials: ReadonlySet<string>
  /** Mark a course as entered (flips Home to dashboard; persists when signed-in). */
  enterCourse: (courseId: string) => void
  /** Re-read persisted progress (e.g. after completing a lesson). */
  refresh: () => void
}

const CourseProgressContext = createContext<CourseProgressValue | null>(null)

export function CourseProgressProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const {
    state: runState,
    module: runModule,
    lessonId: runLessonId,
    sessionActivity,
  } = useLessonRun()
  const repo = useMemo(() => createFirestoreProgressRepository(db), [])
  const [server, setServer] = useState<ProgressByLesson>({})
  // Lessons finished during this session, kept beyond their active run. This is
  // what lets an anonymous learner (who has no `server`) advance: once they
  // finish a lesson its completion stays counted, so the next lesson unlocks.
  const [sessionProgress, setSessionProgress] = useState<ProgressByLesson>({})
  const [currentCourseId, setCurrentCourseId] = useState<string | null>(null)
  const [serverStreak, setServerStreak] = useState({ current: 0, longest: 0 })
  const [serverActivity, setServerActivity] = useState<ActivityDay[]>([])
  const [completedTrials, setCompletedTrials] = useState<Set<string>>(
    () => new Set(),
  )
  const [reloadKey, setReloadKey] = useState(0)

  const currentCourseIdRef = useRef(currentCourseId)
  currentCourseIdRef.current = currentCourseId

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

  // Load persisted progress + currentCourseId for the signed-in user. On sign-in
  // the server wins for currentCourseId; otherwise a course entered while
  // anonymous carries up (a one-time merge write).
  useEffect(() => {
    if (!user) {
      setServer({})
      setServerStreak({ current: 0, longest: 0 })
      setCompletedTrials(new Set())
      return
    }
    let cancelled = false
    void (async () => {
      const [doc, entries, trialIds] = await Promise.all([
        repo.getUser(user.uid),
        Promise.all(
          DATA_STRUCTURES_LESSONS.map(
            async (l) => [l.id, await repo.getProgress(user.uid, l.id)] as const,
          ),
        ),
        repo.listCompletedTrials(user.uid),
      ])
      if (cancelled) return
      const next: ProgressByLesson = {}
      for (const [id, p] of entries) if (p) next[id] = p
      setServer(next)
      setCompletedTrials(new Set(trialIds))
      setServerStreak(doc?.streak ?? { current: 0, longest: 0 })
      if (doc?.currentCourseId) {
        setCurrentCourseId(doc.currentCourseId)
      } else if (currentCourseIdRef.current) {
        await repo.updateUser(user.uid, {
          currentCourseId: currentCourseIdRef.current,
        })
      }
    })().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user, repo, reloadKey])

  // Load the persisted activity log once per signed-in user, deliberately NOT on
  // `refresh()`. The session overlay already reflects this run's answers live, and
  // those answers are persisted fire-and-forget; re-reading the server mid-session
  // would return rows that already include the overlay's deltas, so merging would
  // double-count today. A full reload (overlay cleared) picks up the server total.
  useEffect(() => {
    if (!user) {
      setServerActivity([])
      return
    }
    let cancelled = false
    void (async () => {
      // A little over the 365-day calendar window so the oldest column is full.
      const days = await repo.getActivity(user.uid, lastNDayKeys(Date.now(), 370)[0])
      if (!cancelled) setServerActivity(days)
    })().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user, repo])

  // Signing out drops the (now-irrelevant) in-memory course selection.
  useEffect(() => {
    if (!user) setCurrentCourseId(null)
  }, [user])

  const enterCourse = useCallback(
    (courseId: string) => {
      setCurrentCourseId(courseId)
      if (user)
        void repo.updateUser(user.uid, { currentCourseId: courseId }).catch(
          () => {},
        )
    },
    [user, repo],
  )

  // Record a lesson's progress once it completes, so a finished lesson stays
  // counted for the rest of the session even after its run stops being active.
  // Only completions are recorded and they are never downgraded, so re-playing a
  // finished lesson can never re-lock what comes after it.
  useEffect(() => {
    if (!runModule.hasProgress(runState)) return
    const p = runModule.toProgress(runState)
    if (!p.completed) return
    setSessionProgress((prev) =>
      prev[runLessonId]?.completed ? prev : { ...prev, [runLessonId]: p },
    )
  }, [runState, runModule, runLessonId])

  // Overlay order: persisted server progress, then this session's completed
  // lessons (an upgrade-only layer that carries an anonymous learner forward),
  // then the live active run on top so mid-run progress shows at once.
  const progressByLesson = useMemo<ProgressByLesson>(() => {
    const base = { ...server, ...sessionProgress }
    if (!runModule.hasProgress(runState)) return base
    return { ...base, [runLessonId]: runModule.toProgress(runState) }
  }, [server, sessionProgress, runState, runModule, runLessonId])

  const courseProgress = useCallback(
    (courseId: string) => deriveCourseProgress(courseId, progressByLesson),
    [progressByLesson],
  )

  // The persisted best, overlaid with the live run's combo so the dashboard
  // reflects an in-progress streak without waiting for a re-read.
  const liveCombo = runModule.combo(runState)
  const streak = useMemo(
    () => ({
      current: Math.max(serverStreak.current, liveCombo),
      longest: Math.max(serverStreak.longest, liveCombo),
    }),
    [serverStreak, liveCombo],
  )

  // The persisted log overlaid with this session's deltas, so "today" reflects
  // the live run at once (and an anonymous run shows for the session).
  const activity = useMemo(
    () => mergeActivity(serverActivity, sessionActivity),
    [serverActivity, sessionActivity],
  )

  const value = useMemo<CourseProgressValue>(
    () => ({
      progressByLesson,
      courseProgress,
      currentCourseId,
      streak,
      activity,
      completedTrials,
      enterCourse,
      refresh,
    }),
    [
      progressByLesson,
      courseProgress,
      currentCourseId,
      streak,
      activity,
      completedTrials,
      enterCourse,
      refresh,
    ],
  )

  return (
    <CourseProgressContext value={value}>{children}</CourseProgressContext>
  )
}

export function useCourseProgress(): CourseProgressValue {
  const ctx = useContext(CourseProgressContext)
  if (!ctx)
    throw new Error(
      "useCourseProgress must be used within CourseProgressProvider",
    )
  return ctx
}
