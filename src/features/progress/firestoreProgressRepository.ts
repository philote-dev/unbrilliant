import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
} from "firebase/firestore"

import { dayKeyToUTCDate } from "@/features/progress/activityDate"
import type {
  ActivityDay,
  LessonProgress,
  ProgressRepository,
  UserProfile,
} from "@/features/progress/ProgressRepository"

/**
 * Firestore-backed persistence. Schema (signed-in only) — see CONTEXT.md:
 *   users/{uid}                                  displayName, createdAt, updatedAt
 *   users/{uid}/lessonProgress/{lessonId}        counts, currentPart, completed, …
 */
/**
 * Upper bound on activity docs read in one call. A little over a year so the
 * 365-day calendar window is fully covered, while capping a learner's own read
 * volume even if they somehow accumulate far more (e.g. future-dated) docs.
 */
const MAX_ACTIVITY_DAYS = 400

export function createFirestoreProgressRepository(
  db: Firestore,
): ProgressRepository {
  const userRef = (uid: string) => doc(db, "users", uid)
  const progressRef = (uid: string, lessonId: string) =>
    doc(db, "users", uid, "lessonProgress", lessonId)
  const activityCol = (uid: string) => collection(db, "users", uid, "activity")
  const activityRef = (uid: string, dayKey: string) =>
    doc(db, "users", uid, "activity", dayKey)

  return {
    async ensureUser(uid, profile: UserProfile) {
      const snap = await getDoc(userRef(uid))
      if (snap.exists()) {
        await setDoc(
          userRef(uid),
          { displayName: profile.displayName, updatedAt: serverTimestamp() },
          { merge: true },
        )
      } else {
        await setDoc(userRef(uid), {
          displayName: profile.displayName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
    },

    async getUser(uid) {
      const snap = await getDoc(userRef(uid))
      if (!snap.exists()) return null
      const d = snap.data()
      return {
        displayName: d.displayName ?? "",
        currentCourseId: d.currentCourseId ?? null,
        streak: {
          current: d.streak?.current ?? 0,
          longest: d.streak?.longest ?? 0,
        },
      }
    },

    async updateUser(uid, patch) {
      await setDoc(
        userRef(uid),
        { ...patch, updatedAt: serverTimestamp() },
        { merge: true },
      )
    },

    async getProgress(uid, lessonId) {
      const snap = await getDoc(progressRef(uid, lessonId))
      if (!snap.exists()) return null
      const d = snap.data()
      // Read the lesson-shaped counters map, falling back to proto-1's fixed
      // top-level fields for any pre-counters docs.
      const counters: Record<string, number> = d.counters ?? {
        pops: d.popsCorrect ?? 0,
        dequeues: d.dequeuesCorrect ?? 0,
        scenarios: d.scenariosCorrect ?? 0,
      }
      return {
        counters,
        currentPart: d.currentPart ?? "stack-build",
        completed: d.completed ?? false,
      }
    },

    async saveProgress(uid, lessonId, p: LessonProgress) {
      await setDoc(
        progressRef(uid, lessonId),
        {
          counters: p.counters,
          currentPart: p.currentPart,
          completed: p.completed,
          completedAt: p.completed ? serverTimestamp() : null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    },

    async recordActivity(uid, dayKey, delta) {
      await setDoc(
        activityRef(uid, dayKey),
        {
          date: dayKeyToUTCDate(dayKey),
          attempted: increment(delta.attempted),
          correct: increment(delta.correct),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    },

    async getActivity(uid, sinceDayKey): Promise<ActivityDay[]> {
      const snap = await getDocs(
        query(
          activityCol(uid),
          where(documentId(), ">=", sinceDayKey),
          orderBy(documentId()),
          limit(MAX_ACTIVITY_DAYS),
        ),
      )
      // Coerce counts defensively: the docs are self-owned, so a hand-edited
      // non-numeric value must degrade to 0 rather than poison arithmetic.
      return snap.docs.map((d) => {
        const data = d.data()
        return {
          date: typeof data.date === "number" ? data.date : dayKeyToUTCDate(d.id),
          attempted: Number(data.attempted) || 0,
          correct: Number(data.correct) || 0,
        }
      })
    },
  }
}
