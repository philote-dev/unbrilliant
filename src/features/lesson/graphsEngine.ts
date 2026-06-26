import {
  gradeAnswer,
  type Feedback,
  type LessonAction,
  type LessonProgress,
} from "@/features/lesson/engine"
import {
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
 * Twelve beats, eight graded behind the until-correct wall, aggregated into a
 * read 4 / draw 2 / same 2 gate. Reuses the shared feedback machine + flame
 * (`gradeAnswer`) and the durable LessonProgress shape; only the graph model,
 * verdicts, and quotas are Graphs-specific. Deterministic (seeded): same state
 * always yields the same question/feedback.
 */

export const GRAPHS_PARTS = [
  "demo", // 1  intro: drag a node, nothing changes; tap a node lights its list
  "teach", // 2  teach: adjacency is the data; a graph is not a tree
  "read-list", // 3  G1 tap C's connection list (multi-select)          Read  ✓
  "read-degree", // 4  G1 tap D's neighbors; degree = count (multi-select) Read  ✓
  "read-path", // 5  G2 is there a path from A to F? (yes/no)            Read  ✓
  "match-list", // 6  G3 which adjacency list matches? (MCQ)              Read  ✓
  "draw-demo", // 7  intro: draw an edge, watch the list gain a neighbor
  "draw-edge", // 8  G4 draw the one missing edge (rewire)               Draw  ✓
  "draw-transit", // 9  G4 transit skin: add the missing connection (rewire) Draw ✓
  "redraw-demo", // 10 teach: same graph snaps to a new layout, list still
  "same-graph", // 11 G5 same graph? moved-node (same) / one-edge (diff)  Same  ✓
  "tree-or-not", // 12 G2-family: tree or general graph? (spot the cycle) Same  ✓
] as const
export type GraphsPart = (typeof GRAPHS_PARTS)[number]
export const GRAPHS_TOTAL_PARTS = GRAPHS_PARTS.length

/** Correct answers required per bin to clear the gate (read 4 / draw 2 / same 2 = 8). */
export const READ_QUOTA = 4
export const DRAW_QUOTA = 2
export const SAME_QUOTA = 2
export const GATE_TOTAL = READ_QUOTA + DRAW_QUOTA + SAME_QUOTA

export type GraphBin = "read" | "draw" | "same"
/** How the learner answers a beat. */
export type GraphMode =
  | "intro"
  | "multiselect"
  | "yesno"
  | "mcq"
  | "draw"
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
  pair?: readonly [NodeId, NodeId] // read-path: the (X,Y) asked
  missingEdge?: Edge // draw beats: the one correct edge to add
  adjB?: Adjacency // same-graph: the second layout's adjacency
  layout: Record<NodeId, Pt> // PRESENTATIONAL only. Never read by a verdict
  layoutB?: Record<NodeId, Pt> // same-graph / redraw: the alternate layout
  options: GraphOption[] // mcq / yesno / classify choices
  answer: string // winning option id (yesno/mcq/classify); else ""
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
  readCorrect: number // 0..4
  drawCorrect: number // 0..2
  sameCorrect: number // 0..2
  attempts: number
  question: GraphsQuestion | null
  // working state (TRANSIENT, never persisted):
  selectedNodes: NodeId[] // multi-select read set (toggled by `select`)
  selected: string | null // yes/no | mcq option | same/different | tree/graph
  pendingEdge: Edge | null // draw beat: the single drawn edge
  workingAdj: Adjacency // draw beat: shownAdj + pendingEdge (for the figure)
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
/** Beats that accept a `rewire` gesture (the two graded draws plus the free-play demo). */
export const isDrawPart = (part: GraphsPart): boolean =>
  part === "draw-demo" || part === "draw-edge" || part === "draw-transit"
/** The two graded draws (the demo draws but is never checked). */
export const isGradedDrawPart = (part: GraphsPart): boolean =>
  part === "draw-edge" || part === "draw-transit"
export const isSingleChoicePart = (part: GraphsPart): boolean =>
  part === "read-path" ||
  part === "match-list" ||
  part === "same-graph" ||
  part === "tree-or-not"

export function binOfPart(part: GraphsPart): GraphBin | null {
  if (
    part === "read-list" ||
    part === "read-degree" ||
    part === "read-path" ||
    part === "match-list"
  )
    return "read"
  if (part === "draw-edge" || part === "draw-transit") return "draw"
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

const yesNoOptions = (): GraphOption[] => [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
]
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
    why: `${focus}'s row is ${set.join(", ")}, so its degree is the size of that set: ${set.length}.`,
  })
}

