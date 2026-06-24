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
  }
}
