import {
  gradeAnswer,
  type Feedback,
  type LessonAction,
  type LessonProgress,
} from "@/features/lesson/engine"
import {
  METRO_ACTIVE_ADJ,
  METRO_PLAN_ADJ,
  METRO_PLAN_LAYOUT,
  METRO_PLAN_NODES,
  TRANSIT_DIAGRAM_LAYOUT,
  TRANSIT_DRAW_LAYOUT,
  TRANSIT_FULL_DIAGRAM_LAYOUT,
  TRANSIT_FULL_GEO_LAYOUT,
  TRANSIT_GEO_LAYOUT,
} from "@/lessons/graphs/transitData"

/**
 * Pure, framework-agnostic Graphs lesson engine. One idea: a graph is arbitrary
 * connections (no root, no hierarchy, cycles allowed), and the **adjacency list
 * is the data; the picture is just decoration**. Every verdict is a pure
 * function of a symmetric adjacency map; node positions never enter a verdict
 * (that property *is* the lesson). Edge-drawing consumes the shared rewire infra:
 * a node is BOTH source and target, a drag A→B emits `rewire {from,to}`, and the
 * undirected normalization lives here (it adds the edge to both rows).
 *
 * Fourteen beats, ten graded behind the until-correct wall, aggregated into a
 * read 5 / draw 2 / build 1 / same 2 gate. Two of the reads are active TRACES
 * (walk the edges node to node; reaching the target is the verdict, which is
 * possible exactly when `pathExists`); the build beat is a multi-edge synthesis
 * (draw the missing tracks until the working network matches the `METRO_PLAN`
 * ghost, graded on `sameGraph`). Both active mechanics are gated to legal moves
 * (only neighbors are walkable; only un-built plan edges are drawable) and a wrong
 * move is a brief nudge with no fail wall, mirroring the Heaps do-the-sift pilot.
 * Reuses the shared feedback machine + flame (`gradeAnswer`) and the durable
 * LessonProgress shape; only the graph model, verdicts, and quotas are
 * Graphs-specific. Deterministic (seeded): same state always yields the same
 * question/feedback.
 */

export const GRAPHS_PARTS = [
  "demo", // 1  intro: drag a node, nothing changes; tap a node lights its list
  "teach", // 2  teach: adjacency is the data; a graph is not a tree
  "read-list", // 3  tap C's connection list (multi-select)              Read  ✓
  "read-degree", // 4  tap D's neighbors; degree = count (multi-select)    Read  ✓
  "read-path", // 5  TRACE: walk A→D, neighbor by neighbor (near)         Read  ✓
  "read-trace-far", // 6  TRACE: walk A→F, neighbor by neighbor (far)      Read  ✓
  "match-list", // 7  which adjacency list matches? (MCQ)                  Read  ✓
  "draw-demo", // 8  intro: draw an edge, watch the list gain a neighbor
  "draw-edge", // 9  draw the one missing edge (rewire)                   Draw  ✓
  "draw-transit", // 10 transit skin: add the missing connection (rewire) Draw  ✓
  "build-the-line", // 11 BUILD: draw the missing tracks toward the plan   Build ✓
  "redraw-demo", // 12 teach: same graph snaps to a new layout, list still
  "same-graph", // 13 same graph? moved-node (same) / one-edge (diff)     Same  ✓
  "tree-or-not", // 14 tree or general graph? (spot the cycle)            Same  ✓
] as const
export type GraphsPart = (typeof GRAPHS_PARTS)[number]
export const GRAPHS_TOTAL_PARTS = GRAPHS_PARTS.length

/** Correct answers required per bin to clear the gate (read 5 / draw 2 / build 1 / same 2 = 10). */
export const READ_QUOTA = 5
export const DRAW_QUOTA = 2
export const BUILD_QUOTA = 1
export const SAME_QUOTA = 2
export const GATE_TOTAL = READ_QUOTA + DRAW_QUOTA + BUILD_QUOTA + SAME_QUOTA

export type GraphBin = "read" | "draw" | "build" | "same"
/** How the learner answers a beat. */
export type GraphMode =
  | "intro"
  | "multiselect"
  | "trace"
  | "mcq"
  | "draw"
  | "build"
  | "classify"

export type NodeId = string // "A".."H"
export type Adjacency = Record<NodeId, NodeId[]> // kept SYMMETRIC
export type Edge = readonly [NodeId, NodeId] // normalized so a <= b
export interface Pt {
  x: number
  y: number
}

export interface GraphOption {
  id: string
  label: string
  /** match-list options carry a full adjacency for rich rendering. */
  adj?: Adjacency
}

export interface GraphsQuestion {
  kind: GraphsPart
  bin: GraphBin | null
  mode: GraphMode
  prompt: string
  nodes: NodeId[] // the beat's labels (4-6 of A..H)
  adj: Adjacency // the canonical (correct) symmetric adjacency
  shownAdj?: Adjacency // draw beats: the picture's adjacency (missing one edge)
  markedNodes?: NodeId[] // read beats: the asked node / the (X,Y) pair to ring
  pair?: readonly [NodeId, NodeId] // trace: the (start, target) to walk between
  missingEdge?: Edge // draw beats: the one correct edge to add
  planAdj?: Adjacency // build-the-line: the complete plan to grow the network toward
  adjB?: Adjacency // same-graph: the second layout's adjacency
  layout: Record<NodeId, Pt> // PRESENTATIONAL only. Never read by a verdict
  layoutB?: Record<NodeId, Pt> // same-graph / redraw: the alternate layout
  options: GraphOption[] // mcq / classify choices
  answer: string // winning option id (mcq / classify); else ""
  answerSet?: NodeId[] // multiselect: the correct neighbor set
  transit?: boolean // draw-transit skin flag
  hint: string
  nudge: string
  correct: string
  why: string
}

