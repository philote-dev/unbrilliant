import { describe, it, expect } from "vitest"

import type { LessonAction } from "@/features/lesson/engine"
import {
  BUILD_QUOTA,
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
  applyBuildLineEdge,
  applyTraceStep,
  buildLineBeatFrom,
  canCheckGraphs,
  createGraphs,
  currentPartGraphs,
  degree,
  edgeKey,
  edgeList,
  edgeSet,
  graphsReducer,
  hasEdge,
  isBuildLinePart,
  isBuildLineSolved,
  isCompleteGraphs,
  isConnected,
  isIntroPart,
  isLegalBuildEdge,
  isLegalTraceStep,
  isTracePart,
  isTraceSolved,
  isTree,
  legalTraceTargets,
  makeSameGraph,
  makeTreeOrNot,
  missingPlanEdges,
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
  traceBeatFrom,
  traceCurrent,
  tracePathEdges,
  SAME_GRAPH_VARIANTS,
  TREE_OR_NOT_VARIANTS,
  selectGraphVariant,
  type GraphsPart,
  type GraphsState,
} from "@/features/lesson/graphsEngine"
import {
  METRO_ACTIVE_ADJ,
  METRO_PLAN_ADJ,
  METRO_PLAN_NODES,
  TRANSIT_DIAGRAM_LAYOUT,
  TRANSIT_GEO_LAYOUT,
} from "@/lessons/graphs/transitData"

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

/** Draw an edge (rewire) then Check (single-edge draw beats). */
function draw(state: GraphsState, from: string, to: string): GraphsState {
  return run(state, { type: "rewire", from, to }, { type: "check" })
}

/** A BFS shortest path (sorted neighbors so it is deterministic). */
function shortestPath(
  adj: Record<string, string[]>,
  start: string,
  target: string,
): string[] {
  const prev = new Map<string, string | null>([[start, null]])
  const queue = [start]
  while (queue.length) {
    const n = queue.shift() as string
    if (n === target) break
    for (const m of [...(adj[n] ?? [])].sort()) {
      if (!prev.has(m)) {
        prev.set(m, n)
        queue.push(m)
      }
    }
  }
  const path: string[] = []
  let cur: string | null = target
  while (cur != null) {
    path.unshift(cur)
    cur = prev.get(cur) ?? null
  }
  return path
}

/** Walk the active trace from start to target along a shortest path. */
function walkTrace(state: GraphsState): GraphsState {
  const q = state.question!
  const path = shortestPath(q.adj, q.pair![0], q.pair![1])
  let s = state
  for (let i = 1; i < path.length; i++) {
    s = graphsReducer(s, { type: "select", letter: path[i] })
  }
  return s
}

/** Draw every missing plan edge of the build-the-line beat. */
function buildAllLines(state: GraphsState): GraphsState {
  const q = state.question!
  const missing = missingPlanEdges(state.workingAdj, q.planAdj!)
  let s = state
  for (const [u, v] of missing) s = graphsReducer(s, { type: "rewire", from: u, to: v })
  return s
}

/** Clear the current graded beat correctly and advance to the next part. */
function clearBeat(state: GraphsState): GraphsState {
  const q = state.question!
  let s: GraphsState
  if (q.mode === "multiselect") s = selectNodes(state, q.answerSet!)
  else if (q.mode === "trace") s = walkTrace(state)
  else if (q.mode === "build") s = buildAllLines(state)
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
  while (currentPartGraphs(s) !== target && guard++ < 60) {
    s = isIntroPart(currentPartGraphs(s)) ? cont(s) : clearBeat(s)
  }
  expect(currentPartGraphs(s)).toBe(target)
  return s
}