function makeReadPath(seed: number): { question: GraphsQuestion; next: number } {
  const pair: Edge = ["A", "F"]
  const yes = pathExists(G6, pair[0], pair[1])
  const { result, next } = shuffle(yesNoOptions(), seed)
  return {
    question: baseQuestion("read-path", {
      bin: "read",
      mode: "yesno",
      prompt: `Is there a path from ${pair[0]} to ${pair[1]}?`,
      nodes: G6_NODES,
      adj: G6,
      layout: G6_LAYOUT,
      pair,
      markedNodes: [pair[0], pair[1]],
      options: result,
      answer: yes ? "yes" : "no",
      hint: "",
      nudge: "Trace the connections step by step. Can you reach the other node at all?",
      correct: yes
        ? `Yes: you can reach ${pair[1]} from ${pair[0]} by following the edges.`
        : `No, no chain of edges links ${pair[0]} to ${pair[1]}.`,
      why: yes
        ? `Walking the edges from ${pair[0]} eventually reaches ${pair[1]}, so a path exists, even though they're not directly connected.`
        : `No chain of edges connects ${pair[0]} to ${pair[1]}, so there's no path.`,
    }),
    next,
  }
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
        ? "Same network: the connections match, only the layout changed."
        : "Different: one connection changed, so it is a different network.",
      why: same
        ? "Both maps have the identical set of segments; bending the map into a diagram never changes the network."
        : "The diagram is missing the D to E segment, so its route set differs: a different network.",
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
      nudge: "Look for a cycle: can you start at a node and get back to it without repeating an edge?",
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
      return makeReadPath(seed)
    case "match-list":
      return makeMatchList(seed)
    case "draw-demo":
      return { question: makeDrawDemo(), next: seed }
    case "draw-edge":
      return { question: makeDrawEdge(), next: seed }
    case "draw-transit":
      return { question: makeDrawTransit(), next: seed }
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
    wrongCount: 0,
    feedback: "idle" as Feedback,
    revealed: false,
    showWhy: false,
  }
}

function enterPart(state: GraphsState, index: number): GraphsState {
  const part = GRAPHS_PARTS[index]
  const { question, next } = buildQuestion(part, state.rngState)
  return {
    ...state,
    partIndex: index,
    ...freshFields(),
    question,
    workingAdj: question.shownAdj ? cloneAdj(question.shownAdj) : {},
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

/** Cumulative "n of 8" header for a graded beat (across the three bins). */
export function partQuotaGraphs(
  state: GraphsState,
): { done: number; total: number } | null {
  const bin = binOfPart(currentPartGraphs(state))
  if (!bin) return null
  return {
    done: state.readCorrect + state.drawCorrect + state.sameCorrect,
    total: GATE_TOTAL,
  }
}

/** The bin sub-label for the current graded beat (header). */
export function currentBinLabel(state: GraphsState): string | null {
  switch (binOfPart(currentPartGraphs(state))) {
    case "read":
      return "Read the list"
    case "draw":
      return "Draw the edge"
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

/** Can the learner press Check? Multi-select needs a pick; draw needs an edge. */
export function canCheckGraphs(state: GraphsState): boolean {
  const part = currentPartGraphs(state)
  if (isMultiSelectPart(part)) return state.selectedNodes.length > 0
  if (isGradedDrawPart(part)) return state.pendingEdge != null
  if (isSingleChoicePart(part)) return state.selected != null
  return false
}

/** The hard mastery gate: read ≥ 4 && draw ≥ 2 && same ≥ 2 (= 8). */
export function isCompleteGraphs(state: GraphsState): boolean {
  return (
    state.readCorrect >= READ_QUOTA &&
    state.drawCorrect >= DRAW_QUOTA &&
    state.sameCorrect >= SAME_QUOTA
  )
}

export function hasProgressGraphs(state: GraphsState): boolean {
  return (
    state.partIndex > 0 ||
    state.readCorrect > 0 ||
    state.drawCorrect > 0 ||
    state.sameCorrect > 0
  )
}

/* --------------------------------- reducer --------------------------------- */

function bumpBin(state: GraphsState, bin: GraphBin): void {
  if (bin === "read") state.readCorrect = Math.min(READ_QUOTA, state.readCorrect + 1)
  else if (bin === "draw") state.drawCorrect = Math.min(DRAW_QUOTA, state.drawCorrect + 1)
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
      if (!isDrawPart(part) || isTerminalGraphs(state)) return state
      const q = state.question
      if (!q) return state
      const { from, to } = action
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
      return {
        ...state,
        ...freshFields(),
        question,
        workingAdj: question.shownAdj ? cloneAdj(question.shownAdj) : {},
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
    sameCorrect: clampG(c.same ?? 0, SAME_QUOTA),
    attempts: Math.max(0, Math.trunc(c.attempts ?? 0)),
  }
  const index = Math.max(0, GRAPHS_PARTS.indexOf(progress.currentPart as GraphsPart))
  const s = enterPart(seeded, index)
  return progress.completed ? { ...s, completed: true } : s
}
