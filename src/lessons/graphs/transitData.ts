import type { Adjacency, NodeId, Pt } from "@/features/lesson/graphsEngine"

/**
 * Presentational subway skin for the Graphs draw / redraw / same-graph beats.
 * NONE of this enters a verdict: colors, station names, and the two layouts are
 * pure decoration over the engine's TRANSIT adjacency (the route list is the
 * data). The whole point of the skin is "the picture is decoration, adjacency is
 * the data", so scrambling any coordinate here can never change a verdict.
 *
 * The network is a hand-authored loop line (Harbor) plus a short branch line
 * (Park) that meet at one interchange (Central / C). Two layouts cover the SAME
 * station ids: a geographic one (irregular, like real station positions) and a
 * diagrammatic one (the classic octolinear metro distortion, 45 and 90 degree
 * segments). The redraw beat morphs between them; the data never moves.
 */

export interface TransitLine {
  id: string
  /** Human label for the route (decoration; the route list carries the data). */
  name: string
  /** Route tint (decoration only). */
  color: string
  /** Ordered station path; consecutive pairs are this line's segments. A repeated
   * first/last id (e.g. the loop) closes the line back on itself. */
  path: NodeId[]
}

/** Station id to display name (decoration; the letter id is still the real key). */
export const TRANSIT_STATIONS: Record<NodeId, string> = {
  A: "Ash",
  B: "Bay",
  C: "Central",
  D: "Dock",
  E: "Elm",
  F: "Fern",
  G: "Gate",
  H: "Hill",
  I: "Ivy",
  J: "Jade",
  K: "Kiln",
  L: "Larch",
  M: "Moss",
}

/**
 * Two routes that share the Central (C) interchange. Harbor is a 5-station loop
 * (A-B-C-D-E-A); Park is a 2-segment branch (F-C-G). Together: 7 stations, 7
 * undirected segments, exactly one cycle. Colors are decoration.
 */
export const TRANSIT_LINES: TransitLine[] = [
  { id: "harbor", name: "Harbor Loop", color: "#ef5350", path: ["A", "B", "C", "D", "E", "A"] },
  { id: "park", name: "Park Line", color: "#1aa7e0", path: ["F", "C", "G"] },
]

/**
 * Geographic layout: irregular, "where the stations really sit". Drawn with
 * straight segments (no octolinear constraint), spread across the field so the
 * contrast with the clean diagram reads clearly.
 */
export const TRANSIT_GEO_LAYOUT: Record<NodeId, Pt> = {
  A: { x: 60, y: 55 },
  B: { x: 158, y: 82 },
  C: { x: 168, y: 168 },
  D: { x: 92, y: 210 },
  E: { x: 52, y: 128 },
  F: { x: 252, y: 208 },
  G: { x: 258, y: 108 },
}

/**
 * Diagrammatic layout: the clean octolinear schematic (every segment 0/45/90).
 * A box-with-a-notch loop (A-B-C-D-E-A) plus two 45-degree spurs off Central, all
 * well separated so the rounded corners and diagonals read like a real diagram.
 */
export const TRANSIT_DIAGRAM_LAYOUT: Record<NodeId, Pt> = {
  A: { x: 95, y: 80 },
  B: { x: 205, y: 80 },
  C: { x: 205, y: 160 },
  D: { x: 150, y: 215 },
  E: { x: 95, y: 160 },
  F: { x: 265, y: 220 },
  G: { x: 265, y: 100 },
}

/* --------------------------- draw-transit problem --------------------------- */

/**
 * The validated draw-transit problem (the "route the missing track" question),
 * tuned in the gallery prototype: a loop A-B-C-D-E-A with a Red branch to F (off
 * B) and a Green branch to G (off D), three crossing lines, and the C-D segment
 * missing. The asymmetric layout keeps every edge to one clean 45-degree bend
 * (no squiggle). The adjacency (TRANSIT_DRAW_ADJ) lives in graphsEngine; these
 * are its coordinates + routes (decoration only).
 */
export const TRANSIT_DRAW_LAYOUT: Record<NodeId, Pt> = {
  F: { x: 48, y: 45 },
  B: { x: 120, y: 110 },
  A: { x: 55, y: 200 },
  E: { x: 180, y: 240 },
  C: { x: 225, y: 65 },
  D: { x: 265, y: 170 },
  G: { x: 285, y: 260 },
}

/** Three crossing routes over the draw network (Red, Blue, Green). Decoration;
 *  the metro skin tints them to neon at night. */
export const TRANSIT_DRAW_LINES: TransitLine[] = [
  { id: "red", name: "Red", color: "#ef5350", path: ["F", "B", "A", "E"] },
  { id: "blue", name: "Blue", color: "#1aa7e0", path: ["B", "C", "D"] },
  { id: "green", name: "Green", color: "#16b08a", path: ["E", "D", "G"] },
]

