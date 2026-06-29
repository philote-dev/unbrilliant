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
import type { ConceptReview } from "@/features/progress/conceptReview"
import type {
  ActivityDay,
  LessonProgress,
  ProgressRepository,
  UserProfile,
} from "@/features/progress/ProgressRepository"
import type {
  DesignArtifact,
  RevisionRecord,
  TrialSaveState,
} from "@/features/trials/saveState"
import type { Position, StructureKind, Verdict } from "@/features/trials/types"

/**
 * Firestore-backed persistence. Schema (signed-in only) — see CONTEXT.md:
 *   users/{uid}                                  displayName, createdAt, updatedAt
 *   users/{uid}/lessonProgress/{lessonId}        counts, currentPart, completed, …
 *   users/{uid}/trialProgress/{trialId}          design slice, verdicts, completed, …
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
  const conceptReviewsCol = (uid: string) =>
    collection(db, "users", uid, "conceptReviews")
  const conceptReviewRef = (uid: string, conceptId: string) =>
    doc(db, "users", uid, "conceptReviews", conceptId)
  const trialProgressCol = (uid: string) =>
    collection(db, "users", uid, "trialProgress")
  const trialProgressRef = (uid: string, trialId: string) =>
    doc(db, "users", uid, "trialProgress", trialId)

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

    async getConceptReviews(uid): Promise<ConceptReview[]> {
      const snap = await getDocs(conceptReviewsCol(uid))
      return snap.docs.map((d) => {
        const x = d.data()
        return {
          conceptId: d.id,
          level: Number(x.level) || 0,
          correctStreak: Number(x.correctStreak) || 0,
          lapses: Number(x.lapses) || 0,
          seen: Number(x.seen) || 0,
          lastSeenAt: Number(x.lastSeenAt) || 0,
          dueAt: Number(x.dueAt) || 0,
          graduated: x.graduated === true,
        }
      })
    },

    async saveConceptReview(uid, review: ConceptReview) {
      await setDoc(
        conceptReviewRef(uid, review.conceptId),
        {
          level: review.level,
          correctStreak: review.correctStreak,
          lapses: review.lapses,
          seen: review.seen,
          lastSeenAt: review.lastSeenAt,
          dueAt: review.dueAt,
          graduated: review.graduated,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    },

    async getTrialProgress(uid, trialId): Promise<TrialSaveState | null> {
      const snap = await getDoc(trialProgressRef(uid, trialId))
      if (!snap.exists()) return null
      const d = snap.data()
      // Self-owned doc: coerce defensively so a hand-edited value degrades to a
      // sane default rather than poisoning the run on resume. The doc id is the
      // source of truth for the trial id.
      return {
        trialId,
        missionId: typeof d.missionId === "string" ? d.missionId : "",
        segmentId: typeof d.segmentId === "string" ? d.segmentId : "",
        unlockedSegments: Array.isArray(d.unlockedSegments) ? d.unlockedSegments : [],
        chosenStructures: (d.chosenStructures ?? {}) as Record<string, StructureKind>,
        operationMappings: (d.operationMappings ?? {}) as Record<string, Position>,
        policyChoices: (d.policyChoices ?? {}) as Record<string, string>,
        verdicts: (d.verdicts ?? {}) as Record<string, Verdict>,
        revisionHistory: Array.isArray(d.revisionHistory)
          ? (d.revisionHistory as RevisionRecord[])
          : [],
        nudgesShown: Array.isArray(d.nudgesShown) ? d.nudgesShown : [],
        stressTestsRun: Array.isArray(d.stressTestsRun) ? d.stressTestsRun : [],
        ...(d.missionAArtifact
          ? { missionAArtifact: d.missionAArtifact as DesignArtifact }
          : {}),
        ...(d.missionBArtifact
          ? { missionBArtifact: d.missionBArtifact as DesignArtifact }
          : {}),
        completed: d.completed === true,
        // Default a missing flag to clean (matches emptySave) rather than to false.
        cleanPass: d.cleanPass !== false,
      }
    },

    async saveTrialProgress(uid, trialId, slice: TrialSaveState) {
      await setDoc(
        trialProgressRef(uid, trialId),
        {
          missionId: slice.missionId,
          segmentId: slice.segmentId,
          unlockedSegments: slice.unlockedSegments,
          chosenStructures: slice.chosenStructures,
          operationMappings: slice.operationMappings,
          policyChoices: slice.policyChoices,
          verdicts: slice.verdicts,
          revisionHistory: slice.revisionHistory,
          nudgesShown: slice.nudgesShown,
          stressTestsRun: slice.stressTestsRun,
          // Omit the optional artifacts when absent: Firestore rejects undefined.
          ...(slice.missionAArtifact
            ? { missionAArtifact: slice.missionAArtifact }
            : {}),
          ...(slice.missionBArtifact
            ? { missionBArtifact: slice.missionBArtifact }
            : {}),
          completed: slice.completed,
          cleanPass: slice.cleanPass,
          completedAt: slice.completed ? serverTimestamp() : null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    },

    async listCompletedTrials(uid): Promise<string[]> {
      const snap = await getDocs(
        query(trialProgressCol(uid), where("completed", "==", true)),
      )
      return snap.docs.map((d) => d.id)
    },
  }
}
