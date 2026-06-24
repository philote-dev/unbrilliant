import {
  HEAPS_TOTAL_PARTS,
  createHeaps,
  filledPartsHeaps,
  hasProgressHeaps,
  heapsReducer,
  resumeHeaps,
  toProgressHeaps,
  type HeapsState,
} from "@/features/lesson/heapsEngine"
import type { LessonModule } from "@/features/lesson/lessonModule"
import { HeapsStage } from "./heaps/Stage"

/**
 * Heaps as a LessonModule on the shared engine seam. Reuses the feedback machine
 * + flame (`gradeAnswer`) and the durable LessonProgress shape; only the heap
 * engine, the dual tree+array figure, and the verdicts are lesson-specific. It is
 * tap-only — every commit is a `{ type: "select" }` (an arrangement-card id or a
 * `"slot-"+i` id), so it pulls in no rewire/drag surface and ships eager (no
 * heavy layout lib to lazy-load).
 */
export const heapsModule: LessonModule<HeapsState> = {
  id: "heaps",
  create: (seed) => createHeaps(seed),
  reducer: heapsReducer,
  toProgress: toProgressHeaps,
  resume: (progress, seed) => resumeHeaps(progress, seed),
  hasProgress: hasProgressHeaps,
  totalParts: HEAPS_TOTAL_PARTS,
  filledParts: filledPartsHeaps,
  combo: (s) => s.combo,
  completed: (s) => s.completed,
  Stage: HeapsStage,
}
