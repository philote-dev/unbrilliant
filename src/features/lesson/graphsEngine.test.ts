import { describe, it, expect } from "vitest"

import type { LessonAction } from "@/features/lesson/engine"
import {
  DRAW_QUOTA,
  G6,
  G6_NODES,
  GATE_TOTAL,
  GRAPHS_TOTAL_PARTS,
  READ_QUOTA,
  SAME_QUOTA,
  T6,
  TRANSIT,
  TRANSIT_DRAW_ADJ,
  TRANSIT_NODES,
  addEdge,
  canCheckGraphs,
  createGraphs,
  currentPartGraphs,
  degree,
  edgeKey,
  edgeList,
  edgeSet,
  graphsReducer,
  hasEdge,
  isCompleteGraphs,
  isConnected,
  isIntroPart,
  isTree,
  legalDrawTargets,
  makeSameGraph,
  makeTreeOrNot,
  neighbors,
  normalizeEdge,
  partQuotaGraphs,
  pathExists,
  reachable,
  removeEdge,
  resumeGraphs,
  sameGraph,
  setEqual,
  toProgressGraphs,
  SAME_GRAPH_VARIANTS,
  TREE_OR_NOT_VARIANTS,
  selectGraphVariant,
  type GraphsPart,
  type GraphsState,
} from "@/features/lesson/graphsEngine"
import { TRANSIT_DIAGRAM_LAYOUT, TRANSIT_GEO_LAYOUT } from "@/lessons/graphs/transitData"

const SEED = 12345

function run(state: GraphsState, ...actions: LessonAction[]): GraphsState {
  return actions.reduce(graphsReducer, state)
}

/** Multi-select a neighbor set then Check. */
function selectNodes(state: GraphsState, nodes: readonly string[]): GraphsState {
  let s = state
  for (const n of nodes) s = graphsReducer(s, { type: "select", letter: n })
  return graphsReducer(s, { type: "check" })
}

/** Pick a single option then Check. */
function pick(state: GraphsState, id: string): GraphsState {
  return run(state, { type: "select", letter: id }, { type: "check" })
}

/** Draw an edge (rewire) then Check. */
function draw(state: GraphsState, from: string, to: string): GraphsState {
  return run(state, { type: "rewire", from, to }, { type: "check" })
}

/** Clear the current graded beat correctly and advance to the next part. */
function clearBeat(state: GraphsState): GraphsState {
  const q = state.question!
  let s: GraphsState
  if (q.mode === "multiselect") s = selectNodes(state, q.answerSet!)
  else if (q.mode === "draw") s = draw(state, q.missingEdge![0], q.missingEdge![1])
  else s = pick(state, q.answer)
  expect(s.feedback).toBe("correct")
  return run(s, { type: "next" })
}

const cont = (s: GraphsState) => run(s, { type: "continue" })

/** Walk a state to a target part (clearing graded beats, continuing intros). */
function advanceTo(target: GraphsPart, seed = SEED): GraphsState {
  let s = createGraphs(seed)
  let guard = 0
  while (currentPartGraphs(s) !== target && guard++ < 50) {
    s = isIntroPart(currentPartGraphs(s)) ? cont(s) : clearBeat(s)
  }
  expect(currentPartGraphs(s)).toBe(target)
  return s
}

/** Play the whole lesson on the happy path to completion. */
function playToEnd(seed = SEED): GraphsState {
  let s = createGraphs(seed)
  let guard = 0
  while (!s.completed && guard++ < 50) {
    s = isIntroPart(currentPartGraphs(s)) ? cont(s) : clearBeat(s)
  }
  return s
}

/* --------------------------------- pure helpers --------------------------------- */