/** Play the whole lesson on the happy path to completion. */
function playToEnd(seed = SEED): GraphsState {
  let s = createGraphs(seed)
  let guard = 0
  while (!s.completed && guard++ < 60) {
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

  it("pathExists is false across a disconnected graph", () => {
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

/* --------------------------------- trace model (pure) --------------------------------- */

describe("trace model: walk to the target (pure)", () => {
  it("a fresh beat sits on the start with only the start walked", () => {
    const beat = traceBeatFrom(G6, "A", "F")
    expect(traceCurrent(beat)).toBe("A")
    expect(beat.path).toEqual(["A"])
    expect(isTraceSolved(beat)).toBe(false)
  })

  it("legal next steps are exactly the current node's neighbors", () => {
    const beat = traceBeatFrom(G6, "A", "F")
    expect(legalTraceTargets(beat)).toEqual(new Set(["B", "C"]))
    expect(isLegalTraceStep(beat, "B")).toBe(true)
    expect(isLegalTraceStep(beat, "D")).toBe(false) // not a neighbor of A
  })

  it("a step to a non-neighbor is rejected (beat unchanged)", () => {
    const beat = traceBeatFrom(G6, "A", "F")
    const { beat: same, accepted } = applyTraceStep(beat, "F")
    expect(accepted).toBe(false)
    expect(same).toBe(beat) // identical reference, no walk
  })

  it("walking neighbor by neighbor reaches the target and solves", () => {
    let beat = traceBeatFrom(G6, "A", "F")
    for (const step of ["C", "E", "F"]) {
      const r = applyTraceStep(beat, step)
      expect(r.accepted).toBe(true)
      beat = r.beat
    }
    expect(beat.path).toEqual(["A", "C", "E", "F"])
    expect(isTraceSolved(beat)).toBe(true)
    expect(tracePathEdges(beat)).toEqual([
      ["A", "C"],
      ["C", "E"],
      ["E", "F"],
    ])
  })

  it("the trace is solvable exactly when pathExists (a disconnected target can't be reached)", () => {
    const split = { A: ["B"], B: ["A"], C: ["D"], D: ["C"] }
    expect(pathExists(split, "A", "C")).toBe(false)
    const beat = traceBeatFrom(split, "A", "C")
    // every walkable node stays inside A's component, never reaching C
    let cur = beat
    for (const step of ["B", "A", "B"]) {
      cur = applyTraceStep(cur, step).beat
      expect(isTraceSolved(cur)).toBe(false)
    }
    expect(legalTraceTargets(cur).has("C")).toBe(false)
  })
})

/* --------------------------------- build-the-line model (pure) --------------------------------- */

describe("build-the-line model: grow active toward the plan (pure)", () => {
  it("the active network is missing exactly four plan tracks", () => {
    const missing = missingPlanEdges(METRO_ACTIVE_ADJ, METRO_PLAN_ADJ)
    const keys = missing.map((e) => edgeKey(e[0], e[1])).sort()
    expect(keys).toEqual(["A-M", "B-H", "D-G", "D-J"])
    expect(sameGraph(METRO_ACTIVE_ADJ, METRO_PLAN_ADJ)).toBe(false)
  })

  it("only an un-built plan edge is a legal track", () => {
    const beat = buildLineBeatFrom(METRO_ACTIVE_ADJ, METRO_PLAN_ADJ, METRO_PLAN_NODES)
    expect(isLegalBuildEdge(beat, "D", "G")).toBe(true) // a missing plan edge
    expect(isLegalBuildEdge(beat, "A", "B")).toBe(false) // already built
    expect(isLegalBuildEdge(beat, "A", "D")).toBe(false) // not in the plan
    expect(isLegalBuildEdge(beat, "D", "D")).toBe(false) // self-loop
  })

  it("drawing every missing track reaches the plan; a partial build is not solved", () => {
    let beat = buildLineBeatFrom(METRO_ACTIVE_ADJ, METRO_PLAN_ADJ, METRO_PLAN_NODES)
    const missing = missingPlanEdges(beat.working, beat.planAdj)
    expect(missing.length).toBe(4)

    // partial: draw all but the last
    for (const [u, v] of missing.slice(0, -1)) {
      const r = applyBuildLineEdge(beat, u, v)
      expect(r.accepted).toBe(true)
      beat = r.beat
    }
    expect(isBuildLineSolved(beat)).toBe(false)

    const [lu, lv] = missing[missing.length - 1]
    beat = applyBuildLineEdge(beat, lu, lv).beat
    expect(isBuildLineSolved(beat)).toBe(true)
    expect(sameGraph(beat.working, METRO_PLAN_ADJ)).toBe(true)
  })

  it("a wrong track (not in the plan) is rejected, beat unchanged", () => {
    const beat = buildLineBeatFrom(METRO_ACTIVE_ADJ, METRO_PLAN_ADJ, METRO_PLAN_NODES)
    const { beat: same, accepted } = applyBuildLineEdge(beat, "A", "D")
    expect(accepted).toBe(false)
    expect(same).toBe(beat)
  })
})

/* --------------------------------- flow + structure --------------------------------- */

describe("flow + structure", () => {
  it("starts at the demo and has 14 parts", () => {
    const s = createGraphs(SEED)
    expect(currentPartGraphs(s)).toBe<GraphsPart>("demo")
    expect(GRAPHS_TOTAL_PARTS).toBe(14)
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

  it("read-path and read-trace-far are trace beats; build-the-line is a build beat", () => {
    expect(isTracePart("read-path")).toBe(true)
    expect(isTracePart("read-trace-far")).toBe(true)
    expect(isBuildLinePart("build-the-line")).toBe(true)
    expect(advanceTo("read-path").question!.mode).toBe("trace")
    expect(advanceTo("read-trace-far").question!.mode).toBe("trace")
    expect(advanceTo("build-the-line").question!.mode).toBe("build")
  })
})

/* --------------------------------- read bin --------------------------------- */

describe("read bin: connection list & degree (multi-select, set equality)", () => {
  it("read-list: the exact neighbor set of C clears the beat and climbs the combo", () => {
    const s = advanceTo("read-list")
    expect(s.question!.answerSet).toEqual(["A", "B", "E"])
    expect(canCheckGraphs(s)).toBe(false)
    const one = graphsReducer(s, { type: "select", letter: "A" })
    expect(canCheckGraphs(one)).toBe(true)
    const ok = selectNodes(s, ["A", "B", "E"])
    expect(ok.feedback).toBe("correct")
    expect(ok.readCorrect).toBe(1)
    expect(ok.combo).toBe(1)
  })

  it("read-list: a missing or extra node nudges, then fails (counter untouched)", () => {
    const s = advanceTo("read-list")
    const missing = selectNodes(s, ["A", "B"])
    expect(missing.feedback).toBe("nudge")
    expect(missing.readCorrect).toBe(0)
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
})

describe("read bin: active trace (walk the path)", () => {
  it("read-path (near): the asked pair A→D is reachable and is not a direct edge", () => {
    const s = advanceTo("read-path")
    expect(s.question!.pair).toEqual(["A", "D"])
    expect(pathExists(G6, "A", "D")).toBe(true)
    expect(hasEdge(G6, "A", "D")).toBe(false) // forces a real walk
    expect(canCheckGraphs(s)).toBe(false) // no Check on a trace
  })

  it("read-trace-far (far): the asked pair A→F is reachable and longer", () => {
    const s = advanceTo("read-trace-far")
    expect(s.question!.pair).toEqual(["A", "F"])
    expect(pathExists(G6, "A", "F")).toBe(true)
  })

  it("only neighbors of the current node are walkable; a non-neighbor tap nudges", () => {
    const s = advanceTo("read-path") // start A, neighbors B, C (read-list + read-degree already cleared)
    const before = s.readCorrect
    const jump = graphsReducer(s, { type: "select", letter: "D" }) // D is not A's neighbor
    expect(jump.feedback).toBe("nudge")
    expect(jump.trace!.path).toEqual(["A"]) // no walk happened
    expect(jump.readCorrect).toBe(before) // the read bin did not move
  })

  it("walking A→B→D reaches the target, grades the read bin, and climbs the combo", () => {
    const s = advanceTo("read-path")
    const before = s.readCorrect
    const stepB = graphsReducer(s, { type: "select", letter: "B" })
    expect(stepB.feedback).toBe("idle")
    expect(stepB.trace!.path).toEqual(["A", "B"])
    expect(stepB.readCorrect).toBe(before) // not yet at the target

    const stepD = graphsReducer(stepB, { type: "select", letter: "D" })
    expect(stepD.feedback).toBe("correct")
    expect(isTraceSolved(stepD.trace!)).toBe(true)
    expect(stepD.readCorrect).toBe(before + 1)
    expect(stepD.combo).toBe(s.combo + 1)
  })

  it("a trace never hits a fail wall: a wrong step only nudges, the walk persists", () => {
    const s = advanceTo("read-path")
    let cur = graphsReducer(s, { type: "select", letter: "B" }) // walk to B
    cur = graphsReducer(cur, { type: "select", letter: "F" }) // F is not B's neighbor
    expect(cur.feedback).toBe("nudge")
    cur = graphsReducer(cur, { type: "select", letter: "F" }) // wrong again, still a nudge
    expect(cur.feedback).toBe("nudge")
    expect(cur.trace!.path).toEqual(["A", "B"]) // unchanged by the wrong taps
    cur = graphsReducer(cur, { type: "select", letter: "D" }) // a legal step recovers
    expect(cur.feedback).toBe("correct")
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
      const a = edgeSet(d.adj!)
      const b = edgeSet(G6)
      const diff =
        [...a].filter((e) => !b.has(e)).length + [...b].filter((e) => !a.has(e)).length
      expect(diff).toBe(1)
      expect(sameGraph(d.adj!, G6)).toBe(false)
    }
  })

  it("picking the matching list is correct; a distractor nudges", () => {
    const s = advanceTo("match-list")
    expect(pick(s, "add-ad").feedback).toBe("nudge")
    expect(pick(s, "correct").feedback).toBe("correct")
  })
})

/* --------------------------------- draw bin --------------------------------- */

describe("draw bin: single undirected edge-draw (rewire normalized to a set)", () => {
  it("draw-edge: drawing {B,D} matches the data and clears the beat", () => {
    const s = advanceTo("draw-edge")
    expect(s.question!.missingEdge).toEqual(["B", "D"])
    expect(canCheckGraphs(s)).toBe(false)
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
    expect(graphsReducer(s, { type: "rewire", from: "B", to: "A" }).pendingEdge).toBeNull()
    expect(graphsReducer(s, { type: "rewire", from: "B", to: "Z" }).pendingEdge).toBeNull()
  })

  it("draw-edge: a legal-but-wrong edge nudges, then fails (counter untouched)", () => {
    const s = advanceTo("draw-edge")
    const wrong = draw(s, "B", "E")
    expect(wrong.feedback).toBe("nudge")
    expect(wrong.drawCorrect).toBe(0)
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

/* --------------------------------- build bin --------------------------------- */

describe("build bin: build-the-line synthesis (multi-edge, graded on sameGraph)", () => {
  it("starts as the active network and carries the plan", () => {
    const s = advanceTo("build-the-line")
    expect(s.question!.transit).toBe(true)
    expect(s.buildLine).not.toBeNull()
    expect(sameGraph(s.workingAdj, METRO_ACTIVE_ADJ)).toBe(true)
    expect(sameGraph(s.question!.planAdj!, METRO_PLAN_ADJ)).toBe(true)
    expect(canCheckGraphs(s)).toBe(false) // committed by drawing, not Check
  })

  it("an illegal track (not in the plan) nudges with no fail wall; the build persists", () => {
    const s = advanceTo("build-the-line")
    const wrong = graphsReducer(s, { type: "rewire", from: "A", to: "D" }) // not a plan edge
    expect(wrong.feedback).toBe("nudge")
    expect(sameGraph(wrong.workingAdj, METRO_ACTIVE_ADJ)).toBe(true) // unchanged
    expect(wrong.buildCorrect).toBe(0)
    // a real track recovers
    const right = graphsReducer(wrong, { type: "rewire", from: "D", to: "G" })
    expect(right.feedback).toBe("idle")
    expect(hasEdge(right.workingAdj, "D", "G")).toBe(true)
  })

  it("drawing all four missing tracks completes the network and grades the build bin once", () => {
    const s = advanceTo("build-the-line")
    const missing = missingPlanEdges(s.workingAdj, s.question!.planAdj!)
    expect(missing.length).toBe(4)

    let cur = s
    for (let i = 0; i < missing.length; i++) {
      const [u, v] = missing[i]
      cur = graphsReducer(cur, { type: "rewire", from: u, to: v })
      if (i < missing.length - 1) {
        expect(cur.feedback).toBe("idle") // not solved yet
        expect(cur.buildCorrect).toBe(0)
      }
    }
    expect(cur.feedback).toBe("correct")
    expect(cur.buildCorrect).toBe(1)
    expect(sameGraph(cur.workingAdj, METRO_PLAN_ADJ)).toBe(true)
  })
})

/* ------------------------- transit skin (decoration only) ------------------------- */

describe("transit skin: decoration only, verdicts read adjacency", () => {
  it("TRANSIT is 7 stations, 7 segments, one cycle (a general graph)", () => {
    expect(TRANSIT_NODES).toHaveLength(7)
    expect(edgeSet(TRANSIT).size).toBe(7)
    expect(isConnected(TRANSIT, TRANSIT_NODES)).toBe(true)
    expect(isTree(TRANSIT, TRANSIT_NODES)).toBe(false)
    expect(degree(TRANSIT, "C")).toBe(4)
  })

  it("scrambling either transit layout never changes a verdict (position-free)", () => {
    const scramble = (m: Record<string, { x: number; y: number }>) =>
      Object.fromEntries(Object.keys(m).map((k, i) => [k, { x: i * 17, y: 100 - i * 9 }]))
    const geo = scramble(TRANSIT_GEO_LAYOUT)
    const diagram = scramble(TRANSIT_DIAGRAM_LAYOUT)
    expect(Object.keys(geo).sort()).toEqual(TRANSIT_NODES)
    expect(Object.keys(diagram).sort()).toEqual(TRANSIT_NODES)
    expect(sameGraph(TRANSIT, TRANSIT)).toBe(true)
    const s = advanceTo("draw-transit")
    expect(sameGraph(draw(s, "C", "D").workingAdj, TRANSIT_DRAW_ADJ)).toBe(true)
  })

  it("same-graph (transit): 'same' is geo-vs-diagram identical, 'different' drops D-E", () => {
    const same = makeSameGraph("same", SEED).question
    expect(same.transit).toBe(true)
    expect(sameGraph(same.adj, same.adjB!)).toBe(true)
    expect(same.layout).not.toEqual(same.layoutB)
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

  it("same-graph: the seed-selected variant clears on its marked answer", () => {
    const s = advanceTo("same-graph")
    const answer = s.question!.answer
    const other = answer === "same" ? "different" : "same"
    expect(pick(s, other).feedback).toBe("nudge")
    expect(pick(s, answer).feedback).toBe("correct")
    expect(pick(s, answer).sameCorrect).toBe(1)
  })

  it("tree-or-not: the seed-selected variant clears on its marked answer", () => {
    const s = advanceTo("tree-or-not")
    const answer = s.question!.answer
    const other = answer === "tree" ? "graph" : "tree"
    expect(pick(s, other).feedback).toBe("nudge")
    expect(pick(s, answer).feedback).toBe("correct")
  })
})

/* --------------------------- curated variant rotation --------------------------- */

describe("curated variant rotation (seed-selected, layouts RNG-free)", () => {
  it("selectGraphVariant is deterministic and picks an in-pool variant", () => {
    for (const seed of [0, 1, 7, 12345, 99999]) {
      const a = selectGraphVariant(SAME_GRAPH_VARIANTS, seed)
      const b = selectGraphVariant(SAME_GRAPH_VARIANTS, seed)
      expect(a).toEqual(b)
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

  it("tree-or-not per-variant: 'graph' has a cycle, 'tree' is acyclic", () => {
    expect(makeTreeOrNot("graph", SEED).question.answer).toBe("graph")
    expect(isTree(makeTreeOrNot("graph", SEED).question.adj, G6_NODES)).toBe(false)
    expect(makeTreeOrNot("tree", SEED).question.answer).toBe("tree")
    expect(isTree(makeTreeOrNot("tree", SEED).question.adj, G6_NODES)).toBe(true)
  })

  it("layouts never depend on RNG, identical across two different seeds", () => {
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
  it("the gate totals read 5 / draw 2 / build 1 / same 2 = 10", () => {
    expect(READ_QUOTA).toBe(5)
    expect(DRAW_QUOTA).toBe(2)
    expect(BUILD_QUOTA).toBe(1)
    expect(SAME_QUOTA).toBe(2)
    expect(GATE_TOTAL).toBe(10)
  })

  it("partQuotaGraphs reports cumulative n of 10 on a graded beat, null on intro", () => {
    expect(partQuotaGraphs(createGraphs(SEED))).toBeNull() // demo
    const atRead = advanceTo("read-list")
    expect(partQuotaGraphs(atRead)).toEqual({ done: 0, total: GATE_TOTAL })
    const cleared = clearBeat(atRead) // read=1 → read-degree
    expect(partQuotaGraphs(cleared)).toEqual({ done: 1, total: GATE_TOTAL })
  })

  it("the gate flips only at 5 / 2 / 1 / 2 and the happy path reaches combo 10", () => {
    const s = playToEnd()
    expect(s.completed).toBe(true)
    expect(isCompleteGraphs(s)).toBe(true)
    expect(s.readCorrect).toBe(READ_QUOTA)
    expect(s.drawCorrect).toBe(DRAW_QUOTA)
    expect(s.buildCorrect).toBe(BUILD_QUOTA)
    expect(s.sameCorrect).toBe(SAME_QUOTA)
    expect(s.combo).toBe(GATE_TOTAL) // 10 consecutive correct, flame never broke
  })

  it("is incomplete until every bin is satisfied", () => {
    const base = createGraphs(SEED)
    expect(
      isCompleteGraphs({ ...base, readCorrect: 5, drawCorrect: 2, buildCorrect: 0, sameCorrect: 2 }),
    ).toBe(false)
    expect(
      isCompleteGraphs({ ...base, readCorrect: 5, drawCorrect: 2, buildCorrect: 1, sameCorrect: 1 }),
    ).toBe(false)
    expect(
      isCompleteGraphs({ ...base, readCorrect: 5, drawCorrect: 2, buildCorrect: 1, sameCorrect: 2 }),
    ).toBe(true)
  })

  it("is deterministic: same seed yields the same questions", () => {
    const a = advanceTo("match-list", SEED)
    const b = advanceTo("match-list", SEED)
    expect(a.question!.options.map((o) => o.id)).toEqual(b.question!.options.map((o) => o.id))
    expect(a.question!.answerSet).toEqual(b.question!.answerSet)
  })

  it("round-trips progress (including build) and resumes cold", () => {
    const done = playToEnd()
    const progress = toProgressGraphs(done)
    expect(progress.counters).toMatchObject({ read: 5, draw: 2, build: 1, same: 2 })
    expect(progress.completed).toBe(true)
    expect(resumeGraphs(progress, SEED).completed).toBe(true)
  })

  it("resumes on the same beat with a cold combo and no working state", () => {
    let s = advanceTo("read-degree")
    s = clearBeat(s) // read-degree done → read-path (trace); read=2
    const progress = toProgressGraphs(s)
    expect(progress.counters).toMatchObject({ read: 2, draw: 0, build: 0, same: 0 })
    expect(progress.currentPart).toBe<GraphsPart>("read-path")

    const resumed = resumeGraphs(progress, SEED)
    expect(currentPartGraphs(resumed)).toBe<GraphsPart>("read-path")
    expect(resumed.readCorrect).toBe(2)
    expect(resumed.combo).toBe(0) // flame is transient, cold on resume
    expect(resumed.trace!.path).toEqual(["A"]) // a fresh trace, nothing walked
    expect(resumed.pendingEdge).toBeNull()
  })

  it("resumes a build beat with the active network freshly re-seeded", () => {
    const progress = {
      counters: { read: 5, draw: 2, build: 0, same: 0, attempts: 0 },
      currentPart: "build-the-line",
      completed: false,
    }
    const resumed = resumeGraphs(progress, SEED)
    expect(currentPartGraphs(resumed)).toBe<GraphsPart>("build-the-line")
    expect(resumed.buildLine).not.toBeNull()
    expect(sameGraph(resumed.workingAdj, METRO_ACTIVE_ADJ)).toBe(true)
  })
})
