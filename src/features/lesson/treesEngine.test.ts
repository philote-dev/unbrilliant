import { describe, it, expect } from "vitest"

import type { LessonAction } from "@/features/lesson/engine"
import {
  BUILD_QUOTA,
  COMPARISON_QUOTA,
  FIND_BIG_GEN,
  LOCATE_QUOTA,
  SEQUENCE_QUOTA,
  T_BAL,
  T_SEQ_C,
  T_STICK,
  T_ZIG,
  TREES_TOTAL_PARTS,
  balancedBst,
  bstBuildFromKeys,
  bstBuildNextStep,
  bstBuildTap,
  buildBstFromKeys,
  canCheckTrees,
  candidatesRemaining,
  createTrees,
  currentPartTrees,
  depth,
  descendPath,
  droppedAlongPath,
  droppedNodeIds,
  generateBigTree,
  inorder,
  inorderKeys,
  insertBstKey,
  insertSlot,
  isBstBuildSolved,
  isCompleteTrees,
  nodeById,
  resumeTrees,
  sequenceFrontier,
  subtreeKeyRange,
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

/** Drive a build beat to completion by always taking the single correct next step. */
function solveBuild(s: TreesState): TreesState {
  let r = s
  let guard = 0
  while (r.build && !isBstBuildSolved(r.build) && guard++ < 60) {
    const step = bstBuildNextStep(r.build)
    if (!step) break
    const letter = step.kind === "node" ? step.id : `ghost:${step.side}`
    r = run(r, { type: "select", letter })
  }
  return r
}

/** Clear the current graded beat correctly and advance to the next part. */
function clearBeat(s: TreesState): TreesState {
  const q = s.question!
  let r = s
  switch (q.kind) {
    case "find-hit":
    case "find-big":
    case "realworld":
      r = run(descendCorrect(s, false), { type: "check" })
      break
    case "find-miss":
    case "insert":
      r = run(descendCorrect(s, true), { type: "check" })
      break
    case "build-bst-1":
    case "build-bst-2":
      r = solveBuild(s)
      break
    case "sequence-a":
    case "sequence-b":
    case "sequence-c":
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
  let guard = 0
  while (!s.completed && guard++ < 80) {
    const part = currentPartTrees(s)
    if (part === "demo" || part === "teach-descend" || part === "watched-build" || part === "teach-inorder") {
      s = next(s)
    } else {
      s = clearBeat(s)
    }
  }
  return s
}

/** Walk to a given part on the happy path. */
function atPart(target: TreesPart, seed = SEED): TreesState {
  let s = createTrees(seed)
  let guard = 0
  while (currentPartTrees(s) !== target && guard++ < 80) {
    const part = currentPartTrees(s)
    if (part === "demo" || part === "teach-descend" || part === "watched-build" || part === "teach-inorder") {
      s = next(s)
    } else {
      s = clearBeat(s)
    }
  }
  return s
}

describe("tree helpers (pure)", () => {
  it("in-order yields the sorted keys for every curated tree", () => {
    expect(inorderKeys(T_BAL)).toEqual([2, 4, 6, 8, 10, 12, 14])
    expect(inorderKeys(T_ZIG)).toEqual([3, 5, 7, 9, 11, 15])
    expect(inorderKeys(T_STICK)).toEqual([2, 4, 6, 8, 10, 12, 14])
    expect(inorderKeys(T_SEQ_C)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
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

  it("subtreeKeyRange spans a subtree's keys and halves down each side (the guess band)", () => {
    expect(subtreeKeyRange(T_BAL)).toEqual([2, 14]) // root: the whole range
    expect(subtreeKeyRange(T_BAL.left)).toEqual([2, 6]) // left-of-8: the lower half
    expect(subtreeKeyRange(T_BAL.right)).toEqual([10, 14]) // right-of-8: the upper half
    expect(subtreeKeyRange(nodeById(T_BAL, "n6"))).toEqual([6, 6]) // a leaf is a point
    expect(subtreeKeyRange(T_ZIG)).toEqual([3, 15])
    expect(subtreeKeyRange(null)).toBeNull()
  })
})

describe("BST construction helpers (insert / build / balanced)", () => {
  it("insertBstKey attaches a key at the slot the search falls into, pure (no mutation)", () => {
    const grown = insertBstKey(T_BAL, 5)
    expect(inorderKeys(grown)).toEqual([2, 4, 5, 6, 8, 10, 12, 14])
    // 5 lands left of 6 (the insertSlot), and the original tree is untouched.
    expect(nodeById(grown, "n6")?.left?.key).toBe(5)
    expect(nodeById(T_BAL, "n6")?.left).toBeNull()
  })

  it("buildBstFromKeys grows the unique tree an insert sequence produces", () => {
    const tree = buildBstFromKeys([8, 4, 12, 2, 6, 10, 14])
    expect(inorderKeys(tree)).toEqual([2, 4, 6, 8, 10, 12, 14])
    expect(tree.id).toBe("n8") // first key is the root
    expect(depth(tree)).toBe(2) // level-order insert is balanced
    // insert order changes the shape, never the in-order reading.
    expect(inorderKeys(buildBstFromKeys([2, 4, 6, 8, 10, 12, 14]))).toEqual([2, 4, 6, 8, 10, 12, 14])
    expect(depth(buildBstFromKeys([2, 4, 6, 8, 10, 12, 14]))).toBe(6) // sorted insert = a stick
  })

  it("balancedBst over sorted keys is minimal height", () => {
    const tree = balancedBst([1, 2, 3, 4, 5, 6, 7])!
    expect(inorderKeys(tree)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(depth(tree)).toBe(2) // 7 nodes, perfectly balanced
    expect(balancedBst([])).toBeNull()
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

  it("droppedNodeIds is droppedAlongPath over the live tapped path", () => {
    const s = run(atPart("find-hit"), { type: "select", letter: "n12" })
    expect([...droppedNodeIds(s)].sort()).toEqual(["n2", "n4", "n6"])
  })
})

describe("flow + structure", () => {
  it("starts at the demo with 16 parts and the root tapped", () => {
    const s = createTrees(SEED)
    expect(currentPartTrees(s)).toBe<TreesPart>("demo")
    expect(TREES_TOTAL_PARTS).toBe(16)
    expect(s.tappedPath).toEqual(["n8"])
  })

  it("continue advances through the demo + teach-descend into find-hit", () => {
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
    let r = s
    for (let i = 1; i < s.question!.descend!.path.length; i++) {
      r = run(r, { type: "select", letter: s.question!.descend!.path[i] })
    }
    const wrong = run(r, { type: "select", letter: "ghost:left" }, { type: "check" })
    expect(wrong.feedback).toBe("nudge")
    const failed = run(wrong, { type: "check" })
    expect(failed.feedback).toBe("fail")
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

  it("real-world bracket descends a mixed lower-then-higher path to 6 and clears Locate 5", () => {
    const s = atPart("realworld")
    expect(s.question?.target).toBe(6)
    expect(s.question?.descend?.path).toEqual(["n8", "n4", "n6"])
    expect(s.question!.descend!.steps.map((st) => st.goLeft)).toEqual([true, false])
    expect(s.locateCorrect).toBe(4) // find-hit + find-miss + insert + find-big
    const done = run(descendCorrect(s, false), { type: "check" })
    expect(done.feedback).toBe("correct")
    expect(done.locateCorrect).toBe(5) // the fifth Locate
  })
})

describe("find-big (bigger generated tree, deep descend)", () => {
  it("generates a deterministic, valid, balanced BST with a deep present target", () => {
    const a = generateBigTree(SEED)
    const b = generateBigTree(SEED)
    expect(a).toEqual(b) // deterministic
    expect(subtreeSize(a.tree)).toBe(FIND_BIG_GEN.size) // 15 nodes
    // a valid BST (sorted in-order) with distinct keys
    const keys = inorderKeys(a.tree)
    expect([...keys].sort((x, y) => x - y)).toEqual(keys)
    expect(new Set(keys).size).toBe(keys.length)
    // the target is present and sits on a deep path where the halving pays off
    const d = descendPath(a.tree, a.target)
    expect(d.found).toBe(true)
    expect(d.comparisons).toBeGreaterThanOrEqual(FIND_BIG_GEN.minDepth)
    // balanced: 15 nodes fit in depth 3 (a stick would be depth 14)
    expect(depth(a.tree)).toBe(3)
  })

  it("varies the tree across seeds but always stays a valid, deep instance", () => {
    for (const seed of [1, 2, 7, 99, 12345]) {
      const { tree, target } = generateBigTree(seed)
      const keys = inorderKeys(tree)
      expect([...keys].sort((x, y) => x - y)).toEqual(keys)
      expect(descendPath(tree, target).comparisons).toBeGreaterThanOrEqual(FIND_BIG_GEN.minDepth)
    }
  })

  it("find-big is a Locate beat that grades like a find-hit", () => {
    const s = atPart("find-big")
    expect(s.question?.bin).toBe("locate")
    expect(s.question?.cost?.word).toBe("barely grows")
    expect(s.locateCorrect).toBe(3) // find-hit + find-miss + insert
    const done = run(descendCorrect(s, false), { type: "check" })
    expect(done.feedback).toBe("correct")
    expect(done.locateCorrect).toBe(4)
  })
})

describe("build bin (grow the BST)", () => {
  it("the build model: open with the root placed, descend each key to its slot", () => {
    const beat = bstBuildFromKeys([6, 4, 9, 2])
    expect(beat.placed).toBe(1) // the root (6) is auto-placed
    expect(beat.tree.key).toBe(6)
    // next key is 4: it descends left of 6 to the empty slot
    const step1 = bstBuildNextStep(beat)
    expect(step1).toEqual({ kind: "ghost", side: "left" })
    const placed4 = bstBuildTap(beat, "ghost:left")
    expect(placed4.accepted).toBe(true)
    expect(placed4.placedKey).toBe(true)
    expect(placed4.beat.placed).toBe(2)
    // a wrong drop is rejected, leaving the beat untouched
    const wrong = bstBuildTap(placed4.beat, "ghost:left") // 9 goes right, not left
    expect(wrong.accepted).toBe(false)
    expect(wrong.beat).toBe(placed4.beat)
  })

  it("solving a build grows exactly buildBstFromKeys and bumps the Build bin", () => {
    const s = atPart("build-bst-1")
    expect(s.question?.bin).toBe("build")
    expect(canCheckTrees(s)).toBe(false) // builds commit via taps, never Check
    const done = solveBuild(s)
    expect(done.feedback).toBe("correct")
    expect(isBstBuildSolved(done.build!)).toBe(true)
    expect(done.build!.tree).toEqual(buildBstFromKeys(done.build!.keys))
    expect(done.buildCorrect).toBe(1)
    expect(done.combo).toBeGreaterThan(0)
  })

  it("a wrong sub-move nudges without advancing the build (no fail wall)", () => {
    const s = atPart("build-bst-1") // current key 4, drops left of 6
    const step = bstBuildNextStep(s.build!)
    expect(step).toEqual({ kind: "ghost", side: "left" })
    const wrong = run(s, { type: "select", letter: "ghost:right" })
    expect(wrong.feedback).toBe("nudge")
    expect(wrong.build!.placed).toBe(1) // not advanced
    expect(wrong.buildCorrect).toBe(0)
    // the correct drop then advances it
    const ok = run(s, { type: "select", letter: "ghost:left" })
    expect(ok.feedback).toBe("idle")
    expect(ok.build!.placed).toBe(2)
  })

  it("clears both build reps to fill the Build bin", () => {
    const s = atPart("build-bst-2")
    expect(s.buildCorrect).toBe(1) // build-bst-1 already done
    const done = solveBuild(s)
    expect(done.buildCorrect).toBe(BUILD_QUOTA) // both reps cleared
  })
})

describe("sequence bin (in-order, frontier-gated)", () => {
  it("only the next correct in-order id is tappable; out-of-order taps are rejected", () => {
    const s = atPart("sequence-a")
    const order = s.question!.order
    expect(sequenceFrontier(s)).toBe(order[0])
    // an out-of-order tap (the 4th node first) is a no-op
    const jumped = run(s, { type: "select", letter: order[3] })
    expect(jumped.tappedOrder).toEqual([])
    // tapping the frontier advances it one step
    const stepped = run(s, { type: "select", letter: order[0] })
    expect(stepped.tappedOrder).toEqual([order[0]])
    expect(sequenceFrontier(stepped)).toBe(order[1])
  })

  it("walking the whole in-order frontier clears the beat", () => {
    const ok = clearBeat(atPart("sequence-a"))
    expect(ok.sequenceCorrect).toBe(1)
  })

  it("sequence-b grades on the zigzag and sequence-c on the larger shape", () => {
    const b = atPart("sequence-b")
    expect(b.question?.tree.id).toBe("n9")
    expect(b.question?.order).toEqual(inorder(T_ZIG))
    const afterB = clearBeat(b)
    expect(afterB.sequenceCorrect).toBe(2)

    const c = atPart("sequence-c")
    expect(c.question?.tree.id).toBe(T_SEQ_C.id)
    expect(c.question?.order).toEqual(inorder(T_SEQ_C))
    const afterC = clearBeat(c)
    expect(afterC.sequenceCorrect).toBe(SEQUENCE_QUOTA) // all three reps
  })
})

describe("comparison bin (synthesis) + de-cue", () => {
  it("compare-shape is de-cued: neutral option labels, verdict only in feedback", () => {
    const s = atPart("compare-shape")
    const ids = s.question!.options.map((o) => o.id).sort()
    expect(ids).toEqual(["a-fewer", "b-fewer", "same-cost"])
    expect(s.question?.answer).toBe("a-fewer") // balanced Tree A reaches it in fewer steps
    // no option label leaks the verdict tokens
    const tokens = ["halves", "halve", "walks", "walk", "same keys", "linked list"]
    for (const opt of s.question!.options) {
      const label = opt.label.toLowerCase()
      for (const t of tokens) expect(label).not.toContain(t)
    }
    // the verdict still lands, but only in the post-commit feedback
    expect(s.question?.correct.toLowerCase()).toContain("halves")
    expect(s.question?.why.toLowerCase()).toContain("walks")
    // costs survive for the reveal readouts
    expect(s.question?.cost?.count).toBe(3)
    expect(s.question?.altCost?.count).toBe(7)

    const wrong = run(s, { type: "select", letter: "same-cost" }, { type: "check" })
    expect(wrong.feedback).toBe("nudge")
    const ok = run(s, { type: "select", letter: "a-fewer" }, { type: "check" })
    expect(ok.feedback).toBe("correct")
    expect(ok.comparisonCorrect).toBe(1)
  })

  it("contrast-list: the list walks 7 hops, the tree finds it in 3", () => {
    const s = atPart("contrast-list")
    expect(s.question?.cost?.count).toBe(3)
    expect(s.question?.altCost?.count).toBe(7)
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
  it("clears all 12 graded beats to a 5/3/2/2 gate with combo 12", () => {
    const s = playToEnd()
    expect(s.completed).toBe(true)
    expect(isCompleteTrees(s)).toBe(true)
    expect(s.locateCorrect).toBe(LOCATE_QUOTA)
    expect(s.sequenceCorrect).toBe(SEQUENCE_QUOTA)
    expect(s.buildCorrect).toBe(BUILD_QUOTA)
    expect(s.comparisonCorrect).toBe(COMPARISON_QUOTA)
    expect(s.combo).toBe(12) // twelve consecutive correct, flame never broke
  })

  it("is deterministic — same seed yields the same compare-shape option order", () => {
    const a = atPart("compare-shape", SEED)
    const b = atPart("compare-shape", SEED)
    expect(a.question!.options.map((o) => o.id)).toEqual(b.question!.options.map((o) => o.id))
  })

  it("round-trips progress (incl. the build counter) and resumes cold", () => {
    let s = createTrees(SEED)
    s = next(next(s)) // → find-hit
    s = clearBeat(s) // find-hit done → find-miss
    const progress = toProgressTrees(s)
    expect(progress.counters.locate).toBe(1)
    expect(progress.counters.build).toBe(0)
    expect(progress.currentPart).toBe<TreesPart>("find-miss")

    const resumed = resumeTrees(progress, SEED)
    expect(currentPartTrees(resumed)).toBe<TreesPart>("find-miss")
    expect(resumed.locateCorrect).toBe(1)
    expect(resumed.combo).toBe(0) // flame is transient — cold on resume
  })

  it("resumes a build beat with its working tree rebuilt", () => {
    const progress = toProgressTrees(atPart("build-bst-1"))
    const resumed = resumeTrees(progress, SEED)
    expect(currentPartTrees(resumed)).toBe<TreesPart>("build-bst-1")
    expect(resumed.build).not.toBeNull()
    expect(resumed.build!.placed).toBe(1) // the root is placed, ready to grow
  })

  it("a completed run resumes as completed", () => {
    const done = toProgressTrees(playToEnd())
    expect(done.completed).toBe(true)
    expect(resumeTrees(done, SEED).completed).toBe(true)
  })
})
