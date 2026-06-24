import { describe, it, expect } from "vitest"

import type { LessonAction } from "@/features/lesson/engine"
import {
  COMPARISON_QUOTA,
  LOCATE_QUOTA,
  SEQUENCE_QUOTA,
  T_BAL,
  T_STICK,
  T_ZIG,
  TREES_TOTAL_PARTS,
  canCheckTrees,
  candidatesRemaining,
  createTrees,
  currentPartTrees,
  depth,
  descendPath,
  droppedAlongPath,
  droppedNodeIds,
  inorder,
  inorderKeys,
  insertSlot,
  isCompleteTrees,
  nodeById,
  resumeTrees,
  subtreeSize,
  toProgressTrees,
  treesReducer,
  type TreesPart,
  type TreesState,
} from "@/features/lesson/treesEngine"

const SEED = 12345

function run(state: TreesState, ...actions: LessonAction[]): TreesState {
  return actions.reduce(treesReducer, state)
}

const next = (s: TreesState) => run(s, { type: "continue" })

/** Tap the correct descend path (children after the root), optional ghost slot. */
function descendCorrect(s: TreesState, includeGhost: boolean): TreesState {
  const d = s.question!.descend!
  let r = s
  for (let i = 1; i < d.path.length; i++) {
    r = run(r, { type: "select", letter: d.path[i] })
  }
  if (includeGhost && d.missingSide) {
    r = run(r, { type: "select", letter: `ghost:${d.missingSide}` })
  }
  return r
}

/** Clear the current graded beat correctly and advance to the next part. */
function clearBeat(s: TreesState): TreesState {
  const q = s.question!
  let r = s
  switch (q.kind) {
    case "find-hit":
    case "realworld":
      r = run(descendCorrect(s, false), { type: "check" })
      break
    case "find-miss":
    case "insert":
      r = run(descendCorrect(s, true), { type: "check" })
      break
    case "sequence-a":
    case "sequence-b":
      for (const id of q.order) r = run(r, { type: "select", letter: id })
      r = run(r, { type: "check" })
      break
    case "compare-shape":
      r = run(s, { type: "select", letter: q.answer }, { type: "check" })
      break
    case "contrast-list":
      for (let i = 0; i < q.chainTargetIndex; i++) r = run(r, { type: "select", letter: "chain" })
      r = run(descendCorrect(r, false), { type: "check" })
      break
    default:
      throw new Error(`not a graded beat: ${q.kind}`)
  }
  expect(r.feedback).toBe("correct")
  return run(r, { type: "next" })
}

function playToEnd(seed = SEED): TreesState {
  let s = createTrees(seed)
  while (!s.completed) {
    const part = currentPartTrees(s)
    if (part === "demo" || part === "teach-descend" || part === "teach-inorder") s = next(s)
    else s = clearBeat(s)
  }
  return s
}

/** Walk to a given part on the happy path. */
function atPart(target: TreesPart, seed = SEED): TreesState {
  let s = createTrees(seed)
  let guard = 0
  while (currentPartTrees(s) !== target && guard++ < 50) {
    const part = currentPartTrees(s)
    if (part === "demo" || part === "teach-descend" || part === "teach-inorder") s = next(s)
    else s = clearBeat(s)
  }
  return s
}

