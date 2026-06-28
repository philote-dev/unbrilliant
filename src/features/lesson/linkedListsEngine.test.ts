import { describe, it, expect } from "vitest"

import {
  LL_TOTAL_PARTS,
  NEW_NODE,
  NIL,
  availableNodes,
  createLinkedLists,
  currentPartLL,
  deleteWriteFrames,
  insertWriteFrames,
  isCompleteLL,
  isStuckLL,
  legalTargets,
  linkedListsReducer,
  nextPtr,
  orphanedNodes,
  playlistOrphanedLL,
  playlistPhaseIndexLL,
  playlistStepLL,
  pointerId,
  predictBreakFrames,
  prevPtr,
  reachableFrom,
  remainingScriptLL,
  resumeLinkedLists,
  toProgressLinkedLists,
  walkCursorLL,
  walkFrontierLL,
  type LinkedListsState,
} from "./linkedListsEngine"
import type { LessonAction } from "./engine"

/**
 * Behavior-focused tests for the Linked Lists engine (12 beats, 9 graded). Driven
 * through dispatched actions, asserted on external behavior (verdict, counters,
 * combo, cost, orphaned tail, forced-walk frontier, scripted synthesis) with a
 * FIXED seed for determinism.
 */
const SEED = 7

function apply(state: LinkedListsState, ...actions: LessonAction[]): LinkedListsState {
  return actions.reduce(linkedListsReducer, state)
}

function at(part: string, seed = SEED): LinkedListsState {
  return resumeLinkedLists({ counters: {}, currentPart: part, completed: false }, seed)
}

/** Forced-walk to the target node, then commit. Works forwards (traverse) and
 * backwards (doubly-walk) by always tapping the engine's single legal frontier. */
function completeWalk(s: LinkedListsState): LinkedListsState {
  let cur = s
  const target = cur.question!.targetIndex
  let guard = 0
  while (walkCursorLL(cur) !== target && guard++ < 12) {
    const frontier = walkFrontierLL(cur)
    if (frontier < 0) break
    cur = apply(cur, { type: "select", letter: cur.question!.nodes[frontier] })
  }
  return apply(cur, { type: "check" })
}

function completeRewire(s: LinkedListsState): LinkedListsState {
  let cur = s
  for (const { from, to } of s.question!.rewires) cur = apply(cur, { type: "rewire", from, to })
  return apply(cur, { type: "check" })
}

/** Perform a scripted-write beat (playlist synthesis / doubly splice) in order;
 * completion auto-grades on the last write (no Check). */
function completeScript(s: LinkedListsState): LinkedListsState {
  let cur = s
  const script =
    cur.question!.kind === "playlist" ? cur.question!.flatWrites : cur.question!.doublyWrites
  for (const { from, to } of script) cur = apply(cur, { type: "rewire", from, to })
  return cur
}

function completeContrast(s: LinkedListsState): LinkedListsState {
  const picked = apply(s, { type: "select", letter: s.question!.pickAnswer }, { type: "check" })
  return apply(picked, { type: "select", letter: picked.question!.whyAnswer }, { type: "check" })
}

function completePredict(s: LinkedListsState): LinkedListsState {
  return apply(s, { type: "select", letter: s.question!.answer }, { type: "check" })
}

