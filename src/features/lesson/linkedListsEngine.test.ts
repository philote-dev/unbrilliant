import { describe, it, expect } from "vitest"

import {
  LL_TOTAL_PARTS,
  NEW_NODE,
  NIL,
  availableNodes,
  createLinkedLists,
  currentPartLL,
  isCompleteLL,
  isStuckLL,
  legalTargets,
  linkedListsReducer,
  orphanedNodes,
  pointerId,
  reachableFrom,
  resumeLinkedLists,
  toProgressLinkedLists,
  type LinkedListsState,
} from "./linkedListsEngine"
import type { LessonAction } from "./engine"

/**
 * Behavior-focused tests for the Linked Lists engine (slices 1–2: node demo →
 * teach → traverse (L1) → rewire-insert (L2)). Driven through dispatched actions,
 * asserted on external behavior — verdict, counters, combo, cost, orphaned tail —
 * with a FIXED seed for determinism.
 */
const SEED = 7

function apply(state: LinkedListsState, ...actions: LessonAction[]): LinkedListsState {
  return actions.reduce(linkedListsReducer, state)
}

function atTraverse(seed = SEED): LinkedListsState {
  return resumeLinkedLists({ counters: {}, currentPart: "traverse", completed: false }, seed)
}
function atInsert(seed = SEED): LinkedListsState {
  return resumeLinkedLists({ counters: {}, currentPart: "rewire-insert", completed: false }, seed)
}
function atDelete(seed = SEED): LinkedListsState {
  return resumeLinkedLists({ counters: {}, currentPart: "rewire-delete", completed: false }, seed)
}
function atPredict(seed = SEED): LinkedListsState {
  return resumeLinkedLists({ counters: {}, currentPart: "predict", completed: false }, seed)
}
function atPlaylist(seed = SEED): LinkedListsState {
  return resumeLinkedLists({ counters: {}, currentPart: "playlist", completed: false }, seed)
}
function atContrastInsert(seed = SEED): LinkedListsState {
  return resumeLinkedLists({ counters: {}, currentPart: "contrast-insert", completed: false }, seed)
}
function atContrastReach(seed = SEED): LinkedListsState {
  return resumeLinkedLists({ counters: {}, currentPart: "contrast-reach", completed: false }, seed)
}
function atDoubly(seed = SEED): LinkedListsState {
  return resumeLinkedLists({ counters: {}, currentPart: "doubly", completed: false }, seed)
}

function answerTraverse(s: LinkedListsState): LinkedListsState {
  return apply(s, { type: "select", letter: s.question!.answer }, { type: "check" })
}
function rewireSafe(s: LinkedListsState): LinkedListsState {
  let next = s
  for (const { from, to } of s.question!.rewires) next = apply(next, { type: "rewire", from, to })
  return apply(next, { type: "check" })
}
function spliceFirst(s: LinkedListsState): LinkedListsState {
  const splice = s.question!.rewires[1] // prev → X, the orphaning move
  return apply(s, { type: "rewire", from: splice.from, to: splice.to })
}

describe("Linked Lists — the flow", () => {
  it("opens on the node demo and runs demo → teach → traverse", () => {
    const s = createLinkedLists(SEED)
    expect(currentPartLL(s)).toBe("node-demo")
    expect(LL_TOTAL_PARTS).toBe(10)
    const teach = apply(s, { type: "continue" })
    expect(currentPartLL(teach)).toBe("teach")
    const traverse = apply(teach, { type: "continue" })
    expect(currentPartLL(traverse)).toBe("traverse")
  })
})

describe("Linked Lists — determinism (no-AI)", () => {
  it("same seed → identical question sequence across the whole flow", () => {
    const prompts = (seed: number) => {
      const t = atTraverse(seed)
      const i = apply(answerTraverse(t), { type: "next" })
      const d = apply(rewireSafe(i), { type: "next" })
      const p = apply(rewireSafe(d), { type: "next" })
      const pl = apply(answerTraverse(p), { type: "next" })
      const ci = apply(rewireSafe(pl), { type: "next" })
      const cr = apply(answerTraverse(ci), { type: "next" })
      return [t, i, d, p, pl, ci, cr].map((s) => s.question!.prompt)
    }
    expect(prompts(SEED)).toHaveLength(7)
    expect(prompts(SEED)).toEqual(prompts(SEED))
  })
})