describe("pure adjacency helpers (G6 fixture)", () => {
  it("normalizeEdge / edgeKey make {A,B} ≡ {B,A}", () => {
    expect(normalizeEdge("B", "A")).toEqual(["A", "B"])
    expect(normalizeEdge("A", "B")).toEqual(["A", "B"])
    expect(edgeKey("D", "B")).toBe("B-D")
    expect(edgeKey("B", "D")).toBe(edgeKey("D", "B"))
  })

  it("neighbors are sorted; degree is the set size", () => {
    expect(neighbors(G6, "C")).toEqual(["A", "B", "E"])
    expect(neighbors(G6, "D")).toEqual(["B", "E"])
    expect(neighbors(G6, "F")).toEqual(["E"])
    expect(degree(G6, "B")).toBe(3)
    expect(degree(G6, "F")).toBe(1)
  })

  it("hasEdge reads membership symmetrically", () => {
    expect(hasEdge(G6, "B", "D")).toBe(true)
    expect(hasEdge(G6, "D", "B")).toBe(true)
    expect(hasEdge(G6, "A", "D")).toBe(false)
  })

  it("edgeSet has each undirected edge once (G6 has 7)", () => {
    const s = edgeSet(G6)
    expect(s.size).toBe(7)
    expect(s.has("B-D")).toBe(true)
    expect(s.has("D-B")).toBe(false) // canonical only
    expect(edgeList(G6)).toHaveLength(7)
  })

  it("addEdge is symmetric + idempotent and never mutates the source", () => {
    const before = JSON.stringify(G6)
    const withAD = addEdge(G6, "A", "D")
    expect(withAD.A).toContain("D")
    expect(withAD.D).toContain("A")
    expect(edgeSet(withAD).size).toBe(8)
    // idempotent: adding an existing edge changes nothing
    expect(edgeSet(addEdge(G6, "B", "D")).size).toBe(7)
    expect(JSON.stringify(G6)).toBe(before) // source untouched
  })

  it("removeEdge drops from both rows, keeps every node", () => {
    const without = removeEdge(G6, "B", "D")
    expect(without.B).not.toContain("D")
    expect(without.D).not.toContain("B")
    expect(edgeSet(without).size).toBe(6)
    expect(Object.keys(without).sort()).toEqual(G6_NODES)
  })

  it("reachable / pathExists / isConnected on G6", () => {
    expect(reachable(G6, "A").size).toBe(6) // fully connected
    expect(pathExists(G6, "A", "F")).toBe(true)
    expect(isConnected(G6, G6_NODES)).toBe(true)
  })

  it("pathExists is false across a disconnected graph (the 'no' read)", () => {
    const split = { A: ["B"], B: ["A"], C: ["D"], D: ["C"] }
    expect(pathExists(split, "A", "B")).toBe(true)
    expect(pathExists(split, "A", "C")).toBe(false)
    expect(isConnected(split, ["A", "B", "C", "D"])).toBe(false)
  })

  it("isTree: G6 is a general graph (cycle), T6 is a tree", () => {
    expect(isTree(G6, G6_NODES)).toBe(false) // 7 edges > 6 − 1
    expect(isTree(T6, G6_NODES)).toBe(true) // 5 edges = 6 − 1, connected
    expect(edgeSet(T6).size).toBe(G6_NODES.length - 1)
  })

  it("setEqual is order-independent", () => {
    expect(setEqual(["E", "A", "B"], ["A", "B", "E"])).toBe(true)
    expect(setEqual(["A", "B"], ["A", "B", "E"])).toBe(false)
    expect(setEqual(["A", "B", "X"], ["A", "B", "E"])).toBe(false)
  })

  it("sameGraph compares edge sets, not positions", () => {
    expect(sameGraph(G6, addEdge(removeEdge(G6, "A", "B"), "A", "B"))).toBe(true)
    expect(sameGraph(G6, removeEdge(G6, "E", "F"))).toBe(false)
  })
})

/* --------------------------------- flow + structure --------------------------------- */

describe("flow + structure", () => {
  it("starts at the demo and has 12 parts", () => {
    const s = createGraphs(SEED)
    expect(currentPartGraphs(s)).toBe<GraphsPart>("demo")
    expect(GRAPHS_TOTAL_PARTS).toBe(12)
  })

  it("continue advances only on intro/teach beats", () => {
    let s = createGraphs(SEED)
    s = cont(s)
    expect(currentPartGraphs(s)).toBe<GraphsPart>("teach")
    s = cont(s)
    expect(currentPartGraphs(s)).toBe<GraphsPart>("read-list")
    // continue is a no-op on a graded beat
    expect(currentPartGraphs(run(s, { type: "continue" }))).toBe<GraphsPart>("read-list")
  })

  it("legalDrawTargets is every node; the surface never gates the drop", () => {
    const s = advanceTo("draw-edge")
    const legal = legalDrawTargets(s)
    expect(legal.size).toBe(s.question!.nodes.length)
    for (const n of s.question!.nodes) expect(legal.has(n)).toBe(true)
  })
})