export interface GraphsState {
  seed: number
  rngState: number
  partIndex: number
  readCorrect: number // 0..5
  drawCorrect: number // 0..2
  buildCorrect: number // 0..1
  sameCorrect: number // 0..2
  attempts: number
  question: GraphsQuestion | null
  // working state (TRANSIENT, never persisted):
  selectedNodes: NodeId[] // multi-select read set (toggled by `select`)
  selected: string | null // mcq option | same/different | tree/graph
  pendingEdge: Edge | null // draw beat: the single drawn edge (or the just-built track)
  workingAdj: Adjacency // draw / build beat: the figure's live adjacency
  /**
   * The live TRACE working model on the active read-path beats (the learner walks
   * adjacent nodes). Null on every other beat. Rebuilt by `enterPart`/`resume`
   * from the curated question, never persisted (like the Heaps `sift` beat).
   */
  trace: TraceBeat | null
  /**
   * The live BUILD-the-line working model (the learner draws the missing plan
   * edges). Null on every other beat. Rebuilt by `enterPart`/`resume`, never
   * persisted (like the Heaps `build` beat).
   */
  buildLine: BuildLineBeat | null
  wrongCount: number
  feedback: Feedback
  revealed: boolean
  showWhy: boolean
  combo: number
  completed: boolean
}

/* --------------------------- pure adjacency helpers --------------------------- */

/** An undirected edge as an ordered tuple (`a <= b`) so `{A,B}` ≡ `{B,A}`. */
export const normalizeEdge = (u: NodeId, v: NodeId): Edge => (u <= v ? [u, v] : [v, u])
/** A canonical string key for an undirected edge. */
export const edgeKey = (u: NodeId, v: NodeId): string => normalizeEdge(u, v).join("-")

/** Symmetric neighbor read, sorted (order-independent for verdicts). */
export const neighbors = (adj: Adjacency, n: NodeId): NodeId[] => [...(adj[n] ?? [])].sort()
/** A node's degree = the size of its neighbor set. */
export const degree = (adj: Adjacency, n: NodeId): number => (adj[n] ?? []).length
/** Is there a direct edge between `u` and `v`? */
export const hasEdge = (adj: Adjacency, u: NodeId, v: NodeId): boolean =>
  (adj[u] ?? []).includes(v)

/** The undirected edge set of an adjacency (each {u,v} once): the canonical identity. */
export function edgeSet(adj: Adjacency): Set<string> {
  const s = new Set<string>()
  for (const u of Object.keys(adj)) for (const v of adj[u]) s.add(edgeKey(u, v))
  return s
}

/** The sorted, de-duped undirected edge list (for drawing the picture). */
export function edgeList(adj: Adjacency): Edge[] {
  const seen = new Set<string>()
  const edges: Edge[] = []
  for (const u of Object.keys(adj)) {
    for (const v of adj[u]) {
      const k = edgeKey(u, v)
      if (seen.has(k)) continue
      seen.add(k)
      edges.push(normalizeEdge(u, v))
    }
  }
  return edges
}

/** Add an undirected edge to BOTH rows (idempotent, sorted). Returns a new map. */
export function addEdge(adj: Adjacency, u: NodeId, v: NodeId): Adjacency {
  const next: Adjacency = cloneAdj(adj)
  next[u] ??= []
  next[v] ??= []
  if (!next[u].includes(v)) next[u] = [...next[u], v].sort()
  if (!next[v].includes(u)) next[v] = [...next[v], u].sort()
  return next
}

/** Remove an undirected edge from BOTH rows (keeps every node row). Returns a new map. */
export function removeEdge(adj: Adjacency, u: NodeId, v: NodeId): Adjacency {
  const next: Adjacency = {}
  for (const k of Object.keys(adj)) {
    next[k] = adj[k].filter(
      (x) => !((k === u && x === v) || (k === v && x === u)),
    )
  }
  return next
}

/** A deep-ish copy (new row arrays) so the canonical fixtures are never mutated. */
export function cloneAdj(adj: Adjacency): Adjacency {
  const out: Adjacency = {}
  for (const k of Object.keys(adj)) out[k] = [...adj[k]]
  return out
}

/** Reachability (BFS over adjacency): internal; the learner predicts yes/no only. */
export function reachable(adj: Adjacency, start: NodeId): Set<NodeId> {
  const seen = new Set<NodeId>([start])
  const queue = [start]
  while (queue.length) {
    const n = queue.shift() as NodeId
    for (const m of adj[n] ?? []) {
      if (!seen.has(m)) {
        seen.add(m)
        queue.push(m)
      }
    }
  }
  return seen
}

export const pathExists = (adj: Adjacency, a: NodeId, b: NodeId): boolean =>
  reachable(adj, a).has(b)

export const isConnected = (adj: Adjacency, nodes: NodeId[]): boolean =>
  nodes.length === 0 || reachable(adj, nodes[0]).size === nodes.length

/** A connected undirected graph is a tree iff |edges| === |nodes| − 1 (i.e. acyclic). */
export const isTree = (adj: Adjacency, nodes: NodeId[]): boolean =>
  isConnected(adj, nodes) && edgeSet(adj).size === nodes.length - 1

/** Set equality for the multi-select read verdict (order-independent). */
export function setEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const s = new Set(a)
  return b.every((x) => s.has(x))
}

function setEqualStr(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x))
}

/** Two graphs are the SAME iff their edge sets are equal: provably position-free. */
export const sameGraph = (a: Adjacency, b: Adjacency): boolean =>
  setEqualStr(edgeSet(a), edgeSet(b))

/* ----------------------------- trace (active read-path) ----------------------------- */

/**
 * The live state of an active "trace the path" beat, where the learner walks the
 * graph node to node instead of answering yes/no. It pairs the adjacency with the
 * asked (start, target) and the ordered walk so far (`path`, which always begins at
 * `start`). Pure: `applyTraceStep` accepts only a step to a *neighbor of the current
 * node* and returns a fresh beat; an illegal step is rejected and the beat is
 * returned untouched. Reaching the target settles it, which is possible exactly when
 * `pathExists(adj, start, target)`, so the verdict still reads connectivity, walked
 * by hand. Walking teaches traversal: every step is a fresh read of the current
 * node's row (the adjacency list is the data, even here).
 */
export interface TraceBeat {
  /** The graph being walked (a copy, never mutated). */
  adj: Adjacency
  /** Where the walk starts. */
  start: NodeId
  /** The node the walk is trying to reach. */
  target: NodeId
  /** The ordered walk so far; `path[0] === start`, last entry is the current node. */
  path: NodeId[]
}

/** Open a trace beat at the start node (nothing walked yet). */
export function traceBeatFrom(adj: Adjacency, start: NodeId, target: NodeId): TraceBeat {
  return { adj: cloneAdj(adj), start, target, path: [start] }
}

/** The node the walk currently sits on (the last step). */
export function traceCurrent(beat: TraceBeat): NodeId {
  return beat.path[beat.path.length - 1]
}