describe("Linked Lists — traverse (L1, walk from the head)", () => {
  it("is deterministic and the answer is the target node on the chain", () => {
    const a = atTraverse(SEED).question!
    const b = atTraverse(SEED).question!
    expect(a.prompt).toBe(b.prompt)
    expect(a.answer).toBe(b.answer)
    expect(a.options).toEqual([]) // node-click answer, no MCQ options
    expect(a.nodes).toContain(a.answer)
    expect(a.answer).toBe(a.nodes[a.targetIndex])
    expect(a.targetIndex).toBeGreaterThanOrEqual(2)
  })

  it("the correct choice clears traverse, climbs the combo, and reads the hop cost", () => {
    const t = atTraverse()
    const s = answerTraverse(t)
    expect(s.feedback).toBe("correct")
    expect(s.traverseCleared).toBe(1)
    expect(s.combo).toBe(1)
    expect(s.question!.cost.word).toBe("scales")
    expect(s.question!.cost.count).toBe(t.question!.targetIndex)
  })

  it("tapping the wrong node nudges then fails; Check needs a selection", () => {
    const t = atTraverse()
    expect(apply(t, { type: "check" })).toBe(t) // nothing selected
    const wrong = t.question!.nodes.find((n) => n !== t.question!.answer)!
    let s = apply(t, { type: "select", letter: wrong }, { type: "check" })
    expect(s.feedback).toBe("nudge")
    s = apply(s, { type: "check" })
    expect(s.feedback).toBe("fail")
    expect(s.combo).toBe(0)
    expect(s.traverseCleared).toBe(0)
  })

  it("clearing traverse advances to the insert beat", () => {
    const s = apply(answerTraverse(atTraverse()), { type: "next" })
    expect(currentPartLL(s)).toBe("rewire-insert")
  })
})

describe("Linked Lists — insert (L2, write-order grading)", () => {
  it("pins the correct order save-first: X→at THEN prev→X", () => {
    const q = atInsert().question!
    expect(q.kind).toBe("rewire-insert")
    expect(q.rewires).toEqual([
      { from: pointerId(NEW_NODE), to: q.at },
      { from: pointerId(q.prev!), to: NEW_NODE },
    ])
  })

  it("the safe order is correct: clears insert, reads free (2 writes)", () => {
    const s = rewireSafe(atInsert())
    expect(s.feedback).toBe("correct")
    expect(s.insertCleared).toBe(1)
    expect(s.combo).toBe(1)
    expect(s.question!.cost).toEqual({ word: "free", count: 2, unit: "pointers rewired" })
  })

  it("an incomplete rewire nudges, then fails", () => {
    const start = atInsert()
    const save = start.question!.rewires[0]
    let s = apply(start, { type: "rewire", from: save.from, to: save.to }, { type: "check" })
    expect(s.feedback).toBe("nudge")
    s = apply(s, { type: "check" })
    expect(s.feedback).toBe("fail")
    expect(s.insertCleared).toBe(0)
  })

  it("Check does nothing until a pointer is re-aimed", () => {
    const s = atInsert()
    expect(apply(s, { type: "check" })).toBe(s)
  })
})

describe("Linked Lists — the orphaned tail (unsafe order)", () => {
  it("repointing prev first drops the tail out of the reachable set", () => {
    const broken = spliceFirst(atInsert())
    const q = broken.question!
    expect(legalTargets(broken).has(q.at!)).toBe(false)
    expect(orphanedNodes(broken)).toContain(q.at)
    expect(isStuckLL(broken)).toBe(true)
  })

  it("you cannot re-aim onto an orphaned node — the reference is lost", () => {
    const broken = spliceFirst(atInsert())
    const save = broken.question!.rewires[0] // X → at, but at is now unreachable
    expect(apply(broken, { type: "rewire", from: save.from, to: save.to })).toBe(broken)
  })

  it("breaking the list nudges first, then fails on a second check (no recovery)", () => {
    const broken = spliceFirst(atInsert())
    let s = apply(broken, { type: "check" })
    expect(s.feedback).toBe("nudge") // stuck, but graded like any wrong answer
    expect(s.insertCleared).toBe(0)
    s = apply(s, { type: "check" })
    expect(s.feedback).toBe("fail") // flame breaks only on the full fail
    expect(s.combo).toBe(0)
    expect(s.insertCleared).toBe(0)
  })
})