describe("Linked Lists - the flow", () => {
  it("opens on the node demo and runs through the 12-beat map", () => {
    const s = createLinkedLists(SEED)
    expect(currentPartLL(s)).toBe("node-demo")
    expect(LL_TOTAL_PARTS).toBe(12)
    const teach = apply(s, { type: "continue" })
    expect(currentPartLL(teach)).toBe("teach")
    const traverse = apply(teach, { type: "continue" })
    expect(currentPartLL(traverse)).toBe("traverse")
  })

  it("walks the whole graded gate to completion (9 graded skills)", () => {
    const traverse = completeWalk(at("traverse"))
    const ins = apply(traverse, { type: "next" })
    expect(currentPartLL(ins)).toBe("rewire-insert")
    const del = apply(completeRewire(ins), { type: "next" })
    expect(currentPartLL(del)).toBe("rewire-delete")
    const pre = apply(completeRewire(del), { type: "next" })
    expect(currentPartLL(pre)).toBe("predict")
    const play = apply(completePredict(pre), { type: "next" })
    expect(currentPartLL(play)).toBe("playlist")
    const ci = apply(completeScript(play), { type: "next" })
    expect(currentPartLL(ci)).toBe("contrast-insert")
    const cr = apply(completeContrast(ci), { type: "next" })
    expect(currentPartLL(cr)).toBe("contrast-reach")
    const demo = apply(completeContrast(cr), { type: "next" })
    expect(currentPartLL(demo)).toBe("doubly-demo")
    const splice = apply(demo, { type: "continue" })
    expect(currentPartLL(splice)).toBe("doubly-splice")
    const walk = apply(completeScript(splice), { type: "next" })
    expect(currentPartLL(walk)).toBe("doubly-walk")
    const done = apply(completeWalk(walk), { type: "next" })
    expect(done.completed).toBe(true)
    expect(isCompleteLL(done)).toBe(true)
  })
})

describe("Linked Lists - determinism (no-AI)", () => {
  it("same seed -> identical question prompts across the graded beats", () => {
    const prompts = (seed: number) =>
      ["traverse", "rewire-insert", "rewire-delete", "predict", "playlist", "contrast-insert", "contrast-reach", "doubly-splice", "doubly-walk"].map(
        (p) => at(p, seed).question!.prompt,
      )
    expect(prompts(SEED)).toEqual(prompts(SEED))
    expect(prompts(SEED).length).toBe(9)
  })
})

describe("Linked Lists - traverse (forced walk)", () => {
  it("only the next hop is tappable; you cannot one-tap the answer", () => {
    const t = at("traverse")
    const q = t.question!
    expect(q.targetIndex).toBeGreaterThanOrEqual(2)
    // The answer node is more than one hop away, so tapping it directly is rejected.
    const rejected = apply(t, { type: "select", letter: q.answer })
    expect(rejected.selected).toBeNull()
    // Only the head's successor (index 1) is the legal frontier.
    expect(walkFrontierLL(t)).toBe(1)
    const stepped = apply(t, { type: "select", letter: q.nodes[1] })
    expect(stepped.selected).toBe(q.nodes[1])
    expect(walkFrontierLL(stepped)).toBe(2)
  })

  it("walking to the target and committing clears traverse and reads the hop cost", () => {
    const s = completeWalk(at("traverse"))
    expect(s.feedback).toBe("correct")
    expect(s.traverseCleared).toBe(1)
    expect(s.combo).toBe(1)
    expect(s.question!.cost.word).toBe("scales")
    expect(s.question!.cost.count).toBe(at("traverse").question!.targetIndex)
  })

  it("committing short of the target nudges then fails", () => {
    const t = at("traverse")
    // Walk exactly one hop (to index 1), short of the target (index >= 2), then check.
    let s = apply(t, { type: "select", letter: t.question!.nodes[1] }, { type: "check" })
    expect(s.feedback).toBe("nudge")
    s = apply(s, { type: "check" })
    expect(s.feedback).toBe("fail")
    expect(s.traverseCleared).toBe(0)
  })

  it("Check needs a walk first (no selection)", () => {
    const t = at("traverse")
    expect(apply(t, { type: "check" })).toBe(t)
  })
})