/** The nodes the learner may step to next: exactly the current node's neighbors. */
export function legalTraceTargets(beat: TraceBeat): Set<NodeId> {
  return new Set(neighbors(beat.adj, traceCurrent(beat)))
}

/** Is `n` a legal next step (a neighbor of the current node)? */
export function isLegalTraceStep(beat: TraceBeat, n: NodeId): boolean {
  return hasEdge(beat.adj, traceCurrent(beat), n)
}

/**
 * Validate a learner-proposed step. If `n` is a neighbor of the current node, walk
 * to it (a fresh beat, `accepted: true`); otherwise reject it and return the SAME
 * beat (`accepted: false`). Re-stepping onto an already-visited neighbor is allowed
 * (a backtrack), so the walk can never get stuck before reaching the target. Never
 * mutates the input.
 */
export function applyTraceStep(beat: TraceBeat, n: NodeId): { beat: TraceBeat; accepted: boolean } {
  if (!isLegalTraceStep(beat, n)) return { beat, accepted: false }
  return { beat: { ...beat, path: [...beat.path, n] }, accepted: true }
}

/** The beat is solved once the walk reaches the target (a path was traced). */
export function isTraceSolved(beat: TraceBeat): boolean {
  return traceCurrent(beat) === beat.target
}

/** The undirected edges walked so far (consecutive pairs), for lighting the trail. */
export function tracePathEdges(beat: TraceBeat): Edge[] {
  const edges: Edge[] = []
  for (let i = 0; i < beat.path.length - 1; i++) {
    edges.push(normalizeEdge(beat.path[i], beat.path[i + 1]))
  }
  return edges
}

/* ----------------------------- build-the-line (active synthesis) ----------------------------- */

/**
 * The live state of an active "build the line" synthesis, where the learner draws
 * several missing tracks to grow the working network until it matches the complete
 * PLAN. It pairs the plan (the greyed-out ghost) with the working network built so
 * far. Pure: `applyBuildLineEdge` accepts only an un-built *plan* edge and returns a
 * fresh beat; any other edge (already built, or not in the plan) is rejected and the
 * beat is returned untouched. It is solved once `sameGraph(working, plan)` holds, so
 * the verdict reads adjacency, never positions. The Graphs analog of the Heaps ER
 * synthesis / Linked Lists playlist: one graded slot, many drawn steps.
 */
export interface BuildLineBeat {
  /** The complete plan to build toward (a copy, never mutated). */
  planAdj: Adjacency
  /** Every station in the plan (so the figure can render the un-built ones too). */
  planNodes: NodeId[]
  /** The network drawn so far (starts as the active network, grows per edge). */
  working: Adjacency
}

/** Open a build-the-line beat from the active network, toward the plan. */
export function buildLineBeatFrom(
  activeAdj: Adjacency,
  planAdj: Adjacency,
  planNodes: NodeId[],
): BuildLineBeat {
  return { planAdj: cloneAdj(planAdj), planNodes: [...planNodes], working: cloneAdj(activeAdj) }
}

/** The plan edges not yet built (the gap the learner still has to draw). */
export function missingPlanEdges(working: Adjacency, planAdj: Adjacency): Edge[] {
  const built = edgeSet(working)
  return edgeList(planAdj).filter((e) => !built.has(edgeKey(e[0], e[1])))
}

/** Is `(u,v)` a legal build move: a plan edge that is not built yet (and not a self-loop)? */
export function isLegalBuildEdge(beat: BuildLineBeat, u: NodeId, v: NodeId): boolean {
  if (u === v) return false
  if (!hasEdge(beat.planAdj, u, v)) return false // not part of the plan
  if (hasEdge(beat.working, u, v)) return false // already built
  return true
}

/**
 * Validate a learner-proposed track. If `(u,v)` is an un-built plan edge, draw it
 * into the working network (a fresh beat, `accepted: true`); otherwise reject it and
 * return the SAME beat (`accepted: false`). Never mutates the input.
 */
export function applyBuildLineEdge(
  beat: BuildLineBeat,
  u: NodeId,
  v: NodeId,
): { beat: BuildLineBeat; accepted: boolean } {
  if (!isLegalBuildEdge(beat, u, v)) return { beat, accepted: false }
  return { beat: { ...beat, working: addEdge(beat.working, u, v) }, accepted: true }
}

/** The build is solved once the working network's edge set equals the plan's. */
export function isBuildLineSolved(beat: BuildLineBeat): boolean {
  return sameGraph(beat.working, beat.planAdj)
}

/* ----------------------------- deterministic rng ----------------------------- */

function rngNext(a: number): { value: number; next: number } {
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { value, next: a }
}

