import {
  GRAPHS_TOTAL_PARTS,
  createGraphs,
  filledPartsGraphs,
  graphsReducer,
  hasProgressGraphs,
  resumeGraphs,
  toProgressGraphs,
  type GraphsState,
} from "@/features/lesson/graphsEngine"
import type { LessonModule } from "@/features/lesson/lessonModule"
import { GraphsStage } from "./graphs/Stage"

/**
 * Graphs as a LessonModule — the fifth real lesson on the shared engine seam.
 * Reuses the feedback machine + flame, the rewire infra (a node is both source
 * and target; the undirected normalization lives in the engine), and the durable
 * LessonProgress shape; only the graph model, figures, and verdicts are
 * lesson-specific. Ships eager/playable — hand-authored layouts + Framer Motion,
 * no heavy graph lib.
 */
export const graphsModule: LessonModule<GraphsState> = {
  id: "graphs",
  create: (seed) => createGraphs(seed),
  reducer: graphsReducer,
  toProgress: toProgressGraphs,
  resume: (progress, seed) => resumeGraphs(progress, seed),
  hasProgress: hasProgressGraphs,
  totalParts: GRAPHS_TOTAL_PARTS,
  filledParts: filledPartsGraphs,
  combo: (s) => s.combo,
  completed: (s) => s.completed,
  Stage: GraphsStage,
}
