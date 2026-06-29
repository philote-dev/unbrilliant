import { readFileSync } from "node:fs"

import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing"
import type { Firestore } from "firebase/firestore"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { doc, setDoc, type Firestore as FirestoreClient } from "firebase/firestore"

import { createFirestoreProgressRepository } from "@/features/progress/firestoreProgressRepository"
import { dayKeyToUTCDate } from "@/features/progress/activityDate"
import type { LessonProgress } from "@/features/progress/ProgressRepository"
import { emptySave, type TrialSaveState } from "@/features/trials/saveState"
import {
  DATA_STRUCTURES_LESSONS,
  deriveCourseProgress,
  derivePathNodes,
  type ProgressByLesson,
} from "@/lessons/catalog"
import { lessonStats } from "@/features/progress/analytics"

async function progressMapFor(
  repo: ReturnType<typeof createFirestoreProgressRepository>,
  uid: string,
): Promise<ProgressByLesson> {
  const entries = await Promise.all(
    DATA_STRUCTURES_LESSONS.map(
      async (l) => [l.id, await repo.getProgress(uid, l.id)] as const,
    ),
  )
  const map: ProgressByLesson = {}
  for (const [id, p] of entries) if (p) map[id] = p
  return map
}

/**
 * Persistence-seam integration tests against the Firestore emulator — exercised
 * THROUGH the ProgressRepository interface (never Firestore internals), as the
 * app uses it. Run via `npm run test:emulator` (wraps these in emulators:exec).
 */
const PROJECT_ID = "demo-willow"
const LESSON = "stacks-and-queues"
const TRIAL = "trial-1-linear"

let testEnv: RulesTestEnvironment