describe("Linked Lists — reachability + legal targets", () => {
  it("reachableFrom walks the chain from the head to ∅", () => {
    const q = atInsert().question!
    expect(reachableFrom(q.head, q.initialNext)).toEqual(new Set(q.nodes))
  })

  it("legal targets are every reachable node plus the loose new node (never ∅)", () => {
    const s = atInsert()
    expect(legalTargets(s)).toEqual(new Set([...s.question!.nodes, NEW_NODE]))
    expect(legalTargets(s).has(NIL)).toBe(false)
    expect(availableNodes(s).has(NEW_NODE)).toBe(true)
  })
})

describe("Linked Lists — delete (L3, one repoint)", () => {
  it("bypasses the node with a single repoint prev→after", () => {
    const q = atDelete().question!
    expect(q.kind).toBe("rewire-delete")
    expect(q.rewires).toHaveLength(1)
    const prevIdx = q.nodes.indexOf(q.prev!)
    const after = q.nodes[prevIdx + 2]
    expect(q.correctNext[pointerId(q.prev!)]).toBe(after)
  })

  it("the bypass clears delete, reads free (1), and removes the node from the list", () => {
    const q = atDelete().question!
    const cur = q.nodes[q.nodes.indexOf(q.prev!) + 1]
    const s = rewireSafe(atDelete())
    expect(s.feedback).toBe("correct")
    expect(s.deleteCleared).toBe(1)
    expect(s.question!.cost).toEqual({ word: "free", count: 1, unit: "pointer rewired" })
    expect(orphanedNodes(s)).toContain(cur) // bypassing IS deleting
  })

  it("a wrong repoint nudges then fails (no orphan-fail trap on delete)", () => {
    const start = atDelete()
    const q = start.question!
    const from = q.rewires[0].from // p:prev
    // Aim at a real node that's neither the source itself (no self-loop) nor the
    // correct bypass target — a plain wrong answer.
    const wrongTo = q.nodes.find((nd) => nd !== q.prev && nd !== q.rewires[0].to)!
    let s = apply(start, { type: "rewire", from, to: wrongTo }, { type: "check" })
    expect(s.feedback).toBe("nudge")
    s = apply(s, { type: "check" })
    expect(s.feedback).toBe("fail")
    expect(s.deleteCleared).toBe(0)
  })
})

describe("Linked Lists — predict-the-break (L4)", () => {
  it("offers the three locked outcomes; the orphaned-tail one is correct", () => {
    const q = atPredict().question!
    expect(q.kind).toBe("predict")
    expect(new Set(q.options.map((o) => o.id))).toEqual(new Set(["fine", "lost", "loop"]))
    expect(q.answer).toBe("lost")
  })

  it("choosing the orphaned tail clears predict; a wrong choice nudges then fails", () => {
    const s = answerTraverse(atPredict()) // selects q.answer ("lost")
    expect(s.feedback).toBe("correct")
    expect(s.predictCleared).toBe(1)
    let w = apply(atPredict(), { type: "select", letter: "fine" }, { type: "check" })
    expect(w.feedback).toBe("nudge")
    w = apply(w, { type: "check" })
    expect(w.feedback).toBe("fail")
    expect(w.predictCleared).toBe(0)
  })
})

