import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore"

import type {
  LessonProgress,
  ProgressRepository,
  UserProfile,
} from "@/features/progress/ProgressRepository"

/**
 * Firestore-backed persistence. Schema (signed-in only) — see docs/prototype.md:
 *   users/{uid}                                  displayName, createdAt, updatedAt
 *   users/{uid}/lessonProgress/{lessonId}        counts, currentPart, completed, …
 */
export function createFirestoreProgressRepository(
  db: Firestore,
): ProgressRepository {
  const userRef = (uid: string) => doc(db, "users", uid)
  const progressRef = (uid: string, lessonId: string) =>
    doc(db, "users", uid, "lessonProgress", lessonId)

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
  }
}
