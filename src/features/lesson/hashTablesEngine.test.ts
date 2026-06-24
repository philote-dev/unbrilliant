import { describe, it, expect } from "vitest"

import type { LessonAction } from "@/features/lesson/engine"
import {
  BIN_QUOTA,
  BUCKET_COUNT,
  HASH_TOTAL_PARTS,
  bucketOf,
  bucketTargetId,
  canCheckHash,
  chainAfter,
  createHashTables,
  currentPartHash,
  hashTablesReducer,
  isCompleteHash,
  keySum,
  legalBuckets,
  letterValue,
  present,
  resumeHashTables,
  searchTrail,
  toProgressHash,
  type HashPart,
  type HashTablesState,
} from "@/features/lesson/hashTablesEngine"

const SEED = 12345

function run(state: HashTablesState, ...actions: LessonAction[]): HashTablesState {
  return actions.reduce(hashTablesReducer, state)
}

/** Drop a key on a bucket (drag beat) then Check. */
function place(state: HashTablesState, bucket: number): HashTablesState {
  return run(
    state,
    { type: "rewire", from: `key:${state.question?.key}`, to: bucketTargetId(bucket) },
    { type: "check" },
  )
}

/** Tap a bucket / pick an option (tap or mcq beat) then Check. */
function pick(state: HashTablesState, id: string): HashTablesState {
  return run(state, { type: "select", letter: id }, { type: "check" })
}

/** Clear the current graded beat correctly and advance to the next part. */
function clearBeat(state: HashTablesState): HashTablesState {
  const q = state.question!
  let s: HashTablesState
  if (q.mode === "drag") s = place(state, q.bucket)
  else s = pick(state, q.answer)
  expect(s.feedback).toBe("correct")
  return run(s, { type: "next" })
}

/** Advance through an intro/teach beat. */
const next = (s: HashTablesState) => run(s, { type: "continue" })

/** Play the whole lesson on the happy path to completion. */
function playToEnd(seed = SEED): HashTablesState {
  let s = createHashTables(seed)
  // Walk every part: continue past intro/teach, clear every graded beat.
  while (!s.completed) {
    const part = currentPartHash(s)
    if (part === "demo" || part === "teach-hash" || part === "teach-collision") {
      s = next(s)
    } else {
      s = clearBeat(s)
    }
  }
  return s
}

describe("hash helpers (pure)", () => {
  it("letterValue is a=1…z=26, case-insensitive", () => {
    expect(letterValue("a")).toBe(1)
    expect(letterValue("z")).toBe(26)
    expect(letterValue("C")).toBe(3)
  })

  it("bucketOf matches the worked-values fixture", () => {
    const expected: Record<string, number> = {
      cat: 4,
      dog: 1,
      sun: 4,
      owl: 0,
      fox: 0,
      ant: 0,
      bee: 2,
      pig: 2,
      elk: 3,
      bat: 3,
      ivy: 1,
    }
    for (const [key, bucket] of Object.entries(expected)) {
      expect(bucketOf(key)).toBe(bucket)
    }
  })

  it("keySum sums letter values; squash lands different sums together", () => {
    expect(keySum("cat")).toBe(24)
    expect(keySum("sun")).toBe(54)
    // 24 and 54 are different sums that squash to the same bucket (the aha).
    expect(bucketOf("cat")).toBe(bucketOf("sun"))
  })

  it("chainAfter appends to the tail", () => {
    expect(chainAfter(["cat"], "sun")).toEqual(["cat", "sun"])
    expect(chainAfter(["owl", "fox"], "ant")).toEqual(["owl", "fox", "ant"])
  })

  it("present checks only the key's own bucket chain", () => {
    expect(present("fox", { 0: ["owl", "fox", "ant"] })).toBe(true)
    expect(present("bat", { 3: ["elk"] })).toBe(false)
  })

  it("searchTrail: a hit reports the chain position as foundIndex", () => {
    const trail = searchTrail("fox", { 0: ["owl", "fox", "ant"] })
    expect(trail.bucket).toBe(bucketOf("fox")) // 0
    expect(trail.chain).toEqual(["owl", "fox", "ant"])
    expect(trail.foundIndex).toBe(1) // fox sits at index 1 of its chain
  })

  it("searchTrail: an absent key returns the full chain and foundIndex -1", () => {
    const trail = searchTrail("bat", { 3: ["elk"] })
    expect(trail.bucket).toBe(bucketOf("bat")) // 3
    expect(trail.chain).toEqual(["elk"]) // every node it would check
    expect(trail.foundIndex).toBe(-1)
  })

  it("searchTrail: an empty bucket yields an empty chain (nothing to check)", () => {
    const trail = searchTrail("cat", {})
    expect(trail.bucket).toBe(bucketOf("cat")) // 4
    expect(trail.chain).toEqual([])
    expect(trail.foundIndex).toBe(-1)
  })
})