describe("Linked Lists — playlist (real-world insert skin)", () => {
  it("is the save-first insert mechanic with playlist copy", () => {
    const q = atPlaylist().question!
    expect(q.kind).toBe("playlist")
    expect(q.rewires).toEqual([
      { from: pointerId(NEW_NODE), to: q.at },
      { from: pointerId(q.prev!), to: NEW_NODE },
    ])
  })

  it("safe order queues the track; the unsafe order still orphans the queue (fail)", () => {
    expect(rewireSafe(atPlaylist()).playlistCleared).toBe(1)
    const broken = spliceFirst(atPlaylist())
    expect(isStuckLL(broken)).toBe(true)
    expect(apply(broken, { type: "check" }).feedback).toBe("nudge")
    expect(apply(broken, { type: "check" }, { type: "check" }).feedback).toBe("fail")
  })
})

describe("Linked Lists — array-vs-list contrast (L5, the inverse trade)", () => {
  it("insert: the list wins (2 writes vs an N-cell ripple)", () => {
    const q = atContrastInsert().question!
    expect(q.kind).toBe("contrast-insert")
    expect(q.answer).toBe("list")
    expect(q.listCost).toEqual({ word: "free", count: 2, unit: "pointers rewired" })
    expect(q.arrayCost!.word).toBe("scales")
    expect(answerTraverse(atContrastInsert()).contrastInsertCleared).toBe(1)
  })

  it("reach: the array wins (1 jump vs k hops)", () => {
    const q = atContrastReach().question!
    expect(q.kind).toBe("contrast-reach")
    expect(q.answer).toBe("array")
    expect(q.arrayCost).toEqual({ word: "free", count: 1, unit: "jump" })
    expect(q.listCost!.word).toBe("scales")
    expect(answerTraverse(atContrastReach()).contrastReachCleared).toBe(1)
  })
})

describe("Linked Lists — doubly coda (ungraded)", () => {
  it("is an ungraded teaching beat that finishes the lesson on continue", () => {
    const s = atDoubly()
    expect(currentPartLL(s)).toBe("doubly")
    expect(s.question!.kind).toBe("doubly")
    expect(s.completed).toBe(false)
    const done = apply(s, { type: "continue" })
    expect(done.completed).toBe(true)
  })
})

describe("Linked Lists — completion / progress", () => {
  it("squashes to a lesson-shaped counters map with an attempt tally", () => {
    const p = toProgressLinkedLists(createLinkedLists(SEED))
    expect(p.counters).toEqual({
      traverse: 0,
      insert: 0,
      delete: 0,
      predict: 0,
      playlist: 0,
      contrastInsert: 0,
      contrastReach: 0,
      attempts: 0,
    })
    expect(p.currentPart).toBe("node-demo")
    expect(p.completed).toBe(false)
  })

  it("clears the seven graded beats, reaches the doubly coda, then finishes", () => {
    const atIns = apply(answerTraverse(atTraverse()), { type: "next" }) // → insert
    const atDel = apply(rewireSafe(atIns), { type: "next" }) // → delete
    const atPre = apply(rewireSafe(atDel), { type: "next" }) // → predict
    const atPlay = apply(answerTraverse(atPre), { type: "next" }) // → playlist
    const atCI = apply(rewireSafe(atPlay), { type: "next" }) // → contrast-insert
    const atCR = apply(answerTraverse(atCI), { type: "next" }) // → contrast-reach
    const atCoda = apply(answerTraverse(atCR), { type: "next" }) // → doubly (ungraded)
    expect(currentPartLL(atCoda)).toBe("doubly")
    expect(isCompleteLL(atCoda)).toBe(true) // 7 graded cleared
    expect(atCoda.completed).toBe(false) // coda not finished yet
    const done = apply(atCoda, { type: "continue" }) // Finish lesson
    expect(done.completed).toBe(true)
    expect(toProgressLinkedLists(done).completed).toBe(true)
  })

  it("restores persisted counts on the same part with a cold combo", () => {
    const s = resumeLinkedLists(
      { counters: { traverse: 1, insert: 0, attempts: 3 }, currentPart: "rewire-insert", completed: false },
      SEED,
    )
    expect(currentPartLL(s)).toBe("rewire-insert")
    expect(s.traverseCleared).toBe(1)
    expect(s.attempts).toBe(3)
    expect(s.combo).toBe(0)
  })
})