describe("tree helpers (pure)", () => {
  it("in-order yields the sorted keys for every curated tree", () => {
    expect(inorderKeys(T_BAL)).toEqual([2, 4, 6, 8, 10, 12, 14])
    expect(inorderKeys(T_ZIG)).toEqual([3, 5, 7, 9, 11, 15])
    expect(inorderKeys(T_STICK)).toEqual([2, 4, 6, 8, 10, 12, 14])
    expect(inorder(T_ZIG)).toEqual(["n3", "n5", "n7", "n9", "n11", "n15"])
  })

  it("the stick and the balanced tree share an in-order order but not a depth", () => {
    expect(inorderKeys(T_STICK)).toEqual(inorderKeys(T_BAL)) // same set, same sorted order
    expect(depth(T_BAL)).toBe(2)
    expect(depth(T_ZIG)).toBe(3)
    expect(depth(T_STICK)).toBe(6) // n − 1: a linked list in disguise
  })

  it("subtreeSize and nodeById", () => {
    expect(subtreeSize(T_BAL)).toBe(7)
    expect(subtreeSize(T_BAL.left)).toBe(3)
    expect(subtreeSize(null)).toBe(0)
    expect(nodeById(T_BAL, "n6")?.key).toBe(6)
    expect(nodeById(T_BAL, "nope")).toBeNull()
  })

  it("descendPath finds a hit and reports the dropped halves", () => {
    const d = descendPath(T_BAL, 10)
    expect(d.path).toEqual(["n8", "n12", "n10"])
    expect(d.found).toBe(true)
    expect(d.comparisons).toBe(3)
    expect(d.steps.map((s) => s.droppedSize)).toEqual([3, 1]) // drop left-of-8 (3), then 14 (1)
  })

  it("descendPath falls off the tree for an absent key", () => {
    const d = descendPath(T_BAL, 7)
    expect(d.path).toEqual(["n8", "n4", "n6"])
    expect(d.found).toBe(false)
    expect(d.missingParentId).toBe("n6")
    expect(d.missingSide).toBe("right")
    expect(d.comparisons).toBe(3)
  })

  it("insertSlot is the unique empty child the search lands in", () => {
    expect(insertSlot(T_BAL, 5)).toEqual({ parentId: "n6", side: "left" })
  })

  it("a balanced find barely grows while the stick scales (same key)", () => {
    expect(descendPath(T_BAL, 14).comparisons).toBe(3) // halves
    expect(descendPath(T_STICK, 14).comparisons).toBe(7) // walks every node
  })
})

describe("halving / search space (candidatesRemaining + droppedAlongPath)", () => {
  it("candidatesRemaining halves cleanly 7 -> 3 -> 1 while descending to 10", () => {
    const s0 = atPart("find-hit") // target 10; cursor at the root n8
    expect(candidatesRemaining(s0)).toBe(7) // the whole tree is still in play
    const s1 = run(s0, { type: "select", letter: "n12" })
    expect(candidatesRemaining(s1)).toBe(3) // 12, 10, 14
    const s2 = run(s1, { type: "select", letter: "n10" })
    expect(candidatesRemaining(s2)).toBe(1) // just 10
  })

  it("candidatesRemaining is the cursor subtree size on the zigzag tree too", () => {
    // sequence-b uses T_ZIG, but candidatesRemaining reads off any descend state.
    let s = atPart("find-miss") // target 7 on T_BAL: n8 -> n4 -> n6
    expect(candidatesRemaining(s)).toBe(subtreeSize(T_BAL)) // 7 at the root
    s = run(s, { type: "select", letter: "n4" })
    expect(candidatesRemaining(s)).toBe(subtreeSize(nodeById(T_BAL, "n4"))) // 3
    s = run(s, { type: "select", letter: "n6" })
    expect(candidatesRemaining(s)).toBe(1) // the leaf n6
  })

  it("candidatesRemaining is 0 once the search falls into an empty slot", () => {
    let s = atPart("find-miss") // 7 -> n8 -> n4 -> n6, then the empty right slot
    for (let i = 1; i < s.question!.descend!.path.length; i++) {
      s = run(s, { type: "select", letter: s.question!.descend!.path[i] })
    }
    expect(candidatesRemaining(s)).toBe(1) // at the n6 leaf, one candidate left
    s = run(s, { type: "select", letter: "ghost:right" })
    expect(candidatesRemaining(s)).toBe(0) // fell off the tree: nothing in play
  })

  it("droppedAlongPath greys the opposite subtree discarded at each step", () => {
    expect([...droppedAlongPath(T_BAL, ["n8"])]).toEqual([]) // nothing dropped at the root
    expect([...droppedAlongPath(T_BAL, ["n8", "n12"])].sort()).toEqual(["n2", "n4", "n6"])
    expect([...droppedAlongPath(T_BAL, ["n8", "n12", "n10"])].sort()).toEqual([
      "n14",
      "n2",
      "n4",
      "n6",
    ])
  })

  it("droppedAlongPath is total: an empty / unknown path drops nothing", () => {
    expect([...droppedAlongPath(T_BAL, [])]).toEqual([])
    expect([...droppedAlongPath(null, ["n8", "n12"])]).toEqual([])
  })

  it("droppedNodeIds is droppedAlongPath over the live tapped path", () => {
    const s = run(atPart("find-hit"), { type: "select", letter: "n12" })
    expect([...droppedNodeIds(s)].sort()).toEqual(
      [...droppedAlongPath(s.question!.tree, s.tappedPath)].sort(),
    )
    expect([...droppedNodeIds(s)].sort()).toEqual(["n2", "n4", "n6"])
  })
})