describe("Linked Lists - insert (write-order grading)", () => {
  it("pins the correct order save-first: X->at THEN prev->X", () => {
    const q = at("rewire-insert").question!
    expect(q.kind).toBe("rewire-insert")
    expect(q.rewires).toEqual([
      { from: pointerId(NEW_NODE), to: q.at },
      { from: pointerId(q.prev!), to: NEW_NODE },
    ])
  })

  it("the safe order clears insert and reads free (2 writes)", () => {
    const s = completeRewire(at("rewire-insert"))
    expect(s.feedback).toBe("correct")
    expect(s.insertCleared).toBe(1)
    expect(s.question!.cost).toEqual({ word: "free", count: 2, unit: "pointers rewired" })
  })

  it("repointing prev first orphans the tail and grades as a fail", () => {
    const start = at("rewire-insert")
    const splice = start.question!.rewires[1] // prev -> X, the orphaning move first
    const broken = apply(start, { type: "rewire", from: splice.from, to: splice.to })
    expect(legalTargets(broken).has(broken.question!.at!)).toBe(false)
    expect(orphanedNodes(broken)).toContain(broken.question!.at)
    expect(isStuckLL(broken)).toBe(true)
    let s = apply(broken, { type: "check" })
    expect(s.feedback).toBe("nudge")
    s = apply(s, { type: "check" })
    expect(s.feedback).toBe("fail")
    expect(s.insertCleared).toBe(0)
  })

  it("reachableFrom walks the chain from the head to ∅ and legal targets include X (never ∅)", () => {
    const s = at("rewire-insert")
    expect(reachableFrom(s.question!.head, s.question!.initialNext)).toEqual(new Set(s.question!.nodes))
    expect(legalTargets(s)).toEqual(new Set([...s.question!.nodes, NEW_NODE]))
    expect(legalTargets(s).has(NIL)).toBe(false)
    expect(availableNodes(s).has(NEW_NODE)).toBe(true)
  })
})

describe("Linked Lists - delete (one repoint)", () => {
  it("clears delete with a single bypass and removes the node", () => {
    const q = at("rewire-delete").question!
    expect(q.rewires).toHaveLength(1)
    const cur = q.nodes[q.nodes.indexOf(q.prev!) + 1]
    const s = completeRewire(at("rewire-delete"))
    expect(s.feedback).toBe("correct")
    expect(s.deleteCleared).toBe(1)
    expect(s.question!.cost).toEqual({ word: "free", count: 1, unit: "pointer rewired" })
    expect(orphanedNodes(s)).toContain(cur)
  })
})

describe("Linked Lists - predict + animated orphaning", () => {
  it("offers the three locked outcomes; the orphaned-tail one is correct", () => {
    const q = at("predict").question!
    expect(new Set(q.options.map((o) => o.id))).toEqual(new Set(["fine", "lost", "loop"]))
    expect(q.answer).toBe("lost")
  })

  it("choosing the orphaned tail clears predict; a wrong choice nudges then fails", () => {
    expect(completePredict(at("predict")).predictCleared).toBe(1)
    let w = apply(at("predict"), { type: "select", letter: "fine" }, { type: "check" })
    expect(w.feedback).toBe("nudge")
    w = apply(w, { type: "check" })
    expect(w.feedback).toBe("fail")
  })

  it("predictBreakFrames detaches the tail on the second frame", () => {
    const q = at("predict").question!
    const frames = predictBreakFrames(q)
    expect(frames).toHaveLength(2)
    expect(frames[0].orphaned).toEqual([])
    expect(frames[1].orphaned).toContain(q.at)
  })
})

describe("Linked Lists - playlist synthesis (multi-step, one slot)", () => {
  it("is a three-phase task (insert -> delete -> reorder), not a plain insert repeat", () => {
    const q = at("playlist").question!
    expect(q.kind).toBe("playlist")
    expect(q.playlistSteps.map((s) => s.phase)).toEqual(["insert", "delete", "reorder"])
    // 2 insert writes + 1 delete write + 3 reorder writes = 6 total.
    expect(q.flatWrites).toHaveLength(6)
  })

  it("performs the whole script in order and clears as one slot", () => {
    const s = completeScript(at("playlist"))
    expect(s.feedback).toBe("correct")
    expect(s.playlistCleared).toBe(1)
    expect(s.combo).toBe(1)
  })

  it("advances phase as writes land; a wrong write only nudges (never strands)", () => {
    const start = at("playlist")
    expect(playlistPhaseIndexLL(start)).toBe(0) // insert
    const afterInsert = apply(
      start,
      { type: "rewire", ...start.question!.flatWrites[0] },
      { type: "rewire", ...start.question!.flatWrites[1] },
    )
    expect(playlistPhaseIndexLL(afterInsert)).toBe(1) // delete
    expect(playlistStepLL(afterInsert)!.phase).toBe("delete")
    // A wrong write nudges and does not advance the cursor.
    const wrong = apply(afterInsert, { type: "rewire", from: pointerId("A"), to: "E" })
    expect(wrong.feedback).toBe("nudge")
    expect(wrong.writes.length).toBe(afterInsert.writes.length)
    expect(remainingScriptLL(afterInsert)).toHaveLength(4)
  })

  it("drops the deleted track but keeps the reordered track present", () => {
    const start = at("playlist")
    // Run insert + delete; the deleted track C orphans, the moved track D stays.
    let s = start
    for (const w of start.question!.flatWrites.slice(0, 3)) s = apply(s, { type: "rewire", ...w })
    const orphaned = playlistOrphanedLL(s)
    expect(orphaned).toContain("C")
    expect(orphaned).not.toContain("D")
    expect(legalTargets(s).has("C")).toBe(false)
  })
})