function shuffle<T>(arr: T[], seed: number): { result: T[]; next: number } {
  const result = arr.slice()
  let a = seed
  for (let i = result.length - 1; i > 0; i--) {
    const r = rngNext(a)
    a = r.next
    const j = Math.floor(r.value * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return { result, next: a }
}

/* ------------------------------ part predicates ------------------------------ */

export const isIntroPart = (part: GraphsPart): boolean =>
  part === "demo" || part === "teach" || part === "draw-demo" || part === "redraw-demo"
export const isMultiSelectPart = (part: GraphsPart): boolean =>
  part === "read-list" || part === "read-degree"
/** The active trace reads: the learner walks the edges to find the path. */
export const isTracePart = (part: GraphsPart): boolean =>
  part === "read-path" || part === "read-trace-far"
/** Beats that accept a `rewire` gesture (the two graded draws, the demo, the build). */
export const isDrawPart = (part: GraphsPart): boolean =>
  part === "draw-demo" || part === "draw-edge" || part === "draw-transit"
/** The two single-edge graded draws (the demo draws but is never checked). */
export const isGradedDrawPart = (part: GraphsPart): boolean =>
  part === "draw-edge" || part === "draw-transit"
/** The multi-edge build-the-line synthesis (drawn, never checked). */
export const isBuildLinePart = (part: GraphsPart): boolean => part === "build-the-line"
export const isSingleChoicePart = (part: GraphsPart): boolean =>
  part === "match-list" || part === "same-graph" || part === "tree-or-not"

export function binOfPart(part: GraphsPart): GraphBin | null {
  if (
    part === "read-list" ||
    part === "read-degree" ||
    part === "read-path" ||
    part === "read-trace-far" ||
    part === "match-list"
  )
    return "read"
  if (part === "draw-edge" || part === "draw-transit") return "draw"
  if (part === "build-the-line") return "build"
  if (part === "same-graph" || part === "tree-or-not") return "same"
  return null
}

/* ------------------------------ curated graph pool ------------------------------ */

export const G6_NODES: NodeId[] = ["A", "B", "C", "D", "E", "F"]

/**
 * Base graph G6: 6 nodes, 7 edges, connected, has a cycle (A-B-C) ⇒ a general
 * graph, not a tree. The worked-values fixture the build (and tests) grade on.
 */
export const G6: Adjacency = {
  A: ["B", "C"],
  B: ["A", "C", "D"],
  C: ["A", "B", "E"],
  D: ["B", "E"],
  E: ["C", "D", "F"],
  F: ["E"],
}

/** Tree variant T6: 6 nodes, 5 edges (= nodes − 1), connected ⇒ a tree. */
export const T6: Adjacency = {
  A: ["B", "C"],
  B: ["A"],
  C: ["A", "D", "E"],
  D: ["C"],
  E: ["C", "F"],
  F: ["E"],
}

export const TRANSIT_NODES: NodeId[] = ["A", "B", "C", "D", "E", "F", "G"]
/**
 * Transit network (the subway skin's data): a 5-station loop line (A-B-C-D-E-A)
 * plus a short branch (F-C-G) meeting at the Central interchange (C). 7 stations,
 * 7 segments, exactly one cycle, so it stays a general graph (not a tree). The
 * draw beat restores the loop-closing A-E segment. Undirected and symmetric; the
 * coordinates that draw it live in transitData (decoration), never here.
 */
export const TRANSIT: Adjacency = {
  A: ["B", "E"],
  B: ["A", "C"],
  C: ["B", "D", "F", "G"],
  D: ["C", "E"],
  E: ["A", "D"],
  F: ["C"],
  G: ["C"],
}

export const TRANSIT_DRAW_NODES: NodeId[] = ["A", "B", "C", "D", "E", "F", "G"]
/**
 * The draw-transit problem network (the validated "route the missing track"
 * question, tuned in the gallery): a loop A-B-C-D-E-A with a Red branch to F off
 * B and a Green branch to G off D, three crossing lines, with the C-D segment
 * missing. 7 stations, one cycle, so it stays a general graph (not a tree). The
 * draw beat restores C-D. Its coordinates + routes live in transitData.
 */
export const TRANSIT_DRAW_ADJ: Adjacency = {
  A: ["B", "E"],
  B: ["A", "C", "F"],
  C: ["B", "D"],
  D: ["C", "E", "G"],
  E: ["A", "D"],
  F: ["B"],
  G: ["D"],
}

export const TRANSIT_FULL_NODES: NodeId[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
/**
 * The fuller showcase network for the redraw demo (the "live example"): the same
 * Harbor loop + Park branch, plus a Garden branch (G-H-I) and a Sun cross-line
 * (E-J-F). 10 stations, 11 segments, four routes, still a compact route list.
 * Decoration-only, like TRANSIT; no graded beat reads it.
 */
export const TRANSIT_FULL: Adjacency = {
  A: ["B", "E"],
  B: ["A", "C"],
  C: ["B", "D", "F", "G"],
  D: ["C", "E"],
  E: ["A", "D", "J"],
  F: ["C", "J"],
  G: ["C", "H"],
  H: ["G", "I"],
  I: ["H"],
  J: ["E", "F"],
}

/* -------------------------------- layout maps -------------------------------- */

/** Hand-authored positions (presentational only: no verdict reads them). */
const G6_LAYOUT: Record<NodeId, Pt> = {
  A: { x: 60, y: 50 },
  B: { x: 170, y: 44 },
  C: { x: 116, y: 120 },
  D: { x: 226, y: 130 },
  E: { x: 150, y: 200 },
  F: { x: 44, y: 150 },
}

const T6_LAYOUT: Record<NodeId, Pt> = {
  A: { x: 140, y: 38 },
  B: { x: 72, y: 120 },
  C: { x: 208, y: 120 },
  D: { x: 150, y: 200 },
  E: { x: 244, y: 196 },
  F: { x: 244, y: 96 },
}

const DRAW_DEMO_NODES: NodeId[] = ["A", "B", "C", "D"]
const DRAW_DEMO_LAYOUT: Record<NodeId, Pt> = {
  A: { x: 80, y: 70 },
  B: { x: 200, y: 70 },
  C: { x: 200, y: 180 },
  D: { x: 80, y: 180 },
}

/* ------------------------------ question makers ------------------------------ */

const BASE: Omit<GraphsQuestion, "kind"> = {
  bin: null,
  mode: "intro",
  prompt: "",
  nodes: [],
  adj: {},
  layout: {},
  options: [],
  answer: "",
  hint: "",
  nudge: "",
  correct: "",
  why: "",
}

function baseQuestion(kind: GraphsPart, over: Partial<GraphsQuestion>): GraphsQuestion {
  return { ...BASE, kind, ...over }
}

const sameOptions = (): GraphOption[] => [
  { id: "same", label: "Same graph" },
  { id: "different", label: "Different graph" },
]
const treeOptions = (): GraphOption[] => [
  { id: "tree", label: "Tree" },
  { id: "graph", label: "General graph" },
]

/** A compact one-line adjacency rendering (SR text + match-list fallback label). */
function adjLabel(adj: Adjacency, nodes: NodeId[]): string {
  return nodes
    .map((n) => `${n}: ${neighbors(adj, n).join(", ") || "(none)"}`)
    .join("   ·   ")
}

function makeDemo(): GraphsQuestion {
  return baseQuestion("demo", {
    prompt: "Drag a node anywhere. The picture moves. The data doesn't.",
    nodes: G6_NODES,
    adj: G6,
    layout: G6_LAYOUT,
    hint: "",
  })
}

function makeTeach(): GraphsQuestion {
  return baseQuestion("teach", {
    prompt:
      "The adjacency list is the data; the picture is decoration. A graph has no root and may have cycles. That's how it's not a tree.",
    nodes: G6_NODES,
    adj: G6,
    layout: G6_LAYOUT,
  })
}

function makeReadList(): GraphsQuestion {
  const focus: NodeId = "C"
  const set = neighbors(G6, focus)
  return baseQuestion("read-list", {
    bin: "read",
    mode: "multiselect",
    prompt: `Tap everyone in ${focus}'s connection list.`,
    nodes: G6_NODES,
    adj: G6,
    layout: G6_LAYOUT,
    markedNodes: [focus],
    answerSet: set,
    hint: "",
    nudge: `Re-read ${focus}'s row. Tap exactly the nodes listed there, no more, no less.`,
    correct: `${focus} connects to ${set.join(", ")}.`,
    why: `${focus}'s row in the data is ${set.join(", ")}. That's its connection list, whatever the picture looks like.`,
  })
}

function makeReadDegree(): GraphsQuestion {
  const focus: NodeId = "D"
  const set = neighbors(G6, focus)
  return baseQuestion("read-degree", {
    bin: "read",
    mode: "multiselect",
    prompt: `Tap ${focus}'s neighbors. Its degree is how many?`,
    nodes: G6_NODES,
    adj: G6,
    layout: G6_LAYOUT,
    markedNodes: [focus],
    answerSet: set,
    hint: "",
    nudge: `Count only ${focus}'s direct connections. Tap exactly those nodes.`,
    correct: `${focus} has degree ${set.length}. It connects to ${set.join(", ")}.`,
    why: `${focus}'s row is ${set.join(", ")}, so its degree is the size of that set. The answer is ${set.length}.`,
  })
}

/**
 * The active TRACE reads (`read-path` near, `read-trace-far` far): the learner
 * walks G6 node to node from the start to the target. The pairs are curated to be
 * reachable (`pathExists` is asserted in tests), so the walk can always be
 * completed; reaching the target is the verdict. The near beat (A→D) is a short
 * two-hop, the far beat (A→F) a longer three-hop, so the second trace ramps the
 * traversal up. No yes/no options: the walk itself is the answer.
 */
function makeTrace(part: "read-path" | "read-trace-far"): GraphsQuestion {
  const pair: Edge = part === "read-path" ? ["A", "D"] : ["A", "F"]
  const [start, target] = pair
  return baseQuestion(part, {
    bin: "read",
    mode: "trace",
    prompt: `Trace a path from ${start} to ${target}. Tap a neighbor to step there.`,
    nodes: G6_NODES,
    adj: G6,
    layout: G6_LAYOUT,
    pair,
    markedNodes: [start, target],
    hint: "",
    nudge: `You can only step to a node listed in the current node's row. Re-read that row.`,
    correct: `You reached ${target}. A path exists from ${start}.`,
    why: `Walking the edges from ${start} reaches ${target}, so a path exists, even though they are not directly connected. Each step reads the current node's row, so traversal is just repeated reads of the list.`,
  })
}

/**
 * The build-the-line synthesis (`build-the-line`, the new build bin): the learner
 * draws the missing tracks to grow the active network until it matches the complete
 * `METRO_PLAN`. The plan is the greyed-out ghost; the active network starts colored.
 * Graded on `sameGraph(working, plan)` after every missing edge is drawn. The whole
 * plan's stations are tappable so a planned-but-unbuilt station can be wired in.
 */
function makeBuildLine(): GraphsQuestion {
  return baseQuestion("build-the-line", {
    bin: "build",
    mode: "build",
    transit: true,
    prompt: "Finish the network by drawing the missing tracks so the live map matches the plan.",
    nodes: METRO_PLAN_NODES,
    adj: METRO_PLAN_ADJ,
    shownAdj: METRO_ACTIVE_ADJ,
    planAdj: METRO_PLAN_ADJ,
    layout: METRO_PLAN_LAYOUT,
    hint: "Each grey link in the plan with no color yet is a track to lay. Drag between its two stations.",
    nudge: "That pair is not in the plan, or it is already running. Lay a greyed-out link instead.",
    correct: "The live map now matches the plan. Every line is in service.",
    why: "Every greyed-out link in the plan is now drawn and colored, so the working network's connections match the plan exactly. Layout never entered it; the route list did.",
  })
}

function makeMatchList(seed: number): { question: GraphsQuestion; next: number } {
  const options: GraphOption[] = [
    { id: "correct", label: adjLabel(G6, G6_NODES), adj: cloneAdj(G6) },
    {
      id: "add-ad",
      label: adjLabel(addEdge(G6, "A", "D"), G6_NODES),
      adj: addEdge(G6, "A", "D"),
    },
    {
      id: "drop-ce",
      label: adjLabel(removeEdge(G6, "C", "E"), G6_NODES),
      adj: removeEdge(G6, "C", "E"),
    },
    {
      id: "add-bf",
      label: adjLabel(addEdge(G6, "B", "F"), G6_NODES),
      adj: addEdge(G6, "B", "F"),
    },
  ]
  const { result, next } = shuffle(options, seed)
  return {
    question: baseQuestion("match-list", {
      bin: "read",
      mode: "mcq",
      prompt: "Which adjacency list matches this picture?",
      nodes: G6_NODES,
      adj: G6,
      layout: G6_LAYOUT,
      options: result,
      answer: "correct",
      hint: "",
      nudge: "Check each row against the picture. One wrong neighbor means the wrong list.",
      correct: "That list is the picture's exact connection set.",
      why: "Every row matches the picture's edges. Each distractor changes exactly one real connection.",
    }),
    next,
  }
}

function makeDrawDemo(): GraphsQuestion {
  const shown: Adjacency = { A: ["B"], B: ["A", "C"], C: ["B"], D: [] }
  return baseQuestion("draw-demo", {
    mode: "draw",
    prompt: "Drag from one node to another to draw an edge. Watch the list gain a neighbor.",
    nodes: DRAW_DEMO_NODES,
    adj: shown,
    shownAdj: shown,
    layout: DRAW_DEMO_LAYOUT,
    hint: "",
  })
}

function makeDrawEdge(): GraphsQuestion {
  const shown = removeEdge(G6, "B", "D")
  return baseQuestion("draw-edge", {
    bin: "draw",
    mode: "draw",
    prompt: "The list is the data. Draw the one edge the picture is missing.",
    nodes: G6_NODES,
    adj: G6,
    shownAdj: shown,
    missingEdge: normalizeEdge("B", "D"),
    layout: G6_LAYOUT,
    hint: "",
    nudge: "One row in the list has a neighbor the picture doesn't show. Draw that edge.",
    correct: "B–D drawn. The picture now matches the data.",
    why: "The list connects B and D, but the picture didn't. Drawing B–D adds each to the other's row.",
  })
}

function makeDrawTransit(): GraphsQuestion {
  const shown = removeEdge(TRANSIT_DRAW_ADJ, "C", "D")
  return baseQuestion("draw-transit", {
    bin: "draw",
    mode: "draw",
    transit: true,
    prompt:
      "The route list is the plan. One stop pair is in the list but not laid on the map yet, drag between those stops to route it.",
    nodes: TRANSIT_DRAW_NODES,
    adj: TRANSIT_DRAW_ADJ,
    shownAdj: shown,
    missingEdge: normalizeEdge("C", "D"),
    layout: TRANSIT_DRAW_LAYOUT,
    hint: "Compare the plan to the map, then drag between the two stops.",
    nudge: "That pair is not in the plan. Re-check the route list.",
    correct: "Routed. C and D are now in service.",
    why: "The route list connects C and D, but the map had not laid that track yet; drawing C-D adds each to the other's row.",
  })
}

function makeRedrawDemo(): GraphsQuestion {
  // The live showcase: a fuller four-line network so the metro look reads, but a
  // route list short enough to still scan. Decoration only (never graded).
  return baseQuestion("redraw-demo", {
    transit: true,
    prompt:
      "Watch the map become a clean diagram. Stations slide, lines re-bend, the route list never moves.",
    nodes: TRANSIT_FULL_NODES,
    adj: TRANSIT_FULL,
    layout: TRANSIT_FULL_GEO_LAYOUT,
    layoutB: TRANSIT_FULL_DIAGRAM_LAYOUT,
  })
}

/* ------------------------------ variant rotation ------------------------------ */

export type SameGraphVariant = "same" | "different"
export type TreeOrNotVariant = "graph" | "tree"

/**
 * Curated variant pools for the two classify beats. Both entries are
 * hand-authored, deterministic instances (their layouts live as constants keyed
 * by variant, so positions never depend on RNG); the seed only chooses which
 * curated instance to show, so the beat rotates "same"/"different" and
 * "graph"/"tree" across runs without ever fabricating a layout.
 */
export const SAME_GRAPH_VARIANTS: readonly SameGraphVariant[] = ["same", "different"]
export const TREE_OR_NOT_VARIANTS: readonly TreeOrNotVariant[] = ["graph", "tree"]

/** Seed-select one curated variant; returns the advanced rng so option-shuffle stays deterministic. */
export function selectGraphVariant<T>(
  pool: readonly T[],
  seed: number,
): { variant: T; next: number } {
  const { value, next } = rngNext(seed)
  return { variant: pool[Math.floor(value * pool.length)], next }
}

export function makeSameGraph(
  variant: SameGraphVariant,
  seed: number,
): { question: GraphsQuestion; next: number } {
  // Both panels render the SAME transit network: the first as a geographic map,
  // the second as the clean diagram. "same" keeps the route set identical (only
  // the layout differs); "different" drops the D-E segment. The verdict reads
  // adjacency, so the wildly different pictures never decide it.
  const adjB = variant === "same" ? cloneAdj(TRANSIT) : removeEdge(TRANSIT, "D", "E")
  const same = sameGraph(TRANSIT, adjB)
  const { result, next } = shuffle(sameOptions(), seed)
  return {
    question: baseQuestion("same-graph", {
      bin: "same",
      mode: "classify",
      transit: true,
      prompt: "One is the street map, one is the clean diagram. Same network?",
      nodes: TRANSIT_NODES,
      adj: TRANSIT,
      adjB,
      layout: TRANSIT_GEO_LAYOUT,
      layoutB: TRANSIT_DIAGRAM_LAYOUT,
      options: result,
      answer: same ? "same" : "different",
      hint: "",
      nudge: "Ignore where the stations sit. Check whether the same pairs of stations connect.",
      correct: same
        ? "Same network. The connections match, and only the layout changed."
        : "Different. One connection changed, so it is a different network.",
      why: same
        ? "Both maps have the identical set of segments; bending the map into a diagram never changes the network."
        : "The diagram is missing the D to E segment, so its route set differs. It is a different network.",
    }),
    next,
  }
}

export function makeTreeOrNot(
  variant: TreeOrNotVariant,
  seed: number,
): { question: GraphsQuestion; next: number } {
  const adj = variant === "tree" ? T6 : G6
  const layout = variant === "tree" ? T6_LAYOUT : G6_LAYOUT
  const tree = isTree(adj, G6_NODES)
  const { result, next } = shuffle(treeOptions(), seed)
  return {
    question: baseQuestion("tree-or-not", {
      bin: "same",
      mode: "classify",
      prompt: "Is this a tree or a general graph?",
      nodes: G6_NODES,
      adj,
      layout,
      options: result,
      answer: tree ? "tree" : "graph",
      hint: "",
      nudge: "Look for a cycle. Can you start at a node and get back to it without repeating an edge?",
      correct: tree
        ? "A tree. No cycles, exactly one path between any two nodes."
        : "A general graph. It has a cycle, so it's not a tree.",
      why: tree
        ? `Edges (${edgeSet(adj).size}) = nodes (${G6_NODES.length}) − 1 and it's connected, so it's a tree. No cycle.`
        : `It has a cycle (more edges than a tree allows), so it's a general graph, not a tree.`,
    }),
    next,
  }
}

function buildQuestion(
  part: GraphsPart,
  seed: number,
): { question: GraphsQuestion; next: number } {
  switch (part) {
    case "demo":
      return { question: makeDemo(), next: seed }
    case "teach":
      return { question: makeTeach(), next: seed }
    case "read-list":
      return { question: makeReadList(), next: seed }
    case "read-degree":
      return { question: makeReadDegree(), next: seed }
    case "read-path":
    case "read-trace-far":
      return { question: makeTrace(part), next: seed }
    case "match-list":
      return makeMatchList(seed)
    case "draw-demo":
      return { question: makeDrawDemo(), next: seed }
    case "draw-edge":
      return { question: makeDrawEdge(), next: seed }
    case "draw-transit":
      return { question: makeDrawTransit(), next: seed }
    case "build-the-line":
      return { question: makeBuildLine(), next: seed }
    case "redraw-demo":
      return { question: makeRedrawDemo(), next: seed }
    case "same-graph": {
      const { variant, next } = selectGraphVariant(SAME_GRAPH_VARIANTS, seed)
      return makeSameGraph(variant, next)
    }
    case "tree-or-not": {
      const { variant, next } = selectGraphVariant(TREE_OR_NOT_VARIANTS, seed)
      return makeTreeOrNot(variant, next)
    }
    default:
      return assertNever(part)
  }
}

function assertNever(x: never): never {
  throw new Error(`Unreachable graphs part: ${String(x)}`)
}

/* ------------------------------- construction ------------------------------- */

function freshFields() {
  return {
    selectedNodes: [] as NodeId[],
    selected: null as string | null,
    pendingEdge: null as Edge | null,
    trace: null as TraceBeat | null,
    buildLine: null as BuildLineBeat | null,
    wrongCount: 0,
    feedback: "idle" as Feedback,
    revealed: false,
    showWhy: false,
  }
}

/** Open the trace working model for a trace question (the asked start/target). */
function traceBeatFor(q: GraphsQuestion): TraceBeat | null {
  return q.pair ? traceBeatFrom(q.adj, q.pair[0], q.pair[1]) : null
}

/** Open the build-the-line working model for a build question (active → plan). */
function buildLineBeatFor(q: GraphsQuestion): BuildLineBeat | null {
  return q.planAdj ? buildLineBeatFrom(q.shownAdj ?? {}, q.planAdj, q.nodes) : null
}

/** The figure's starting live adjacency for a beat: the build's working network,
 *  a draw beat's shown picture, or empty. */
function initialWorkingAdj(question: GraphsQuestion, buildLine: BuildLineBeat | null): Adjacency {
  if (buildLine) return cloneAdj(buildLine.working)
  return question.shownAdj ? cloneAdj(question.shownAdj) : {}
}

function enterPart(state: GraphsState, index: number): GraphsState {
  const part = GRAPHS_PARTS[index]
  const { question, next } = buildQuestion(part, state.rngState)
  const trace = isTracePart(part) ? traceBeatFor(question) : null
  const buildLine = isBuildLinePart(part) ? buildLineBeatFor(question) : null
  return {
    ...state,
    partIndex: index,
    ...freshFields(),
    question,
    trace,
    buildLine,
    workingAdj: initialWorkingAdj(question, buildLine),
    rngState: next,
  }
}

export function createGraphs(seed: number = Date.now()): GraphsState {
  const init: GraphsState = {
    seed,
    rngState: seed,
    partIndex: 0,
    readCorrect: 0,
    drawCorrect: 0,
    buildCorrect: 0,
    sameCorrect: 0,
    attempts: 0,
    question: null,
    ...freshFields(),
    workingAdj: {},
    combo: 0,
    completed: false,
  }
  return enterPart(init, 0)
}

/* -------------------------------- selectors -------------------------------- */

export function currentPartGraphs(state: GraphsState): GraphsPart {
  return GRAPHS_PARTS[state.partIndex]
}

/** A verdict is terminal once correct or failed: the question locks. */
export function isTerminalGraphs(state: GraphsState): boolean {
  return state.feedback === "correct" || state.feedback === "fail"
}

export function filledPartsGraphs(state: GraphsState): number {
  return state.completed ? GRAPHS_TOTAL_PARTS : state.partIndex
}

/** Cumulative "n of 10" header for a graded beat (across the four bins). */
export function partQuotaGraphs(
  state: GraphsState,
): { done: number; total: number } | null {
  const bin = binOfPart(currentPartGraphs(state))
  if (!bin) return null
  return {
    done:
      Math.min(READ_QUOTA, state.readCorrect) +
      Math.min(DRAW_QUOTA, state.drawCorrect) +
      Math.min(BUILD_QUOTA, state.buildCorrect) +
      Math.min(SAME_QUOTA, state.sameCorrect),
    total: GATE_TOTAL,
  }
}

/** The bin sub-label for the current graded beat (header). */
export function currentBinLabel(state: GraphsState): string | null {
  switch (binOfPart(currentPartGraphs(state))) {
    case "read":
      return isTracePart(currentPartGraphs(state)) ? "Trace the path" : "Read the list"
    case "draw":
      return "Draw the edge"
    case "build":
      return "Build the line"
    case "same":
      return "Same graph?"
    default:
      return null
  }
}

/** Every node is a legal (keyboard-reachable, highlightable) draw target; the
 * engine (not this flat set) enforces real legality (no self/dup). */
export function legalDrawTargets(state: GraphsState): Set<string> {
  return new Set(state.question?.nodes ?? [])
}

/**
 * Can the learner press Check? Multi-select needs a pick; single-edge draw needs an
 * edge; single-choice needs a pick. The active trace + build beats commit through
 * their own taps/draws (no Check), so they never gate a Check button.
 */
export function canCheckGraphs(state: GraphsState): boolean {
  const part = currentPartGraphs(state)
  if (isMultiSelectPart(part)) return state.selectedNodes.length > 0
  if (isGradedDrawPart(part)) return state.pendingEdge != null
  if (isSingleChoicePart(part)) return state.selected != null
  return false
}

/** The hard mastery gate: read ≥ 5 && draw ≥ 2 && build ≥ 1 && same ≥ 2 (= 10). */
export function isCompleteGraphs(state: GraphsState): boolean {
  return (
    state.readCorrect >= READ_QUOTA &&
    state.drawCorrect >= DRAW_QUOTA &&
    state.buildCorrect >= BUILD_QUOTA &&
    state.sameCorrect >= SAME_QUOTA
  )
}

export function hasProgressGraphs(state: GraphsState): boolean {
  return (
    state.partIndex > 0 ||
    state.readCorrect > 0 ||
    state.drawCorrect > 0 ||
    state.buildCorrect > 0 ||
    state.sameCorrect > 0
  )
}

/* --------------------------------- reducer --------------------------------- */

function bumpBin(state: GraphsState, bin: GraphBin): void {
  if (bin === "read") state.readCorrect = Math.min(READ_QUOTA, state.readCorrect + 1)
  else if (bin === "draw") state.drawCorrect = Math.min(DRAW_QUOTA, state.drawCorrect + 1)
  else if (bin === "build") state.buildCorrect = Math.min(BUILD_QUOTA, state.buildCorrect + 1)
  else state.sameCorrect = Math.min(SAME_QUOTA, state.sameCorrect + 1)
}

function toggleNode(set: NodeId[], node: NodeId): NodeId[] {
  return set.includes(node) ? set.filter((n) => n !== node) : [...set, node]
}

export function graphsReducer(state: GraphsState, action: LessonAction): GraphsState {
  const part = currentPartGraphs(state)

  switch (action.type) {
    case "continue": {
      if (!isIntroPart(part)) return state
      if (state.partIndex >= GRAPHS_TOTAL_PARTS - 1) return state
      return enterPart(state, state.partIndex + 1)
    }

    case "select": {
      if (isTerminalGraphs(state)) return state
      // The active trace: a tap walks to that node if it is a neighbor of the
      // current node. A non-neighbor is a brief nudge (no fail wall); reaching the
      // target grades the read bin. The walk is the verdict (matches pathExists).
      if (isTracePart(part)) {
        if (!state.trace) return state
        const bin = binOfPart(part)
        if (!bin) return state
        const { beat, accepted } = applyTraceStep(state.trace, action.letter)
        if (!accepted) {
          return { ...state, feedback: "nudge", attempts: state.attempts + 1 }
        }
        if (!isTraceSolved(beat)) {
          return { ...state, trace: beat, feedback: "idle", attempts: state.attempts + 1 }
        }
        const v = gradeAnswer(state, true)
        const next: GraphsState = {
          ...state,
          trace: beat,
          feedback: v.feedback,
          combo: v.combo,
          revealed: v.revealed,
          attempts: state.attempts + 1,
        }
        bumpBin(next, bin)
        return next
      }
      if (isMultiSelectPart(part)) {
        return {
          ...state,
          selectedNodes: toggleNode(state.selectedNodes, action.letter),
          feedback: "idle",
        }
      }
      if (isSingleChoicePart(part)) {
        return { ...state, selected: action.letter, feedback: "idle" }
      }
      return state
    }

    case "rewire": {
      if (isTerminalGraphs(state)) return state
      const q = state.question
      if (!q) return state
      const { from, to } = action

      // The active build-the-line synthesis: each accepted track is committed to the
      // working network (the line draws on); an illegal track (not in the plan or
      // already built) is a brief nudge (no fail wall). Matching the plan grades the
      // build bin.
      if (isBuildLinePart(part)) {
        if (!state.buildLine) return state
        const { beat, accepted } = applyBuildLineEdge(state.buildLine, from, to)
        if (!accepted) {
          return { ...state, feedback: "nudge", attempts: state.attempts + 1 }
        }
        const drawn = normalizeEdge(from, to)
        if (!isBuildLineSolved(beat)) {
          return {
            ...state,
            buildLine: beat,
            workingAdj: beat.working,
            pendingEdge: drawn,
            feedback: "idle",
            attempts: state.attempts + 1,
          }
        }
        const v = gradeAnswer(state, true)
        const next: GraphsState = {
          ...state,
          buildLine: beat,
          workingAdj: beat.working,
          pendingEdge: drawn,
          feedback: v.feedback,
          combo: v.combo,
          revealed: v.revealed,
          attempts: state.attempts + 1,
        }
        bumpBin(next, "build")
        return next
      }

      if (!isDrawPart(part)) return state
      // Engine-enforced legality: no self-loop, no parallel/dup, both endpoints
      // in the node set. A new legal draw REPLACES the single pending edge.
      if (from === to) return state
      if (!q.nodes.includes(from) || !q.nodes.includes(to)) return state
      const shown = q.shownAdj ?? {}
      if (hasEdge(shown, from, to)) return state
      return {
        ...state,
        pendingEdge: normalizeEdge(from, to),
        workingAdj: addEdge(shown, from, to),
        feedback: "idle",
      }
    }

    case "check": {
      const q = state.question
      if (!q || isTerminalGraphs(state)) return state
      // The active trace + build commit via taps/draws, never Check.
      if (isTracePart(part) || isBuildLinePart(part)) return state
      const bin = binOfPart(part)
      if (!bin) return state

      let correct: boolean
      if (isMultiSelectPart(part)) {
        if (state.selectedNodes.length === 0) return state
        correct = setEqual(state.selectedNodes, q.answerSet ?? [])
      } else if (isGradedDrawPart(part)) {
        if (state.pendingEdge == null) return state
        correct = sameGraph(state.workingAdj, q.adj)
      } else {
        if (state.selected == null) return state
        correct = state.selected === q.answer
      }

      const v = gradeAnswer(state, correct)
      const next: GraphsState = {
        ...state,
        feedback: v.feedback,
        wrongCount: v.wrongCount,
        combo: v.combo,
        revealed: v.revealed,
        attempts: state.attempts + 1,
      }
      if (v.correct) bumpBin(next, bin)
      return next
    }

    case "reveal":
      return { ...state, showWhy: true }

    case "reattempt": {
      const { question, next } = buildQuestion(part, state.rngState)
      const trace = isTracePart(part) ? traceBeatFor(question) : null
      const buildLine = isBuildLinePart(part) ? buildLineBeatFor(question) : null
      return {
        ...state,
        ...freshFields(),
        question,
        trace,
        buildLine,
        workingAdj: initialWorkingAdj(question, buildLine),
        rngState: next,
      }
    }

    case "next": {
      if (state.feedback !== "correct") return state
      if (state.partIndex >= GRAPHS_TOTAL_PARTS - 1) {
        return { ...state, ...freshFields(), workingAdj: {}, completed: true }
      }
      return enterPart(state, state.partIndex + 1)
    }

    default:
      return state
  }
}

/* ----------------------------- resume / progress ----------------------------- */

export function toProgressGraphs(s: GraphsState): LessonProgress {
  return {
    counters: {
      read: s.readCorrect,
      draw: s.drawCorrect,
      build: s.buildCorrect,
      same: s.sameCorrect,
      attempts: s.attempts,
    },
    currentPart: currentPartGraphs(s),
    completed: s.completed || isCompleteGraphs(s),
  }
}

function clampG(n: number, max: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(Math.max(Math.trunc(n), 0), max)
}

export function resumeGraphs(
  progress: LessonProgress,
  seed: number = Date.now(),
): GraphsState {
  const base = createGraphs(seed)
  const c = progress.counters
  const seeded: GraphsState = {
    ...base,
    readCorrect: clampG(c.read ?? 0, READ_QUOTA),
    drawCorrect: clampG(c.draw ?? 0, DRAW_QUOTA),
    buildCorrect: clampG(c.build ?? 0, BUILD_QUOTA),
    sameCorrect: clampG(c.same ?? 0, SAME_QUOTA),
    attempts: Math.max(0, Math.trunc(c.attempts ?? 0)),
  }
  const index = Math.max(0, GRAPHS_PARTS.indexOf(progress.currentPart as GraphsPart))
  const s = enterPart(seeded, index)
  return progress.completed ? { ...s, completed: true } : s
}