describe("flow + structure", () => {
  it("starts at the demo with 11 parts and the root tapped", () => {
    const s = createTrees(SEED)
    expect(currentPartTrees(s)).toBe<TreesPart>("demo")
    expect(TREES_TOTAL_PARTS).toBe(11)
    expect(s.tappedPath).toEqual(["n8"])
  })

  it("continue only advances on intro/teach beats", () => {
    let s = createTrees(SEED)
    s = next(s)
    expect(currentPartTrees(s)).toBe<TreesPart>("teach-descend")
    s = next(s)
    expect(currentPartTrees(s)).toBe<TreesPart>("find-hit")
    // continue is a no-op on a graded descend beat
    expect(currentPartTrees(run(s, { type: "continue" }))).toBe<TreesPart>("find-hit")
  })
})

describe("locate bin (descend)", () => {
  it("a correct find-hit path clears the beat, barely grows, climbs the combo", () => {
    const s = atPart("find-hit")
    expect(s.question?.cost?.word).toBe("barely grows")
    expect(s.question?.cost?.count).toBe(3)
    expect(canCheckTrees(s)).toBe(false) // only the root is tapped so far
    const done = run(descendCorrect(s, false), { type: "check" })
    expect(done.feedback).toBe("correct")
    expect(done.locateCorrect).toBe(1)
    expect(done.combo).toBe(1)
  })

  it("only the cursor's own children are tappable (no jumping)", () => {
    const s = atPart("find-hit") // cursor = root n8; children n4 / n12
    const jumped = run(s, { type: "select", letter: "n2" }) // a grandchild — illegal
    expect(jumped.tappedPath).toEqual(["n8"])
    const stepped = run(s, { type: "select", letter: "n12" })
    expect(stepped.tappedPath).toEqual(["n8", "n12"])
  })

  it("find-miss commits at the ghost slot; the wrong side nudges then fails", () => {
    const s = atPart("find-miss")
    expect(s.locateCorrect).toBe(1) // find-hit already counted
    // Descend correctly to n6, then tap the WRONG empty side.
    let r = s
    for (let i = 1; i < s.question!.descend!.path.length; i++) {
      r = run(r, { type: "select", letter: s.question!.descend!.path[i] })
    }
    const wrong = run(r, { type: "select", letter: "ghost:left" }, { type: "check" })
    expect(wrong.feedback).toBe("nudge")
    expect(wrong.locateCorrect).toBe(1) // not bumped by a wrong attempt
    const failed = run(wrong, { type: "check" })
    expect(failed.feedback).toBe("fail")
    expect(failed.combo).toBe(0)
    expect(failed.locateCorrect).toBe(1)
    // The correct right slot clears it.
    const ok = run(descendCorrect(atPart("find-miss"), true), { type: "check" })
    expect(ok.feedback).toBe("correct")
    expect(ok.locateCorrect).toBe(2)
  })

  it("insert lands in the unique empty slot", () => {
    const s = atPart("insert")
    expect(s.question?.insertAt).toEqual({ parentId: "n6", side: "left" })
    const ok = run(descendCorrect(s, true), { type: "check" })
    expect(ok.feedback).toBe("correct")
    expect(ok.locateCorrect).toBe(3) // find-hit + find-miss + insert
  })
})

