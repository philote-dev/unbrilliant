import type { NodeId, Pt } from "@/features/lesson/graphsEngine"

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
}

/**
 * Two routes that share the Central (C) interchange. Harbor is a 5-station loop
 * (A-B-C-D-E-A); Park is a 2-segment branch (F-C-G). Together: 7 stations, 7
 * undirected segments, exactly one cycle. Colors are decoration.
 */
export const TRANSIT_LINES: TransitLine[] = [
  { id: "harbor", name: "Harbor Loop", color: "#ef4b43", path: ["A", "B", "C", "D", "E", "A"] },
  { id: "park", name: "Park Line", color: "#29abe2", path: ["F", "C", "G"] },
]

/** Geographic layout: irregular, "where the stations really sit". */
export const TRANSIT_GEO_LAYOUT: Record<NodeId, Pt> = {
  A: { x: 70, y: 60 },
  B: { x: 150, y: 95 },
  C: { x: 150, y: 170 },
  D: { x: 75, y: 195 },
  E: { x: 60, y: 120 },
  F: { x: 220, y: 210 },
  G: { x: 240, y: 120 },
}

/** Diagrammatic layout: clean octolinear schematic (a pentagon loop + two spurs). */
export const TRANSIT_DIAGRAM_LAYOUT: Record<NodeId, Pt> = {
  A: { x: 150, y: 70 },
  B: { x: 228, y: 126 },
  C: { x: 198, y: 214 },
  D: { x: 102, y: 214 },
  E: { x: 72, y: 126 },
  F: { x: 262, y: 250 },
  G: { x: 250, y: 150 },
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
 * app theme: a clean light paper map with ink labels and vivid route colors. All
 * decoration; the route list (text) remains the data. The lilac `active` tone is
 * the shared interaction color reused so "grab / drop / selected" reads the same
 * across every lesson.
 */
export const METRO = {
  paper: "#ffffff",
  paperEdge: "#f6f7f9",
  card: "#ffffff",
  cardEdge: "#dcdfe6",
  ink: "#15181f",
  muted: "#5c6577",
  grid: "#ece9e0",
  label: "#b9b3a4",
  water: "#cfe0f2",
  park: "#d8e8cf",
  station: "#ffffff",
  active: "#8b7fd6",
  activeSoft: "#eef0fb",
} as const

