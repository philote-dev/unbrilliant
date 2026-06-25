import { dayKeyToUTCDate } from "@/features/progress/activityDate"
import type {
  LessonProgress,
  ProgressRepository,
  UserDoc,
} from "@/features/progress/ProgressRepository"

/**
 * In-memory fake of the persistence boundary — for engine/unit tests, with no
 * browser or Firebase. Behaves like the Firestore impl from the caller's view.
 */
export function createInMemoryProgressRepository(): ProgressRepository {
  const progress = new Map<string, LessonProgress>()
  const users = new Map<string, UserDoc>()
  const activity = new Map<string, Map<string, { attempted: number; correct: number }>>()
  const key = (uid: string, lessonId: string) => `${uid}::${lessonId}`

  return {
    async ensureUser(uid, profile) {
      const prev = users.get(uid)
      users.set(uid, {
        currentCourseId: null,
        streak: { current: 0, longest: 0 },
        ...prev,
        displayName: profile.displayName,
      })
    },
    async getUser(uid) {
      const u = users.get(uid)
      return u ? { ...u, streak: { ...u.streak } } : null
    },
    async updateUser(uid, patch) {
      const prev = users.get(uid) ?? {
        displayName: "",
        currentCourseId: null,
        streak: { current: 0, longest: 0 },
      }
      users.set(uid, { ...prev, ...patch })
    },
    async getProgress(uid, lessonId) {
      const found = progress.get(key(uid, lessonId))
      return found ? { ...found } : null
    },
    async saveProgress(uid, lessonId, p) {
      progress.set(key(uid, lessonId), { ...p })
    },
    async recordActivity(uid, dayKey, delta) {
      let days = activity.get(uid)
      if (!days) {
        days = new Map()
        activity.set(uid, days)
      }
      const prev = days.get(dayKey) ?? { attempted: 0, correct: 0 }
      days.set(dayKey, {
        attempted: prev.attempted + delta.attempted,
        correct: prev.correct + delta.correct,
      })
    },
    async getActivity(uid, sinceDayKey) {
      const days = activity.get(uid)
      if (!days) return []
      // Fixed-width yyyymmdd keys sort lexicographically == chronologically.
      return [...days.entries()]
        .filter(([dayKey]) => dayKey >= sinceDayKey)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([dayKey, v]) => ({
          date: dayKeyToUTCDate(dayKey),
          attempted: v.attempted,
          correct: v.correct,
        }))
    },
  }
}