/* --------------------------------- read bin --------------------------------- */

describe("read bin: connection list & degree (multi-select, set equality)", () => {
  it("read-list: the exact neighbor set of C clears the beat and climbs the combo", () => {
    const s = advanceTo("read-list")
    expect(s.question!.answerSet).toEqual(["A", "B", "E"])
    expect(canCheckGraphs(s)).toBe(false) // nothing picked yet
    const one = graphsReducer(s, { type: "select", letter: "A" })
    expect(canCheckGraphs(one)).toBe(true)
    const ok = selectNodes(s, ["A", "B", "E"])
    expect(ok.feedback).toBe("correct")
    expect(ok.readCorrect).toBe(1)
    expect(ok.combo).toBe(1)
  })

  it("read-list: set equality ignores tap order", () => {
    const s = advanceTo("read-list")
    expect(selectNodes(s, ["E", "A", "B"]).feedback).toBe("correct")
  })

  it("read-list: a missing or extra node nudges, then fails (counter untouched)", () => {
    const s = advanceTo("read-list")
    const missing = selectNodes(s, ["A", "B"]) // too few
    expect(missing.feedback).toBe("nudge")
    expect(missing.readCorrect).toBe(0)
    const extra = selectNodes(s, ["A", "B", "E", "D"]) // one too many
    expect(extra.feedback).toBe("nudge")
    // the same wrong selection persists after a nudge; a second Check fails it
    const failed = run(missing, { type: "check" })
    expect(failed.feedback).toBe("fail")
    expect(failed.combo).toBe(0)
    expect(failed.readCorrect).toBe(0)
  })

  it("read-degree: tapping D's neighbors gives degree 2 by set size", () => {
    const s = advanceTo("read-degree")
    expect(s.question!.answerSet).toEqual(["B", "E"])
    expect(s.question!.answerSet!.length).toBe(degree(G6, "D"))
    expect(selectNodes(s, ["B", "E"]).feedback).toBe("correct")
  })

  it("read-path: A→F is reachable (yes)", () => {
    const s = advanceTo("read-path")
    expect(s.question!.answer).toBe("yes")
    expect(pick(s, "no").feedback).toBe("nudge")
    expect(pick(s, "yes").feedback).toBe("correct")
  })
})

describe("read bin: match-list MCQ", () => {
  it("the correct option is the picture's exact set; each distractor differs by one real edge", () => {
    const s = advanceTo("match-list")
    const q = s.question!
    const correct = q.options.find((o) => o.id === "correct")!
    expect(sameGraph(correct.adj!, G6)).toBe(true)

    const distractors = q.options.filter((o) => o.id !== "correct")
    expect(distractors).toHaveLength(3)
    for (const d of distractors) {
      // differs from the picture by exactly one undirected edge
      const a = edgeSet(d.adj!)
      const b = edgeSet(G6)
      const diff =
        [...a].filter((e) => !b.has(e)).length + [...b].filter((e) => !a.has(e)).length
      expect(diff).toBe(1)
      // and is NOT just the correct set re-sorted
      expect(sameGraph(d.adj!, G6)).toBe(false)
    }
  })

  it("picking the matching list is correct; a distractor nudges", () => {
    const s = advanceTo("match-list")
    expect(pick(s, "add-ad").feedback).toBe("nudge")
    expect(pick(s, "correct").feedback).toBe("correct")
  })

  it("option order is deterministic for a given seed", () => {
    const a = advanceTo("match-list", SEED).question!.options.map((o) => o.id)
    const b = advanceTo("match-list", SEED).question!.options.map((o) => o.id)
    expect(a).toEqual(b)
  })
})

/* --------------------------------- draw bin --------------------------------- */