describe("flow + structure", () => {
  it("starts at the demo and has 12 parts", () => {
    const s = createHashTables(SEED)
    expect(currentPartHash(s)).toBe<HashPart>("demo")
    expect(HASH_TOTAL_PARTS).toBe(12)
  })

  it("continue only advances on intro/teach beats", () => {
    let s = createHashTables(SEED)
    s = next(s)
    expect(currentPartHash(s)).toBe<HashPart>("teach-hash")
    s = next(s)
    expect(currentPartHash(s)).toBe<HashPart>("hash-cat")
    // continue is a no-op on a graded drag beat
    const stuck = run(s, { type: "continue" })
    expect(currentPartHash(stuck)).toBe<HashPart>("hash-cat")
  })

  it("legalBuckets is every bucket; the surface never gates the drop", () => {
    const s = createHashTables(SEED)
    const legal = legalBuckets(s)
    expect(legal.size).toBe(BUCKET_COUNT)
    for (let i = 0; i < BUCKET_COUNT; i++) {
      expect(legal.has(bucketTargetId(i))).toBe(true)
    }
  })
})

describe("hash bin (locate)", () => {
  function atHashCat(): HashTablesState {
    return next(next(createHashTables(SEED))) // demo → teach-hash → hash-cat
  }

  it("a correct drop into bucket 4 clears the beat and climbs the combo", () => {
    const s = atHashCat()
    expect(canCheckHash(s)).toBe(false) // no drop yet
    const dropped = run(s, { type: "rewire", from: "key:cat", to: bucketTargetId(4) })
    expect(canCheckHash(dropped)).toBe(true)
    const checked = run(dropped, { type: "check" })
    expect(checked.feedback).toBe("correct")
    expect(checked.hashCorrect).toBe(1)
    expect(checked.combo).toBe(1)
  })

  it("a wrong bucket nudges, then fails at the wrong-limit (counter untouched)", () => {
    const s = atHashCat()
    const nudged = place(s, 0) // wrong bucket
    expect(nudged.feedback).toBe("nudge")
    expect(nudged.hashCorrect).toBe(0)
    const failed = place(nudged, 0)
    expect(failed.feedback).toBe("fail")
    expect(failed.combo).toBe(0)
    expect(failed.hashCorrect).toBe(0)
  })

  it("hash-cat-again is a tap-locate to the SAME bucket (determinism)", () => {
    let s = atHashCat()
    s = clearBeat(s) // clear hash-cat → hash-cat-again
    expect(currentPartHash(s)).toBe<HashPart>("hash-cat-again")
    expect(s.question?.mode).toBe("tap")
    expect(s.question?.bucket).toBe(4) // same key → same bucket
    const ok = pick(s, bucketTargetId(4))
    expect(ok.feedback).toBe("correct")
    expect(ok.hashCorrect).toBe(2)
  })
})

describe("collision bin (predict-next-state)", () => {
  function atCollideSun(): HashTablesState {
    let s = createHashTables(SEED)
    while (currentPartHash(s) !== "collide-sun") {
      const part = currentPartHash(s)
      s = part === "demo" || part === "teach-hash" || part === "teach-collision"
        ? next(s)
        : clearBeat(s)
    }
    return s
  }

  it("offers append (correct) + overwrite/reject/probe distractors", () => {
    const s = atCollideSun()
    const ids = s.question!.options.map((o) => o.id).sort()
    expect(ids).toEqual(["append", "overwrite", "probe", "reject"])
    expect(s.question!.answer).toBe("append")
  })

  it("appending the new key to the tail is correct", () => {
    const s = atCollideSun()
    const ok = pick(s, "append")
    expect(ok.feedback).toBe("correct")
    expect(ok.collisionCorrect).toBe(1)
  })

  it("overwrite / reject / probe are all wrong", () => {
    for (const wrong of ["overwrite", "reject", "probe"]) {
      const s = atCollideSun()
      const r = pick(s, wrong)
      expect(r.feedback).toBe("nudge")
      expect(r.collisionCorrect).toBe(0)
    }
  })
})