/* ------------------------------ fuller network ------------------------------ */

/**
 * A richer "live example" map for the redraw demo only: the same Harbor + Park
 * core, plus a Garden branch (G-H-I) and a Sun cross-line (E-J-F). Ten stations,
 * four colored routes, still a small route list. Used purely as a showcase; the
 * graded transit beats keep the 7-station network so the data stays tight.
 */
export const TRANSIT_FULL_LINES: TransitLine[] = [
  { id: "harbor", name: "Harbor Loop", color: "#ef5350", path: ["A", "B", "C", "D", "E", "A"] },
  { id: "park", name: "Park Line", color: "#1aa7e0", path: ["F", "C", "G"] },
  { id: "garden", name: "Garden Line", color: "#16b08a", path: ["G", "H", "I"] },
  { id: "sun", name: "Sun Line", color: "#f4bb1c", path: ["E", "J", "F"] },
]

/** Fuller geographic layout (irregular, straight segments). */
export const TRANSIT_FULL_GEO_LAYOUT: Record<NodeId, Pt> = {
  A: { x: 66, y: 64 },
  B: { x: 162, y: 54 },
  C: { x: 176, y: 142 },
  D: { x: 120, y: 200 },
  E: { x: 58, y: 132 },
  F: { x: 238, y: 206 },
  G: { x: 244, y: 110 },
  H: { x: 284, y: 72 },
  I: { x: 214, y: 36 },
  J: { x: 142, y: 258 },
}

/** Fuller diagrammatic layout (octolinear; the Sun line keeps two rounded bends). */
export const TRANSIT_FULL_DIAGRAM_LAYOUT: Record<NodeId, Pt> = {
  A: { x: 90, y: 80 },
  B: { x: 210, y: 80 },
  C: { x: 210, y: 155 },
  D: { x: 150, y: 215 },
  E: { x: 90, y: 155 },
  F: { x: 270, y: 215 },
  G: { x: 270, y: 95 },
  H: { x: 270, y: 45 },
  I: { x: 180, y: 45 },
  J: { x: 150, y: 262 },
}

/* --------------------------- realistic metro (plan vs built) --------------------------- */

/**
 * A believable little metro for the "build the network" prototype: two trunk
 * lines crossing at Central (C), a diamond Loop joining the four mid-points, and
 * four suburb spurs. `PLAN` is the complete system (the greyed-out outline we are
 * building toward); `ACTIVE` is what's actually connected and colored so far. The
 * gap between them (two loop edges + the four spurs) is what the learner builds /
 * rewires. Octolinear positions, shared by plan and active. Decoration only.
 */
export const METRO_PLAN_LAYOUT: Record<NodeId, Pt> = {
  A: { x: 30, y: 150 },
  B: { x: 88, y: 150 },
  C: { x: 150, y: 150 },
  D: { x: 212, y: 150 },
  E: { x: 270, y: 150 },
  F: { x: 150, y: 30 },
  G: { x: 150, y: 88 },
  H: { x: 150, y: 212 },
  I: { x: 150, y: 270 },
  J: { x: 262, y: 100 },
  K: { x: 38, y: 100 },
  L: { x: 270, y: 210 },
  M: { x: 30, y: 210 },
}

export const METRO_PLAN_NODES: NodeId[] = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
]

/** Every planned route (the grey outline). Loop is closed (B-G-D-H-B); the four
 *  short spurs are the unbuilt suburb extensions. */
export const METRO_PLAN_LINES: TransitLine[] = [
  { id: "red", name: "Red Line", color: "#ef5350", path: ["A", "B", "C", "D", "E"] },
  { id: "blue", name: "Blue Line", color: "#1aa7e0", path: ["F", "G", "C", "H", "I"] },
  { id: "loop", name: "Loop Line", color: "#16b08a", path: ["B", "G", "D", "H", "B"] },
  { id: "spur-k", name: "Kiln spur", color: "#b6bcc6", path: ["B", "K"] },
  { id: "spur-j", name: "Jade spur", color: "#b6bcc6", path: ["D", "J"] },
  { id: "spur-l", name: "Larch spur", color: "#b6bcc6", path: ["E", "L"] },
  { id: "spur-m", name: "Moss spur", color: "#b6bcc6", path: ["A", "M"] },
]

export const METRO_PLAN_ADJ: Adjacency = {
  A: ["B", "M"],
  B: ["A", "C", "G", "H", "K"],
  C: ["B", "D", "G", "H"],
  D: ["C", "E", "G", "H", "J"],
  E: ["D", "L"],
  F: ["G"],
  G: ["B", "C", "D", "F"],
  H: ["B", "C", "D", "I"],
  I: ["H"],
  J: ["D"],
  K: ["B"],
  L: ["E"],
  M: ["A"],
}