describe("draw bin: undirected edge-draw (rewire normalized to a set)", () => {
  it("draw-edge: drawing {B,D} matches the data and clears the beat", () => {
    const s = advanceTo("draw-edge")
    expect(s.question!.missingEdge).toEqual(["B", "D"])
    expect(canCheckGraphs(s)).toBe(false) // nothing drawn yet
    const drawn = graphsReducer(s, { type: "rewire", from: "B", to: "D" })
    expect(canCheckGraphs(drawn)).toBe(true)
    expect(drawn.pendingEdge).toEqual(["B", "D"])
    const ok = graphsReducer(drawn, { type: "check" })
    expect(ok.feedback).toBe("correct")
    expect(ok.drawCorrect).toBe(1)
  })

  it("draw-edge: {D,B} is identical to {B,D} (undirected)", () => {
    const s = advanceTo("draw-edge")
    const ok = draw(s, "D", "B")
    expect(ok.feedback).toBe("correct")
    expect(ok.pendingEdge).toEqual(["B", "D"])
  })

  it("draw-edge: a self-loop and an existing edge are both no-ops", () => {
    const s = advanceTo("draw-edge")
    expect(graphsReducer(s, { type: "rewire", from: "B", to: "B" }).pendingEdge).toBeNull()
    // B–A already exists in the shown picture → dup is ignored
    expect(graphsReducer(s, { type: "rewire", from: "B", to: "A" }).pendingEdge).toBeNull()
    // an endpoint outside the node set → ignored
    expect(graphsReducer(s, { type: "rewire", from: "B", to: "Z" }).pendingEdge).toBeNull()
  })

  it("draw-edge: a legal-but-wrong edge nudges, then fails (counter untouched)", () => {
    const s = advanceTo("draw-edge")
    const wrong = draw(s, "B", "E") // B–E is legal to draw but not the missing edge
    expect(wrong.feedback).toBe("nudge")
    expect(wrong.drawCorrect).toBe(0)
    // a new legal draw REPLACES the pending edge (one edge at a time)
    const replaced = graphsReducer(wrong, { type: "rewire", from: "B", to: "D" })
    expect(replaced.pendingEdge).toEqual(["B", "D"])
    expect(sameGraph(replaced.workingAdj, G6)).toBe(true)
  })

  it("draw-transit: drawing the missing track grades identically", () => {
    const s = advanceTo("draw-transit")
    expect(s.question!.transit).toBe(true)
    expect(s.question!.missingEdge).toEqual(["C", "D"])
    const ok = draw(s, "D", "C")
    expect(ok.feedback).toBe("correct")
    expect(ok.drawCorrect).toBe(2)
  })
})

/* ------------------------- transit skin (decoration only) ------------------------- */

describe("transit skin: decoration only, verdicts read adjacency", () => {
  it("TRANSIT is 7 stations, 7 segments, one cycle (a general graph)", () => {
    expect(TRANSIT_NODES).toHaveLength(7)
    expect(edgeSet(TRANSIT).size).toBe(7)
    expect(isConnected(TRANSIT, TRANSIT_NODES)).toBe(true)
    expect(isTree(TRANSIT, TRANSIT_NODES)).toBe(false) // the loop is a cycle
    expect(degree(TRANSIT, "C")).toBe(4) // Central: where the loop meets the branch
  })

  it("draw-transit routes the missing C-D track, either drag direction", () => {
    const s = advanceTo("draw-transit")
    expect(s.question!.missingEdge).toEqual(["C", "D"])
    expect(draw(s, "C", "D").feedback).toBe("correct")
    expect(draw(s, "D", "C").feedback).toBe("correct") // undirected
  })

  it("scrambling either transit layout never changes a verdict (position-free)", () => {
    const scramble = (m: Record<string, { x: number; y: number }>) =>
      Object.fromEntries(Object.keys(m).map((k, i) => [k, { x: i * 17, y: 100 - i * 9 }]))
    const geo = scramble(TRANSIT_GEO_LAYOUT)
    const diagram = scramble(TRANSIT_DIAGRAM_LAYOUT)
    expect(Object.keys(geo).sort()).toEqual(TRANSIT_NODES)
    expect(Object.keys(diagram).sort()).toEqual(TRANSIT_NODES)
    // Layouts are decoration: the same network under any coordinates is the same graph,
    // and the draw verdict is computed from adjacency, never from positions.
    expect(sameGraph(TRANSIT, TRANSIT)).toBe(true)
    const s = advanceTo("draw-transit")
    expect(sameGraph(draw(s, "C", "D").workingAdj, TRANSIT_DRAW_ADJ)).toBe(true)
  })

  it("same-graph (transit): 'same' is geo-vs-diagram identical, 'different' drops D-E", () => {
    const same = makeSameGraph("same", SEED).question
    expect(same.transit).toBe(true)
    expect(sameGraph(same.adj, same.adjB!)).toBe(true)
    expect(same.layout).not.toEqual(same.layoutB) // geo and diagram look nothing alike
    const diff = makeSameGraph("different", SEED).question
    expect(sameGraph(diff.adj, diff.adjB!)).toBe(false)
  })
})

