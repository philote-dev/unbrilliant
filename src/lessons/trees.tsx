import {
  TREES_TOTAL_PARTS,
  createTrees,
  filledPartsTrees,
  hasProgressTrees,
  resumeTrees,
  toProgressTrees,
  treesReducer,
  type TreesState,
} from "@/features/lesson/treesEngine"
import type { LessonModule } from "@/features/lesson/lessonModule"
import { TreesStage } from "./trees/Stage"

/**
 * Trees (BST) as a LessonModule — the fifth real lesson on the shared engine
 * seam. Reuses the feedback machine + flame, the cost readout (house words
 * `barely grows` / `scales`), and the durable LessonProgress shape; only the tree
 * engine, figures, and verdicts are lesson-specific. Tap-only: no rewire infra,
 * no heavy layout lib.
 */
export const treesModule: LessonModule<TreesState> = {
  id: "trees",
  create: (seed) => createTrees(seed),
  reducer: treesReducer,
  toProgress: toProgressTrees,
  resume: (progress, seed) => resumeTrees(progress, seed),
  hasProgress: hasProgressTrees,
  totalParts: TREES_TOTAL_PARTS,
  filledParts: filledPartsTrees,
  combo: (s) => s.combo,
  completed: (s) => s.completed,
  Stage: TreesStage,
}