/**
 * What's built + colored so far, tuned to leave a clean four-track gap for the
 * build-the-line synthesis: both trunks run end to end, two of the four diamond
 * loop edges are laid (B-G and D-H), and two suburb spurs already run (Kiln, Larch).
 * The learner draws the four greyed-out tracks left in the plan: the two missing
 * loop edges (G-D, B-H) that close the diamond, plus the Jade (D-J) and Moss (A-M)
 * spurs. J and M start with no edges (planned-but-unbuilt stations).
 */
export const METRO_ACTIVE_NODES: NodeId[] = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "K", "L",
]

export const METRO_ACTIVE_LINES: TransitLine[] = [
  { id: "red", name: "Red Line", color: "#ef5350", path: ["A", "B", "C", "D", "E"] },
  { id: "blue", name: "Blue Line", color: "#1aa7e0", path: ["F", "G", "C", "H", "I"] },
  { id: "loop", name: "Loop Line", color: "#16b08a", path: ["B", "G", "D", "H", "B"] },
  { id: "spur-k", name: "Kiln spur", color: "#b6bcc6", path: ["B", "K"] },
  { id: "spur-l", name: "Larch spur", color: "#b6bcc6", path: ["E", "L"] },
]

export const METRO_ACTIVE_ADJ: Adjacency = {
  A: ["B"],
  B: ["A", "C", "G", "K"],
  C: ["B", "D", "G", "H"],
  D: ["C", "E", "H"],
  E: ["D", "L"],
  F: ["G"],
  G: ["B", "C", "F"],
  H: ["C", "D", "I"],
  I: ["H"],
  J: [],
  K: ["B"],
  L: ["E"],
  M: [],
}

/* ------------------------------- edge to line ------------------------------- */

/** Canonical undirected key (matches the engine's edgeKey: lexicographic, "-"). */
const key = (u: NodeId, v: NodeId): string => (u <= v ? `${u}-${v}` : `${v}-${u}`)

const EDGE_LINE = new Map<string, TransitLine>()
for (const line of TRANSIT_LINES) {
  for (let i = 0; i < line.path.length - 1; i++) {
    EDGE_LINE.set(key(line.path[i], line.path[i + 1]), line)
  }
}

/** The route an undirected edge belongs to (by canonical key), or undefined. */
export function lineForEdge(edgeKey: string): TransitLine | undefined {
  return EDGE_LINE.get(edgeKey)
}

/** Stations served by two or more lines: the interchanges (here, just Central). */
export const TRANSIT_INTERCHANGES: Set<NodeId> = (() => {
  const count = new Map<NodeId, number>()
  for (const line of TRANSIT_LINES) {
    for (const id of new Set(line.path)) count.set(id, (count.get(id) ?? 0) + 1)
  }
  const out = new Set<NodeId>()
  for (const [id, n] of count) if (n >= 2) out.add(id)
  return out
})()

/** A station's display name, falling back to its id. */
export const stationName = (id: NodeId): string => TRANSIT_STATIONS[id] ?? id

/* --------------------------------- metro skin --------------------------------- */

/**
 * The full-screen "transit map poster" palette. Hardcoded (a brand takeover, like
 * the Linked Lists Spotify theme), so the scene looks the same in light or dark
 * app theme. Modeled on a real published metro diagram: a clean WHITE field, near
 * black ink for station rings + names, and a couple of vivid route colors. There
 * is no street grid, park, or water; the map is a schematic, not a city map. All
 * decoration; the route list (text) remains the data. The lilac `active` tone is
 * the shared interaction color reused so "grab / drop / selected" reads the same
 * across every lesson.
 */
export const METRO = {
  paper: "#ffffff",
  paperEdge: "#f4f6f8",
  /** A cool grey-white "poster mat" behind the white map (the optional darker
   *  background). White casing + dots pop against it like a printed diagram. */
  mat: "#e9edf2",
  matEdge: "#dce1e9",
  cardEdge: "#e6e9ef",
  ink: "#16181d",
  muted: "#5c6577",
  station: "#ffffff",
  /** A neutral grey route, the metro "line 5" tint (decoration). */
  grey: "#b6bcc6",
  /** The greyed-out "complete plan" outline: the metro we are building toward. */
  ghost: "#c3c8d1",
  ghostInk: "#9aa1ad",
  /** Soft map geography to fill empty space (parks, residential blocks, water). */
  park: "#d8ead0",
  parkInk: "#b6d2a8",
  block: "#e7e3d9",
  blockInk: "#d6d0c2",
  water: "#d6e6f2",
  active: "#8b7fd6",
  activeSoft: "#eef0fb",
} as const