describe("Linked Lists - contrast two-step (pick -> why-MCQ)", () => {
  it("insert: the pick is de-cued (structure names only, no cost or strategy)", () => {
    const q = at("contrast-insert").question!
    expect(q.pickOptions.map((o) => o.id).sort()).toEqual(["array", "list", "same"])
    const banned = /\d|rewire|shift|jump|walk|hop|cell|pointer|index/i
    for (const o of q.pickOptions) expect(o.label).not.toMatch(banned)
    expect(q.pickAnswer).toBe("list")
  })

  it("reach: the pick is de-cued and the array is the less-work pick", () => {
    const q = at("contrast-reach").question!
    const banned = /\d|rewire|shift|jump|walk|hop|cell|pointer|index/i
    for (const o of q.pickOptions) expect(o.label).not.toMatch(banned)
    expect(q.pickAnswer).toBe("array")
  })

  it("the pick is low-stakes (any pick advances to the why-MCQ; it never fails)", () => {
    const start = at("contrast-insert")
    expect(start.contrastPhase).toBe("pick")
    // Even a wrong pick advances to the graded why-MCQ without failing.
    const afterPick = apply(start, { type: "select", letter: "array" }, { type: "check" })
    expect(afterPick.contrastPhase).toBe("why")
    expect(afterPick.feedback).toBe("idle")
    expect(afterPick.combo).toBe(0)
    expect(afterPick.pick).toBe("array")
  })

  it("the why-MCQ is the graded check (correct clears; wrong nudges then fails)", () => {
    expect(completeContrast(at("contrast-insert")).contrastInsertCleared).toBe(1)
    expect(completeContrast(at("contrast-reach")).contrastReachCleared).toBe(1)

    const start = at("contrast-insert")
    const wrongWhyId = start.question!.whyOptions.find((o) => o.id !== start.question!.whyAnswer)!.id
    let w = apply(start, { type: "select", letter: "list" }, { type: "check" }) // pick -> why
    w = apply(w, { type: "select", letter: wrongWhyId }, { type: "check" })
    expect(w.feedback).toBe("nudge")
    w = apply(w, { type: "check" })
    expect(w.feedback).toBe("fail")
    expect(w.contrastInsertCleared).toBe(0)
  })

  it("reveals the cost only after the commit (never on the question screen)", () => {
    const q = at("contrast-insert").question!
    expect(q.arrayCost!.word).toBe("scales")
    expect(q.listCost).toEqual({ word: "free", count: 2, unit: "pointers rewired" })
  })
})

