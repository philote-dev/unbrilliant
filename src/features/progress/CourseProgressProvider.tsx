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
import { useLessonRun } from "@/features/lesson/useLessonRun"
import {
  DATA_STRUCTURES_LESSONS,
  deriveCourseProgress,
  type ProgressByLesson,
} from "@/lessons/catalog"

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
  /** Mark a course as entered (flips Home to dashboard; persists when signed-in). */
  enterCourse: (courseId: string) => void
  /** Re-read persisted progress (e.g. after completing a lesson). */
  refresh: () => void
}

const CourseProgressContext = createContext<CourseProgressValue | null>(null)

export function CourseProgressProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { state: runState, module: runModule, lessonId: runLessonId } =
    useLessonRun()
  const repo = useMemo(() => createFirestoreProgressRepository(db), [])
  const [server, setServer] = useState<ProgressByLesson>({})
  const [currentCourseId, setCurrentCourseId] = useState<string | null>(null)
  const [serverStreak, setServerStreak] = useState({ current: 0, longest: 0 })
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
      return
    }
    let cancelled = false
    void (async () => {
      const [doc, entries] = await Promise.all([
        repo.getUser(user.uid),
        Promise.all(
          DATA_STRUCTURES_LESSONS.map(
            async (l) => [l.id, await repo.getProgress(user.uid, l.id)] as const,
          ),
        ),
      ])
      if (cancelled) return
      const next: ProgressByLesson = {}
      for (const [id, p] of entries) if (p) next[id] = p
      setServer(next)
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

  // Overlay the live run for the active lesson so mid-run progress shows at once
  // (and so an anonymous run, which never persists, is still reflected).
  const progressByLesson = useMemo<ProgressByLesson>(() => {
    if (!runModule.hasProgress(runState)) return server
    return { ...server, [runLessonId]: runModule.toProgress(runState) }
  }, [server, runState, runModule, runLessonId])

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

  const value = useMemo<CourseProgressValue>(
    () => ({
      progressByLesson,
      courseProgress,
      currentCourseId,
      streak,
      enterCourse,
      refresh,
    }),
    [
      progressByLesson,
      courseProgress,
      currentCourseId,
      streak,
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