describe("lookup bin (locate + cost)", () => {
  function atPart(target: HashPart): HashTablesState {
    let s = createHashTables(SEED)
    while (currentPartHash(s) !== target) {
      const part = currentPartHash(s)
      s = part === "demo" || part === "teach-hash" || part === "teach-collision"
        ? next(s)
        : clearBeat(s)
    }
    return s
  }

  it("found: fox is in bucket 0, graded free (1 jump) vs a scales scan", () => {
    const s = atPart("lookup-found")
    expect(s.question?.present).toBe(true)
    expect(s.question?.cost?.word).toBe("free")
    expect(s.question?.scanCost?.word).toBe("scales")
    const ok = pick(s, bucketTargetId(0))
    expect(ok.feedback).toBe("correct")
  })

  it("absent: bat is not in bucket 3, still found-or-not in one jump (free)", () => {
    const s = atPart("lookup-absent")
    expect(s.question?.present).toBe(false)
    expect(s.question?.bucket).toBe(3)
    expect(s.question?.cost?.word).toBe("free")
    const ok = pick(s, bucketTargetId(3))
    expect(ok.feedback).toBe("correct")
  })
})

describe("real-world beat (cloakroom skin)", () => {
  function atRealworld(): HashTablesState {
    let s = createHashTables(SEED)
    while (currentPartHash(s) !== "realworld") {
      const part = currentPartHash(s)
      s =
        part === "demo" || part === "teach-hash" || part === "teach-collision"
          ? next(s)
          : clearBeat(s)
    }
    return s
  }

  it("wears the coatcheck skin but still hashes purely (bucket, answer, free cost)", () => {
    const q = atRealworld().question!
    expect(q.skin).toBe("coatcheck")
    expect(q.mode).toBe("drag")
    // The skin never touches the math: the hook is the pure bucket.
    expect(q.bucket).toBe(bucketOf(q.key!))
    expect(q.answer).toBe(bucketTargetId(q.bucket))
    expect(q.cost?.word).toBe("free")
  })

  it("hanging the coat on its true hook clears the last lookup slot", () => {
    const s = atRealworld()
    const ok = place(s, s.question!.bucket)
    expect(ok.feedback).toBe("correct")
    expect(ok.lookupCorrect).toBe(BIN_QUOTA)
  })

  it("hanging it on the wrong hook does not clear (the skin doesn't grade)", () => {
    const s = atRealworld()
    const wrong = (s.question!.bucket + 1) % BUCKET_COUNT
    const r = place(s, wrong)
    expect(r.feedback).toBe("nudge")
  })
})

describe("gate, completion, determinism, persistence", () => {
  it("clears all 12 beats to a 3/3/3 gate with combo 9", () => {
    const s = playToEnd()
    expect(s.completed).toBe(true)
    expect(isCompleteHash(s)).toBe(true)
    expect(s.hashCorrect).toBe(BIN_QUOTA)
    expect(s.collisionCorrect).toBe(BIN_QUOTA)
    expect(s.lookupCorrect).toBe(BIN_QUOTA)
    expect(s.combo).toBe(9) // nine consecutive correct, flame never broke
  })

  it("is deterministic — same seed yields the same collision option order", () => {
    const a = createHashTables(SEED)
    const b = createHashTables(SEED)
    let sa = a
    let sb = b
    while (currentPartHash(sa) !== "collide-sun") {
      const part = currentPartHash(sa)
      sa = part === "demo" || part === "teach-hash" || part === "teach-collision"
        ? next(sa)
        : clearBeat(sa)
      sb = part === "demo" || part === "teach-hash" || part === "teach-collision"
        ? next(sb)
        : clearBeat(sb)
    }
    expect(sa.question!.options.map((o) => o.id)).toEqual(
      sb.question!.options.map((o) => o.id),
    )
  })

  it("round-trips progress and resumes on the same beat with a cold combo", () => {
    let s = createHashTables(SEED)
    s = next(next(s)) // → hash-cat
    s = clearBeat(s) // hash-cat done → hash-cat-again
    const progress = toProgressHash(s)
    expect(progress.counters.hash).toBe(1)
    expect(progress.currentPart).toBe<HashPart>("hash-cat-again")

    const resumed = resumeHashTables(progress, SEED)
    expect(currentPartHash(resumed)).toBe<HashPart>("hash-cat-again")
    expect(resumed.hashCorrect).toBe(1)
    expect(resumed.combo).toBe(0) // flame is transient — cold on resume
  })

  it("a completed run resumes as completed", () => {
    const done = toProgressHash(playToEnd())
    expect(done.completed).toBe(true)
    expect(resumeHashTables(done, SEED).completed).toBe(true)
  })
})