/* --------------------------------- same bin --------------------------------- */

describe("same bin: same-graph identity & tree-or-not", () => {
  it("same-graph: a moved-node redraw is the SAME; a one-edge change is DIFFERENT", () => {
    const same = makeSameGraph("same", SEED).question
    expect(same.answer).toBe("same")
    expect(sameGraph(same.adj, same.adjB!)).toBe(true)

    const diff = makeSameGraph("different", SEED).question
    expect(diff.answer).toBe("different")
    expect(sameGraph(diff.adj, diff.adjB!)).toBe(false)
  })

  it("same-graph verdict is invariant under a positions-only relabel", () => {
    const { question } = makeSameGraph("same", SEED)
    // Scramble every position in BOTH layouts; the adjacency is untouched.
    const scrambled = {
      ...question,
      layout: Object.fromEntries(
        Object.keys(question.layout).map((k, i) => [k, { x: i * 13, y: i * 7 }]),
      ),
      layoutB: Object.fromEntries(
        Object.keys(question.layoutB!).map((k, i) => [k, { x: 99 - i, y: i }]),
      ),
    }
    // The verdict reads ONLY adjacency; relabeling positions cannot change it.
    expect(sameGraph(scrambled.adj, scrambled.adjB!)).toBe(true)
    expect(scrambled.answer).toBe("same")
  })

  it("same-graph: the seed-selected variant clears on its marked answer", () => {
    // With curated variant rotation, SEED selects the "different" instance here.
    const s = advanceTo("same-graph")
    expect(s.question!.answer).toBe("different")
    expect(pick(s, "same").feedback).toBe("nudge")
    expect(pick(s, "different").feedback).toBe("correct")
  })

  it("tree-or-not: G6 is a general graph, T6 is a tree", () => {
    expect(makeTreeOrNot("graph", SEED).question.answer).toBe("graph")
    expect(makeTreeOrNot("tree", SEED).question.answer).toBe("tree")
    // SEED selects the "graph" (cycle) instance for the rotated beat.
    const s = advanceTo("tree-or-not")
    expect(s.question!.answer).toBe("graph")
    expect(pick(s, "tree").feedback).toBe("nudge")
    expect(pick(s, "graph").feedback).toBe("correct")
  })
})

/* --------------------------- curated variant rotation --------------------------- */