describe("sequence bin (in-order)", () => {
  it("the in-order tap order is correct; a wrong order nudges then fails", () => {
    const s = atPart("sequence-a")
    expect(s.question?.tree.id).toBe("n8")
    const order = s.question!.order
    // A wrong (swapped) full-length order — checkable, but not the in-order.
    const swapped = [order[1], order[0], ...order.slice(2)]
    let bad = s
    for (const id of swapped) bad = run(bad, { type: "select", letter: id })
    expect(canCheckTrees(bad)).toBe(true)
    bad = run(bad, { type: "check" })
    expect(bad.feedback).toBe("nudge")
    bad = run(bad, { type: "check" })
    expect(bad.feedback).toBe("fail")
    expect(bad.sequenceCorrect).toBe(0)

    const ok = clearBeat(atPart("sequence-a"))
    expect(ok.sequenceCorrect).toBe(1)
  })

  it("sequence-b grades on a different shape (T_ZIG), layout-independent", () => {
    const s = atPart("sequence-b")
    expect(s.question?.tree.id).toBe("n9")
    expect(s.question?.order).toEqual(inorder(T_ZIG))
    const ok = clearBeat(s)
    expect(ok.sequenceCorrect).toBe(2)
  })
})

describe("comparison bin (synthesis)", () => {
  it("compare-shape: the same-order-diff-cost option wins; misconception present", () => {
    const s = atPart("compare-shape")
    const ids = s.question!.options.map((o) => o.id).sort()
    expect(ids).toEqual(["diff-sets", "same-order-diff-cost", "same-structure"])
    expect(s.question?.answer).toBe("same-order-diff-cost")
    expect(s.question?.cost?.word).toBe("barely grows")
    expect(s.question?.cost?.count).toBe(3)
    expect(s.question?.altCost?.word).toBe("scales")
    expect(s.question?.altCost?.count).toBe(7)

    const wrong = run(s, { type: "select", letter: "same-structure" }, { type: "check" })
    expect(wrong.feedback).toBe("nudge")
    const ok = run(s, { type: "select", letter: "same-order-diff-cost" }, { type: "check" })
    expect(ok.feedback).toBe("correct")
    expect(ok.comparisonCorrect).toBe(1)
  })

  it("contrast-list: the list walks 7 hops, the tree finds it in 3", () => {
    const s = atPart("contrast-list")
    expect(s.question?.cost?.word).toBe("barely grows")
    expect(s.question?.cost?.count).toBe(3)
    expect(s.question?.altCost?.word).toBe("scales")
    expect(s.question?.altCost?.count).toBe(7) // indexOf(14) + 1
    // The descend can't be checked until the felt pre-walk is finished.
    const beforeWalk = run(descendCorrect(s, false))
    expect(canCheckTrees(beforeWalk)).toBe(false)
    let walked = s
    for (let i = 0; i < s.question!.chainTargetIndex; i++) {
      walked = run(walked, { type: "select", letter: "chain" })
    }
    const ok = run(descendCorrect(walked, false), { type: "check" })
    expect(ok.feedback).toBe("correct")
    expect(ok.comparisonCorrect).toBe(2)
  })
})

describe("gate, determinism, persistence", () => {
  it("clears all 8 graded beats to a 4/2/2 gate with combo 8", () => {
    const s = playToEnd()
    expect(s.completed).toBe(true)
    expect(isCompleteTrees(s)).toBe(true)
    expect(s.locateCorrect).toBe(LOCATE_QUOTA)
    expect(s.sequenceCorrect).toBe(SEQUENCE_QUOTA)
    expect(s.comparisonCorrect).toBe(COMPARISON_QUOTA)
    expect(s.combo).toBe(8) // eight consecutive correct, flame never broke
  })

  it("is deterministic — same seed yields the same compare-shape option order", () => {
    const a = atPart("compare-shape", SEED)
    const b = atPart("compare-shape", SEED)
    expect(a.question!.options.map((o) => o.id)).toEqual(b.question!.options.map((o) => o.id))
  })

  it("round-trips progress and resumes on the same beat with a cold combo", () => {
    let s = createTrees(SEED)
    s = next(next(s)) // → find-hit
    s = clearBeat(s) // find-hit done → find-miss
    const progress = toProgressTrees(s)
    expect(progress.counters.locate).toBe(1)
    expect(progress.currentPart).toBe<TreesPart>("find-miss")

    const resumed = resumeTrees(progress, SEED)
    expect(currentPartTrees(resumed)).toBe<TreesPart>("find-miss")
    expect(resumed.locateCorrect).toBe(1)
    expect(resumed.combo).toBe(0) // flame is transient — cold on resume
  })

  it("a completed run resumes as completed", () => {
    const done = toProgressTrees(playToEnd())
    expect(done.completed).toBe(true)
    expect(resumeTrees(done, SEED).completed).toBe(true)
  })
})