function repoFor(uid: string) {
  const db = testEnv
    .authenticatedContext(uid)
    .firestore() as unknown as Firestore
  return createFirestoreProgressRepository(db)
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      // RULES_PATH / FIRESTORE_EMULATOR_PORT let this run against an isolated
      // emulator (CI or a dev box already running one on the default ports).
      rules: readFileSync(process.env.RULES_PATH ?? "firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: Number(process.env.FIRESTORE_EMULATOR_PORT) || 8080,
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

describe("FirestoreProgressRepository (emulator)", () => {
  it("returns null before any progress is saved", async () => {
    const repo = repoFor("alice")
    expect(await repo.getProgress("alice", LESSON)).toBeNull()
  })

  it("persists progress and reads it back", async () => {
    const repo = repoFor("alice")
    await repo.ensureUser("alice", { displayName: "Alice" })
    const progress: LessonProgress = {
      counters: { pops: 3, dequeues: 1, scenarios: 0 },
      currentPart: "queue-dequeue",
      completed: false,
    }
    await repo.saveProgress("alice", LESSON, progress)
    expect(await repo.getProgress("alice", LESSON)).toEqual(progress)
  })

  it("round-trips the redesigned S&Q counters on a mid-lesson beat", async () => {
    const repo = repoFor("nina")
    await repo.ensureUser("nina", { displayName: "Nina" })
    const progress: LessonProgress = {
      counters: {
        stackPredict: 1,
        stackRealworld: 1,
        stackConstruct: 1,
        queuePredict: 0,
        queueRealworld: 0,
        queueConstruct: 0,
        classify: 0,
        contrast: 0,
        attempts: 5,
      },
      currentPart: "queue-predict",
      completed: false,
    }
    await repo.saveProgress("nina", LESSON, progress)
    expect(await repo.getProgress("nina", LESSON)).toEqual(progress)
  })

  it("round-trips the redesigned Arrays counters on a mid-lesson beat and resumes there", async () => {
    const repo = repoFor("ada")
    await repo.ensureUser("ada", { displayName: "Ada" })
    const progress: LessonProgress = {
      counters: {
        a1: 1,
        a3: 1,
        a2: 0,
        a2Skin: 0,
        a4: 0,
        a5: 0,
        a6Grow: 0,
        a6Cheap: 0,
        attempts: 4,
      },
      currentPart: "a2-shift",
      completed: false,
    }
    await repo.saveProgress("ada", "arrays", progress)
    expect(await repo.getProgress("ada", "arrays")).toEqual(progress)
    // A fresh handle (page reload) resumes on the same beat with the same counts.
    const resumed = await repoFor("ada").getProgress("ada", "arrays")
    expect(resumed?.currentPart).toBe("a2-shift")
    expect(resumed?.counters.a3).toBe(1)
  })

  it("round-trips the Linked Lists counters on a mid-lesson beat and resumes there", async () => {
    const repo = repoFor("liam")
    await repo.ensureUser("liam", { displayName: "Liam" })
    const progress: LessonProgress = {
      counters: {
        traverse: 1,
        insert: 1,
        delete: 0,
        predict: 0,
        playlist: 0,
        contrastInsert: 0,
        contrastReach: 0,
        attempts: 4,
      },
      currentPart: "rewire-delete",
      completed: false,
    }
    await repo.saveProgress("liam", "linked-lists", progress)
    expect(await repo.getProgress("liam", "linked-lists")).toEqual(progress)
    // A fresh handle (page reload) resumes on the same beat with the same counts.
    const resumed = await repoFor("liam").getProgress("liam", "linked-lists")
    expect(resumed?.currentPart).toBe("rewire-delete")
    expect(resumed?.counters.insert).toBe(1)
  })

  it("round-trips the Hash Tables counters on a mid-lesson beat and resumes there", async () => {
    const repo = repoFor("hana")
    await repo.ensureUser("hana", { displayName: "Hana" })
    const progress: LessonProgress = {
      counters: { hash: 3, collision: 1, lookup: 0, attempts: 6 },
      currentPart: "collide-ant",
      completed: false,
    }
    await repo.saveProgress("hana", "hash-tables", progress)
    expect(await repo.getProgress("hana", "hash-tables")).toEqual(progress)
    // A fresh handle (page reload) resumes on the same beat with the same counts.
    const resumed = await repoFor("hana").getProgress("hana", "hash-tables")
    expect(resumed?.currentPart).toBe("collide-ant")
    expect(resumed?.counters.hash).toBe(3)
  })

  it("round-trips the Trees counters on a mid-lesson beat and resumes there", async () => {
    const repo = repoFor("tess")
    await repo.ensureUser("tess", { displayName: "Tess" })
    const progress: LessonProgress = {
      counters: { locate: 2, sequence: 1, comparison: 0, attempts: 5 },
      currentPart: "sequence-a",
      completed: false,
    }
    await repo.saveProgress("tess", "trees", progress)
    expect(await repo.getProgress("tess", "trees")).toEqual(progress)
    const resumed = await repoFor("tess").getProgress("tess", "trees")
    expect(resumed?.currentPart).toBe("sequence-a")
    expect(resumed?.counters.locate).toBe(2)
  })

  it("round-trips the Heaps counters on a mid-lesson beat and resumes there", async () => {
    const repo = repoFor("hugo")
    await repo.ensureUser("hugo", { displayName: "Hugo" })
    const progress: LessonProgress = {
      counters: { siftUp: 2, siftDown: 1, mapping: 0, contrast: 0, attempts: 5 },
      currentPart: "siftdown-2",
      completed: false,
    }
    await repo.saveProgress("hugo", "heaps", progress)
    expect(await repo.getProgress("hugo", "heaps")).toEqual(progress)
    const resumed = await repoFor("hugo").getProgress("hugo", "heaps")
    expect(resumed?.currentPart).toBe("siftdown-2")
    expect(resumed?.counters.siftUp).toBe(2)
  })

  it("round-trips the Graphs counters on a mid-lesson beat and resumes there", async () => {
    const repo = repoFor("gwen")
    await repo.ensureUser("gwen", { displayName: "Gwen" })
    const progress: LessonProgress = {
      counters: { read: 4, draw: 0, same: 0, attempts: 6 },
      currentPart: "draw-edge",
      completed: false,
    }
    await repo.saveProgress("gwen", "graphs", progress)
    expect(await repo.getProgress("gwen", "graphs")).toEqual(progress)
    const resumed = await repoFor("gwen").getProgress("gwen", "graphs")
    expect(resumed?.currentPart).toBe("draw-edge")
    expect(resumed?.counters.read).toBe(4)
  })

  it("survives a reload and resumes on the same part", async () => {
    await repoFor("bob").saveProgress("bob", LESSON, {
      counters: { pops: 3, dequeues: 3, scenarios: 2 },
      currentPart: "scenario",
      completed: false,
    })
    // A fresh handle (simulating a page reload) reads back server state.
    const resumed = await repoFor("bob").getProgress("bob", LESSON)
    expect(resumed?.currentPart).toBe("scenario")
    expect(resumed?.counters.scenarios).toBe(2)
    expect(resumed?.completed).toBe(false)
  })

  it("carries an in-flight run up to a brand-new account", async () => {
    const repo = repoFor("carol")
    expect(await repo.getProgress("carol", LESSON)).toBeNull() // brand-new
    await repo.ensureUser("carol", { displayName: "Carol" })
    await repo.saveProgress("carol", LESSON, {
      counters: { pops: 2, dequeues: 0, scenarios: 0 },
      currentPart: "stack-pop",
      completed: false,
    })
    expect((await repo.getProgress("carol", LESSON))?.counters.pops).toBe(2)
  })

  it("records completion", async () => {
    await repoFor("dave").saveProgress("dave", LESSON, {
      counters: { pops: 3, dequeues: 3, scenarios: 4 },
      currentPart: "scenario",
      completed: true,
    })
    expect((await repoFor("dave").getProgress("dave", LESSON))?.completed).toBe(
      true,
    )
  })

  it("derives real course progress from completed lessons", async () => {
    const repo = repoFor("erin")
    await repo.saveProgress("erin", LESSON, {
      counters: { pops: 3, dequeues: 3, scenarios: 4 },
      currentPart: "scenario",
      completed: true,
    })
    const map = await progressMapFor(repo, "erin")
    expect(deriveCourseProgress("data-structures", map)).toBe(
      Math.round((1 / DATA_STRUCTURES_LESSONS.length) * 100),
    )
  })

  it("completing Stacks & Queues persists the Arrays unlock (derived)", async () => {
    const repo = repoFor("grace")
    // Before: Arrays is locked.
    expect(
      derivePathNodes(await progressMapFor(repo, "grace")).find(
        (n) => n.id === "arrays",
      )?.state,
    ).toBe("locked")
    // Complete Intro (the first path node) and S&Q...
    await repo.saveProgress("grace", "intro", {
      counters: {},
      currentPart: "done",
      completed: true,
    })
    await repo.saveProgress("grace", LESSON, {
      counters: { pops: 3, dequeues: 3, scenarios: 4 },
      currentPart: "scenario",
      completed: true,
    })
    // ...and a fresh read shows Arrays unlocked (current).
    expect(
      derivePathNodes(await progressMapFor(repo, "grace")).find(
        (n) => n.id === "arrays",
      )?.state,
    ).toBe("current")
  })

  it("the progress drill-down reflects persisted per-lesson stats", async () => {
    const repo = repoFor("ivan")
    await repo.saveProgress("ivan", LESSON, {
      counters: { pops: 3, dequeues: 3, scenarios: 4, attempts: 12 },
      currentPart: "scenario",
      completed: true,
    })
    const stats = lessonStats(LESSON, (await repo.getProgress("ivan", LESSON)) ?? undefined)
    expect(stats.completed).toBe(true)
    expect(stats.correct).toBe(10)
    expect(stats.attempted).toBe(12)
    expect(stats.mastery).toBe(1)
  })

  it("persists the on-fire streak and preserves the best across a reset", async () => {
    const repo = repoFor("heidi")
    await repo.ensureUser("heidi", { displayName: "Heidi" })
    expect((await repo.getUser("heidi"))?.streak).toEqual({
      current: 0,
      longest: 0,
    })
    await repo.updateUser("heidi", { streak: { current: 5, longest: 5 } })
    expect((await repo.getUser("heidi"))?.streak).toEqual({
      current: 5,
      longest: 5,
    })
    // The chosen cross-session rule: a full fail resets `current`, but the
    // all-time `longest` is preserved (and "sign in to save your streak" honest).
    await repo.updateUser("heidi", { streak: { current: 0, longest: 5 } })
    expect((await repo.getUser("heidi"))?.streak).toEqual({
      current: 0,
      longest: 5,
    })
  })

  it("persists and reads the user's current course", async () => {
    const repo = repoFor("frank")
    await repo.ensureUser("frank", { displayName: "Frank" })
    expect((await repo.getUser("frank"))?.currentCourseId).toBeNull()
    await repo.updateUser("frank", { currentCourseId: "data-structures" })
    expect((await repo.getUser("frank"))?.currentCourseId).toBe(
      "data-structures",
    )
  })

  it("denies reading another learner's progress", async () => {
    await repoFor("alice").saveProgress("alice", LESSON, {
      counters: { pops: 1, dequeues: 0, scenarios: 0 },
      currentPart: "stack-pop",
      completed: false,
    })
    const mallory = createFirestoreProgressRepository(
      testEnv.authenticatedContext("mallory").firestore() as unknown as Firestore,
    )
    await assertFails(mallory.getProgress("alice", LESSON))
  })

  it("accumulates same-day activity via atomic increments and reads it back", async () => {
    const repo = repoFor("nora")
    await repo.recordActivity("nora", "20260114", { attempted: 3, correct: 2 })
    await repo.recordActivity("nora", "20260114", { attempted: 1, correct: 1 })
    expect(await repo.getActivity("nora", "20260101")).toEqual([
      { date: dayKeyToUTCDate("20260114"), attempted: 4, correct: 3 },
    ])
  })

  it("returns activity on/after the since key, ascending by day", async () => {
    const repo = repoFor("omar")
    await repo.recordActivity("omar", "20260103", { attempted: 2, correct: 2 })
    await repo.recordActivity("omar", "20260120", { attempted: 1, correct: 0 })
    await repo.recordActivity("omar", "20260114", { attempted: 5, correct: 4 })
    const dates = (await repo.getActivity("omar", "20260112")).map((d) => d.date)
    expect(dates).toEqual([
      dayKeyToUTCDate("20260114"),
      dayKeyToUTCDate("20260120"),
    ])
  })

  it("denies reading another learner's activity", async () => {
    await repoFor("alice").recordActivity("alice", "20260114", {
      attempted: 1,
      correct: 1,
    })
    const mallory = createFirestoreProgressRepository(
      testEnv.authenticatedContext("mallory").firestore() as unknown as Firestore,
    )
    await assertFails(mallory.getActivity("alice", "20260101"))
  })

  // Raw writes (bypassing the repo) prove the rules reject malformed activity,
  // not just that the repo happens to send well-formed payloads.
  function activityDoc(uid: string, dayKey: string) {
    const db = testEnv
      .authenticatedContext(uid)
      .firestore() as unknown as FirestoreClient
    return doc(db, "users", uid, "activity", dayKey)
  }

  it("rejects an activity write with more correct than attempted", async () => {
    await assertFails(
      setDoc(activityDoc("pat", "20260114"), {
        date: dayKeyToUTCDate("20260114"),
        attempted: 1,
        correct: 5,
        updatedAt: 0,
      }),
    )
  })

  it("rejects an activity write with a negative count", async () => {
    // attempted stays valid so only the `correct >= 0` clause is exercised.
    await assertFails(
      setDoc(activityDoc("pat", "20260114"), {
        date: dayKeyToUTCDate("20260114"),
        attempted: 5,
        correct: -3,
        updatedAt: 0,
      }),
    )
  })

  it("rejects an activity write with an unexpected field", async () => {
    await assertFails(
      setDoc(activityDoc("pat", "20260114"), {
        date: dayKeyToUTCDate("20260114"),
        attempted: 2,
        correct: 1,
        updatedAt: 0,
        hacked: true,
      }),
    )
  })

  // Raw writes proving the tightened lessonProgress / user validation holds even
  // when the repo is bypassed.
  function lessonProgressDoc(uid: string, lessonId: string) {
    const db = testEnv
      .authenticatedContext(uid)
      .firestore() as unknown as FirestoreClient
    return doc(db, "users", uid, "lessonProgress", lessonId)
  }

  function userDoc(uid: string) {
    const db = testEnv
      .authenticatedContext(uid)
      .firestore() as unknown as FirestoreClient
    return doc(db, "users", uid)
  }

  it("rejects a lessonProgress write with an unexpected field", async () => {
    await assertFails(
      setDoc(lessonProgressDoc("pat", LESSON), {
        counters: { pops: 1 },
        currentPart: "stack-pop",
        completed: false,
        completedAt: null,
        updatedAt: new Date(),
        hacked: true,
      }),
    )
  })

  it("rejects a user write with an oversized displayName", async () => {
    await assertFails(
      setDoc(userDoc("pat"), { displayName: "z".repeat(300), updatedAt: new Date() }),
    )
  })

  it("rejects a user write with an injected field", async () => {
    await assertFails(
      setDoc(userDoc("pat"), { displayName: "Pat", isAdmin: true, updatedAt: new Date() }),
    )
  })

  // --- Trial durable slice (users/{uid}/trialProgress/{trialId}) ---

  it("returns null before any Trial progress is saved", async () => {
    const repo = repoFor("tara")
    expect(await repo.getTrialProgress("tara", TRIAL)).toBeNull()
  })

  it("round-trips a Trial design slice and resumes there", async () => {
    const repo = repoFor("tara")
    await repo.ensureUser("tara", { displayName: "Tara" })
    const slice: TrialSaveState = {
      trialId: TRIAL,
      missionId: "mission-a",
      segmentId: "seg-2",
      unlockedSegments: ["seg-1", "seg-2"],
      chosenStructures: { "seg-1": "stack", "seg-2": "queue" },
      operationMappings: { enqueue: "back", dequeue: "front" },
      policyChoices: { eviction: "lru" },
      verdicts: { "seg-1": "viable" },
      revisionHistory: [
        {
          segmentId: "seg-1",
          at: 1234,
          from: { structure: "array", mapping: { enqueue: "back" } },
          to: { structure: "stack", mapping: { enqueue: "top" } },
        },
      ],
      nudgesShown: ["nudge-1"],
      stressTestsRun: ["burst"],
      missionAArtifact: {
        structure: "stack",
        mapping: { enqueue: "top" },
        policy: { eviction: "lru" },
      },
      completed: false,
      cleanPass: true,
    }
    await repo.saveTrialProgress("tara", TRIAL, slice)
    expect(await repo.getTrialProgress("tara", TRIAL)).toEqual(slice)
    // A fresh handle (page reload) resumes on the same segment with the same slice.
    const resumed = await repoFor("tara").getTrialProgress("tara", TRIAL)
    expect(resumed?.segmentId).toBe("seg-2")
    expect(resumed?.chosenStructures["seg-2"]).toBe("queue")
  })

  it("lists only the Trials marked completed", async () => {
    const repo = repoFor("vic")
    await repo.ensureUser("vic", { displayName: "Vic" })
    await repo.saveTrialProgress("vic", "trial-1-linear", {
      ...emptySave("trial-1-linear", "mission-a", "seg-1"),
      completed: true,
    })
    await repo.saveTrialProgress("vic", "trial-2-extra", {
      ...emptySave("trial-2-extra", "mission-a", "seg-1"),
      completed: true,
    })
    await repo.saveTrialProgress("vic", "trial-3-wip", {
      ...emptySave("trial-3-wip", "mission-a", "seg-1"),
      completed: false,
    })
    expect((await repo.listCompletedTrials("vic")).sort()).toEqual([
      "trial-1-linear",
      "trial-2-extra",
    ])
  })

  it("denies reading or writing another learner's Trial progress", async () => {
    await repoFor("alice").saveTrialProgress(
      "alice",
      TRIAL,
      emptySave(TRIAL, "mission-a", "seg-1"),
    )
    const mallory = createFirestoreProgressRepository(
      testEnv.authenticatedContext("mallory").firestore() as unknown as Firestore,
    )
    await assertFails(mallory.getTrialProgress("alice", TRIAL))
    await assertFails(
      mallory.saveTrialProgress("alice", TRIAL, emptySave(TRIAL, "mission-a", "seg-1")),
    )
  })

  // Raw write (bypassing the repo) proving the rules reject a malformed trial
  // slice, not just that the repo happens to send a well-formed payload.
  function trialProgressDoc(uid: string, trialId: string) {
    const db = testEnv
      .authenticatedContext(uid)
      .firestore() as unknown as FirestoreClient
    return doc(db, "users", uid, "trialProgress", trialId)
  }

  it("rejects a trialProgress write with an unexpected field", async () => {
    await assertFails(
      setDoc(trialProgressDoc("pat", TRIAL), {
        missionId: "mission-a",
        segmentId: "seg-1",
        unlockedSegments: ["seg-1"],
        chosenStructures: {},
        operationMappings: {},
        policyChoices: {},
        verdicts: {},
        revisionHistory: [],
        nudgesShown: [],
        stressTestsRun: [],
        completed: false,
        cleanPass: true,
        completedAt: null,
        updatedAt: new Date(),
        hacked: true,
      }),
    )
  })
})
