import type { LessonProgress } from "@/features/lesson/engine"

/**
 * The persistence boundary. The app reads/writes learner progress through this
 * interface — never Firestore directly — so the engine and UI can be tested with
 * an in-memory fake and the real Firestore impl is swapped in at runtime.
 * (The "on fire" streak is a transient in-run effect and is NOT persisted.)
 *
 * `LessonProgress` (the durable slice) is owned by the engine and re-exported
 * here so callers import the persisted shape from the boundary.
 */
export type { LessonProgress }

export interface UserProfile {
  displayName: string
}

/** The persisted "on fire" streak: the live count and the all-time best. */
export interface Streak {
  current: number
  longest: number
}

/** The persisted user document (signed-in only). */
export interface UserDoc {
  displayName: string
  currentCourseId: string | null
  streak: Streak
}

/** A partial, merge-applied update to the user document. */
export interface UserUpdate {
  currentCourseId?: string | null
  streak?: Streak
}

/**
 * One local day of answer activity. `date` is the UTC-midnight epoch ms encoding
 * the bucketed local day (so the contribution calendar's UTC-based rendering
 * shows the right day in any timezone); counts are non-negative integers.
 */
export interface ActivityDay {
  date: number
  attempted: number
  correct: number
}

export interface ProgressRepository {
  /** Create the user doc once (on first sign-in); refresh displayName/updatedAt. */
  ensureUser(uid: string, profile: UserProfile): Promise<void>
  /** The persisted user document, or null if it doesn't exist yet. */
  getUser(uid: string): Promise<UserDoc | null>
  /** Merge-update fields on the user document (e.g. currentCourseId). */
  updateUser(uid: string, patch: UserUpdate): Promise<void>
  /** Latest persisted progress for a lesson, or null if none yet. */
  getProgress(uid: string, lessonId: string): Promise<LessonProgress | null>
  /** Upsert progress for a lesson (optimistic — callers fire-and-forget). */
  saveProgress(
    uid: string,
    lessonId: string,
    progress: LessonProgress,
  ): Promise<void>
  /** Add a day's answer activity (atomic increment; optimistic, fire-and-forget). */
  recordActivity(
    uid: string,
    dayKey: string,
    delta: { attempted: number; correct: number },
  ): Promise<void>
  /** Days with activity on/after `sinceDayKey` (yyyymmdd), ascending by date. */
  getActivity(uid: string, sinceDayKey: string): Promise<ActivityDay[]>
}