describe("Linked Lists - doubly segment", () => {
  it("doubly-demo is a free-play beat that leads into the graded splice", () => {
    const s = at("doubly-demo")
    expect(s.question!.kind).toBe("doubly-demo")
    const next = apply(s, { type: "continue" })
    expect(currentPartLL(next)).toBe("doubly-splice")
  })

  it("doubly-splice pins the four save-first writes (newcomer first, then neighbours)", () => {
    const q = at("doubly-splice").question!
    const [A, B] = q.nodes
    expect(q.doublyWrites.map((w) => w.from)).toEqual([
      nextPtr(NEW_NODE),
      prevPtr(NEW_NODE),
      nextPtr(A),
      prevPtr(B),
    ])
    expect(q.doublyWrites.map((w) => w.to)).toEqual([B, A, NEW_NODE, NEW_NODE])
  })

  it("doubly-splice clears when all four writes land in order; a wrong order nudges", () => {
    const s = completeScript(at("doubly-splice"))
    expect(s.feedback).toBe("correct")
    expect(s.doublySpliceCleared).toBe(1)

    // Tapping a later write before the next correct one only nudges.
    const start = at("doubly-splice")
    const outOfOrder = start.question!.doublyWrites[2]
    const w = apply(start, { type: "rewire", from: outOfOrder.from, to: outOfOrder.to })
    expect(w.feedback).toBe("nudge")
    expect(w.writes.length).toBe(0)
  })

  it("doubly-walk is a backward forced walk from the tail", () => {
    const s = at("doubly-walk")
    const q = s.question!
    expect(q.backward).toBe(true)
    // The walk starts at the tail; the only frontier is the node before it.
    expect(walkCursorLL(s)).toBe(q.nodes.length - 1)
    expect(walkFrontierLL(s)).toBe(q.nodes.length - 2)
    // You cannot one-tap a node further back than the immediate prev.
    const rejected = apply(s, { type: "select", letter: q.answer })
    expect(rejected.selected).toBeNull()
    const cleared = completeWalk(s)
    expect(cleared.feedback).toBe("correct")
    expect(cleared.doublyWalkCleared).toBe(1)
  })
})

describe("Linked Lists - replay frame selectors", () => {
  it("insertWriteFrames steps intact -> save -> splice with no orphans", () => {
    const q = at("rewire-insert").question!
    const frames = insertWriteFrames(q)
    expect(frames).toHaveLength(3)
    expect(frames.every((f) => f.orphaned.length === 0)).toBe(true)
    expect(frames[1].workingNext[pointerId(NEW_NODE)]).toBe(q.at)
    expect(frames[2].workingNext[pointerId(q.prev!)]).toBe(NEW_NODE)
  })

  it("deleteWriteFrames bypasses the node on the second frame", () => {
    const q = at("rewire-delete").question!
    const frames = deleteWriteFrames(q)
    expect(frames).toHaveLength(2)
    expect(frames[1].orphaned.length).toBeGreaterThan(0)
  })
})

describe("Linked Lists - completion / progress", () => {
  it("squashes to a lesson-shaped counters map with the nine graded keys", () => {
    const p = toProgressLinkedLists(createLinkedLists(SEED))
    expect(p.counters).toEqual({
      traverse: 0,
      insert: 0,
      delete: 0,
      predict: 0,
      playlist: 0,
      contrastInsert: 0,
      contrastReach: 0,
      doublySplice: 0,
      doublyWalk: 0,
      attempts: 0,
    })
    expect(p.currentPart).toBe("node-demo")
    expect(p.completed).toBe(false)
  })

  it("restores persisted counts on the same part with a cold combo", () => {
    const s = resumeLinkedLists(
      {
        counters: { traverse: 1, insert: 1, doublySplice: 1, attempts: 5 },
        currentPart: "doubly-walk",
        completed: false,
      },
      SEED,
    )
    expect(currentPartLL(s)).toBe("doubly-walk")
    expect(s.traverseCleared).toBe(1)
    expect(s.doublySpliceCleared).toBe(1)
    expect(s.attempts).toBe(5)
    expect(s.combo).toBe(0)
  })

  it("is complete only when all nine graded beats are cleared", () => {
    const eight = resumeLinkedLists(
      {
        counters: {
          traverse: 1,
          insert: 1,
          delete: 1,
          predict: 1,
          playlist: 1,
          contrastInsert: 1,
          contrastReach: 1,
          doublySplice: 1,
        },
        currentPart: "doubly-walk",
        completed: false,
      },
      SEED,
    )
    expect(isCompleteLL(eight)).toBe(false)
    expect(isCompleteLL(completeWalk(eight))).toBe(true)
  })
})