describe("curated variant rotation (seed-selected, layouts RNG-free)", () => {
  it("selectGraphVariant is deterministic and picks an in-pool variant", () => {
    for (const seed of [0, 1, 7, 12345, 99999]) {
      const a = selectGraphVariant(SAME_GRAPH_VARIANTS, seed)
      const b = selectGraphVariant(SAME_GRAPH_VARIANTS, seed)
      expect(a).toEqual(b) // same seed → same variant AND same advanced rng
      expect(SAME_GRAPH_VARIANTS).toContain(a.variant)
    }
  })

  it("both same-graph variants are reachable across seeds (rotation)", () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= 40; seed++) {
      seen.add(advanceTo("same-graph", seed).question!.answer)
    }
    expect(seen).toEqual(new Set(["same", "different"]))
  })

  it("both tree-or-not variants are reachable across seeds (rotation)", () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= 40; seed++) {
      seen.add(advanceTo("tree-or-not", seed).question!.answer)
    }
    expect(seen).toEqual(new Set(["graph", "tree"]))
  })

  it("same-graph per-variant: 'same' is identical, 'different' drops one edge", () => {
    const same = makeSameGraph("same", SEED).question
    expect(same.answer).toBe("same")
    expect(sameGraph(same.adj, same.adjB!)).toBe(true)

    const diff = makeSameGraph("different", SEED).question
    expect(diff.answer).toBe("different")
    expect(sameGraph(diff.adj, diff.adjB!)).toBe(false)
  })

  it("tree-or-not per-variant: 'graph' has a cycle, 'tree' is acyclic", () => {
    expect(makeTreeOrNot("graph", SEED).question.answer).toBe("graph")
    expect(isTree(makeTreeOrNot("graph", SEED).question.adj, G6_NODES)).toBe(false)
    expect(makeTreeOrNot("tree", SEED).question.answer).toBe("tree")
    expect(isTree(makeTreeOrNot("tree", SEED).question.adj, G6_NODES)).toBe(true)
  })

  it("layouts never depend on RNG, identical across two different seeds", () => {
    // For a fixed variant, positions are hand-authored constants, so two
    // unrelated seeds (which only reshuffle option order) yield identical layouts.
    for (const v of SAME_GRAPH_VARIANTS) {
      const a = makeSameGraph(v, 111).question
      const b = makeSameGraph(v, 987654).question
      expect(a.layout).toEqual(b.layout)
      expect(a.layoutB).toEqual(b.layoutB)
    }
    for (const v of TREE_OR_NOT_VARIANTS) {
      const a = makeTreeOrNot(v, 111).question
      const b = makeTreeOrNot(v, 987654).question
      expect(a.layout).toEqual(b.layout)
    }
  })
})

/* --------------------------- gate, determinism, persistence --------------------------- */

describe("gate, completion, determinism, persistence", () => {
  it("partQuotaGraphs reports cumulative n of 8 on a graded beat, null on intro", () => {
    expect(partQuotaGraphs(createGraphs(SEED))).toBeNull() // demo
    const atRead = advanceTo("read-list")
    expect(partQuotaGraphs(atRead)).toEqual({ done: 0, total: GATE_TOTAL })
    const cleared = clearBeat(atRead) // read=1 → read-degree
    expect(partQuotaGraphs(cleared)).toEqual({ done: 1, total: GATE_TOTAL })
  })

  it("the gate flips only at 4 / 2 / 2 and the happy path reaches combo 8", () => {
    const s = playToEnd()
    expect(s.completed).toBe(true)
    expect(isCompleteGraphs(s)).toBe(true)
    expect(s.readCorrect).toBe(READ_QUOTA)
    expect(s.drawCorrect).toBe(DRAW_QUOTA)
    expect(s.sameCorrect).toBe(SAME_QUOTA)
    expect(s.combo).toBe(GATE_TOTAL) // 8 consecutive correct, flame never broke
  })

  it("is incomplete until every bin is satisfied", () => {
    expect(isCompleteGraphs({ ...createGraphs(SEED), readCorrect: 4, drawCorrect: 2, sameCorrect: 1 })).toBe(false)
    expect(isCompleteGraphs({ ...createGraphs(SEED), readCorrect: 4, drawCorrect: 2, sameCorrect: 2 })).toBe(true)
  })

  it("is deterministic: same seed yields the same questions", () => {
    const a = advanceTo("match-list", SEED)
    const b = advanceTo("match-list", SEED)
    expect(a.question!.options.map((o) => o.id)).toEqual(b.question!.options.map((o) => o.id))
    expect(a.question!.answerSet).toEqual(b.question!.answerSet)
  })

  it("round-trips progress and resumes on the same beat with a cold combo", () => {
    let s = advanceTo("read-degree")
    s = clearBeat(s) // read-degree done → read-path; read=2
    const progress = toProgressGraphs(s)
    expect(progress.counters).toMatchObject({ read: 2, draw: 0, same: 0 })
    expect(progress.currentPart).toBe<GraphsPart>("read-path")

    const resumed = resumeGraphs(progress, SEED)
    expect(currentPartGraphs(resumed)).toBe<GraphsPart>("read-path")
    expect(resumed.readCorrect).toBe(2)
    expect(resumed.combo).toBe(0) // flame is transient, cold on resume
    expect(resumed.pendingEdge).toBeNull() // working state not persisted
  })

  it("a completed run resumes as completed", () => {
    const done = toProgressGraphs(playToEnd())
    expect(done.completed).toBe(true)
    expect(resumeGraphs(done, SEED).completed).toBe(true)
  })
})
