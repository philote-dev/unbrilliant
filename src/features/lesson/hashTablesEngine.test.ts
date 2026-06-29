import { describe, it, expect } from "vitest"

import type { LessonAction } from "@/features/lesson/engine"
import {
  BIN_QUOTA,
  BUCKET_COUNT,
  DESIGN_QUOTA,
  GATE_TOTAL,
  HASH_TOTAL_PARTS,
  bucketForRule,
  bucketOf,
  bucketTargetId,
  canCheckHash,
  chainAfter,
  collisionCount,
  combineValue,
  createHashTables,
  currentPartHash,
  designDistribution,
  designSpreads,
  distribute,
  hashTablesReducer,
  isCompleteHash,
  isIntroPart,
  keySum,
  legalBuckets,
  letterValue,
  placementFrames,
  present,
  resumeHashTables,
  searchTrail,
  toProgressHash,
  type CombineRule,
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

/** Pick a combine rule + bucket count (design beat) then Check. */
function design(
  state: HashTablesState,
  rule: CombineRule,
  buckets: number,
): HashTablesState {
  return run(
    state,
    { type: "select", letter: `rule:${rule}` },
    { type: "select", letter: `buckets:${buckets}` },
    { type: "check" },
  )
}

/** Clear the current graded beat correctly and advance to the next part. */
function clearBeat(state: HashTablesState): HashTablesState {
  const q = state.question!
  let s: HashTablesState
  // sum + 5 buckets spreads the design challenge keys (cat, cap, dog, fig).
  if (q.mode === "design") s = design(state, "sum", 5)
  else if (q.mode === "drag") s = place(state, q.bucket)
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
    s = isIntroPart(currentPartHash(s)) ? next(s) : clearBeat(s)
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

describe("hash-builder model (rule is a choice)", () => {
  it("combineValue reads sum / first-letter / length", () => {
    expect(combineValue("sum", "cat")).toBe(24) // 3 + 1 + 20
    expect(combineValue("first", "cat")).toBe(letterValue("c")) // 3
    expect(combineValue("length", "cat")).toBe(3)
  })

  it("bucketForRule mods by the bucket count and is non-negative", () => {
    expect(bucketForRule("sum", "cat", 5)).toBe(bucketOf("cat", 5)) // sum rule == bucketOf
    expect(bucketForRule("length", "cat", 4)).toBe(3) // 3 mod 4
    expect(bucketForRule("first", "dog", 5)).toBe(letterValue("d") % 5) // 4
  })

  it("distribute appends colliding keys to the tail, in input order", () => {
    // length ignores the letters, so three length-3 keys pile into one bin.
    expect(distribute("length", 5, ["cat", "dog", "owl"])).toEqual({ 3: ["cat", "dog", "owl"] })
  })

  it("collisionCount is total keys minus occupied buckets (0 when perfectly spread)", () => {
    expect(collisionCount({ 0: ["a"], 1: ["b"], 2: ["c"] })).toBe(0)
    expect(collisionCount({ 3: ["cat", "dog", "owl"] })).toBe(2)
    expect(collisionCount({ 0: ["a", "b"], 1: ["c", "d"] })).toBe(2)
  })

  it("designSpreads: only a whole-key rule separates cat/cap; first-letter never does", () => {
    const keys = ["cat", "cap", "dog", "fig"]
    // First-letter ignores the rest, so cat and cap collide at every bucket count.
    for (const b of [4, 5, 6, 7]) expect(designSpreads("first", b, keys)).toBe(false)
    // Length ignores the letters entirely (all length 3), so everything collides.
    for (const b of [4, 5, 6, 7]) expect(designSpreads("length", b, keys)).toBe(false)
    // Sum uses the whole key: it spreads them at 5 or 7 (the distinct-sum bucket counts).
    expect(designSpreads("sum", 5, keys)).toBe(true)
    expect(designSpreads("sum", 7, keys)).toBe(true)
    expect(designSpreads("sum", 4, keys)).toBe(false) // 24,20 collide at 0; 26,22 at 2
  })
})

describe("placement frames (fly-to-bucket replay)", () => {
  it("opens in flight and lands the key on the final frame (pure view, append to tail)", () => {
    const frames = placementFrames("sun", { 4: ["cat"] })
    expect(frames).toHaveLength(2)
    expect(frames[0].landed).toBe(false)
    expect(frames[0].table).toEqual({ 4: ["cat"] }) // not yet appended
    expect(frames[0].bucket).toBe(bucketOf("sun")) // 4
    expect(frames[1].landed).toBe(true)
    expect(frames[1].table).toEqual({ 4: ["cat", "sun"] }) // appended to the tail
  })
})

describe("flow + structure", () => {
  it("starts at the demo and has 14 parts", () => {
    const s = createHashTables(SEED)
    expect(currentPartHash(s)).toBe<HashPart>("demo")
    expect(HASH_TOTAL_PARTS).toBe(14)
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

  it("hash-cat-again is a de-cued tap-locate: a FRESH key, absent from the table", () => {
    let s = atHashCat()
    s = clearBeat(s) // clear hash-cat → hash-cat-again
    expect(currentPartHash(s)).toBe<HashPart>("hash-cat-again")
    expect(s.question?.mode).toBe("tap")
    const q = s.question!
    // The asked key is NOT already placed anywhere in the table (no read-off leak).
    expect(q.key).not.toBeNull()
    expect(present(q.key!, q.table)).toBe(false)
    for (const chain of Object.values(q.table)) {
      expect(chain).not.toContain(q.key)
    }
    // The bin is the pure hash of the fresh key, computed from scratch.
    expect(q.bucket).toBe(bucketOf(q.key!))
    const ok = pick(s, bucketTargetId(q.bucket))
    expect(ok.feedback).toBe("correct")
    expect(ok.hashCorrect).toBe(2)
  })
})

describe("collision bin (predict-next-state)", () => {
  function atCollideSun(): HashTablesState {
    let s = createHashTables(SEED)
    while (currentPartHash(s) !== "collide-sun") {
      s = isIntroPart(currentPartHash(s)) ? next(s) : clearBeat(s)
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
      s = isIntroPart(currentPartHash(s)) ? next(s) : clearBeat(s)
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

  const occupied = (table: Record<number, string[]>): number[] =>
    Object.entries(table)
      .filter(([, chain]) => chain.length > 0)
      .map(([i]) => Number(i))

  it("de-cued: several bins are occupied, so the target is not the only non-empty bin", () => {
    for (const part of ["lookup-found", "lookup-absent"] as const) {
      const q = atPart(part).question!
      const occ = occupied(q.table)
      // More than one bin holds keys, so "tap the only occupied bin" cannot work.
      expect(occ.length).toBeGreaterThan(1)
      // At least one OCCUPIED decoy bin is not the answer bin.
      expect(occ.some((b) => b !== q.bucket)).toBe(true)
    }
  })

  it("de-cued: every seeded chain is a valid hash table (each key hashes to its bin)", () => {
    for (const part of ["lookup-found", "lookup-absent"] as const) {
      const q = atPart(part).question!
      for (const [bin, chain] of Object.entries(q.table)) {
        for (const stored of chain) {
          expect(bucketOf(stored, q.bucketCount)).toBe(Number(bin))
        }
      }
    }
  })

  it("found: the answer bin is occupied AND a decoy bin is occupied (must hash to disambiguate)", () => {
    const q = atPart("lookup-found").question!
    expect((q.table[q.bucket] ?? []).includes("fox")).toBe(true)
    expect(occupied(q.table).filter((b) => b !== q.bucket).length).toBeGreaterThan(0)
  })

  it("absent: the bin bat maps to holds a decoy (not bat), and other bins are occupied", () => {
    const q = atPart("lookup-absent").question!
    const targetChain = q.table[q.bucket] ?? []
    expect(targetChain.length).toBeGreaterThan(0) // occupied by a decoy
    expect(targetChain.includes("bat")).toBe(false) // but not the asked key
    expect(occupied(q.table).filter((b) => b !== q.bucket).length).toBeGreaterThan(0)
  })
})

describe("make-a-hash arc (sandbox + design challenge)", () => {
  function atPart(target: HashPart): HashTablesState {
    let s = createHashTables(SEED)
    while (currentPartHash(s) !== target) {
      s = isIntroPart(currentPartHash(s)) ? next(s) : clearBeat(s)
    }
    return s
  }

  it("hash-build-demo is an ungraded free-play sandbox carrying the pool + controls", () => {
    const s = atPart("hash-build-demo")
    expect(isIntroPart("hash-build-demo")).toBe(true)
    const q = s.question!
    expect(q.mode).toBe("intro")
    expect(q.bin).toBeNull()
    expect(q.design?.keys.length).toBeGreaterThan(0)
    expect(q.design?.ruleOptions).toContain<CombineRule>("sum")
    // Continue advances it (no grading).
    expect(currentPartHash(next(s))).toBe<HashPart>("hash-design")
  })

  it("hash-design opens on the seeded weak choice that still collides (the premise, not the answer)", () => {
    const s = atPart("hash-design")
    const q = s.question!
    expect(q.bin).toBe("design")
    expect(q.mode).toBe("design")
    expect(s.designRule).toBe<CombineRule>("first")
    expect(s.designBuckets).toBe(5)
    // The opening choice does NOT spread the keys (cat and cap share a first letter).
    expect(designSpreads(s.designRule!, s.designBuckets!, q.design!.keys)).toBe(false)
    expect(collisionCount(designDistribution(s)!)).toBeGreaterThan(0)
    expect(canCheckHash(s)).toBe(true) // a seeded choice is always present to check
  })

  it("a spreading design (sum + 5 bins) clears the design bin", () => {
    const s = atPart("hash-design")
    const ok = design(s, "sum", 5)
    expect(ok.feedback).toBe("correct")
    expect(ok.designCorrect).toBe(DESIGN_QUOTA)
  })

  it("a still-colliding choice nudges and never bumps the design bin", () => {
    const s = atPart("hash-design")
    const bad = design(s, "first", 5) // cat/cap still collide
    expect(bad.feedback).toBe("nudge")
    expect(bad.designCorrect).toBe(0)
  })

  it("changing a control after a nudge clears the verdict back to idle", () => {
    const s = atPart("hash-design")
    const nudged = design(s, "length", 4)
    expect(nudged.feedback).toBe("nudge")
    const retried = run(nudged, { type: "select", letter: "rule:sum" })
    expect(retried.feedback).toBe("idle")
    expect(retried.designRule).toBe<CombineRule>("sum")
  })
})

describe("real-world beat (warehouse skin)", () => {
  function atRealworld(): HashTablesState {
    let s = createHashTables(SEED)
    while (currentPartHash(s) !== "realworld") {
      s = isIntroPart(currentPartHash(s)) ? next(s) : clearBeat(s)
    }
    return s
  }

  it("wears the warehouse skin but still hashes purely (bucket, answer, free cost)", () => {
    const q = atRealworld().question!
    expect(q.skin).toBe("warehouse")
    expect(q.mode).toBe("drag")
    // The skin never touches the math: the bin is the pure bucket.
    expect(q.bucket).toBe(bucketOf(q.key!))
    expect(q.answer).toBe(bucketTargetId(q.bucket))
    expect(q.cost?.word).toBe("free")
  })

  it("stowing the package in its true bin clears the last lookup slot", () => {
    const s = atRealworld()
    const ok = place(s, s.question!.bucket)
    expect(ok.feedback).toBe("correct")
    expect(ok.lookupCorrect).toBe(BIN_QUOTA)
  })

  it("stowing it in the wrong bin does not clear (the skin doesn't grade)", () => {
    const s = atRealworld()
    const wrong = (s.question!.bucket + 1) % BUCKET_COUNT
    const r = place(s, wrong)
    expect(r.feedback).toBe("nudge")
  })
})

describe("gate, completion, determinism, persistence", () => {
  it("clears all 14 beats to a 3/3/1/3 gate with combo 10", () => {
    const s = playToEnd()
    expect(s.completed).toBe(true)
    expect(isCompleteHash(s)).toBe(true)
    expect(s.hashCorrect).toBe(BIN_QUOTA)
    expect(s.collisionCorrect).toBe(BIN_QUOTA)
    expect(s.designCorrect).toBe(DESIGN_QUOTA)
    expect(s.lookupCorrect).toBe(BIN_QUOTA)
    expect(GATE_TOTAL).toBe(10)
    expect(s.combo).toBe(GATE_TOTAL) // ten consecutive correct, flame never broke
  })

  it("is deterministic — same seed yields the same collision option order", () => {
    const a = createHashTables(SEED)
    const b = createHashTables(SEED)
    let sa = a
    let sb = b
    while (currentPartHash(sa) !== "collide-sun") {
      const intro = isIntroPart(currentPartHash(sa))
      sa = intro ? next(sa) : clearBeat(sa)
      sb = intro ? next(sb) : clearBeat(sb)
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
