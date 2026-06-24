import {
  HASH_TOTAL_PARTS,
  createHashTables,
  filledPartsHash,
  hasProgressHash,
  hashTablesReducer,
  resumeHashTables,
  toProgressHash,
  type HashTablesState,
} from "@/features/lesson/hashTablesEngine"
import type { LessonModule } from "@/features/lesson/lessonModule"
import { HashTablesStage } from "./hashTables/Stage"

/**
 * Hash Tables as a LessonModule — the fourth real lesson on the shared engine
 * seam. Reuses the feedback machine + flame, the rewire infra (key→bucket), and
 * the durable LessonProgress shape; only the hash engine, figures, and verdicts
 * are lesson-specific.
 */
export const hashTablesModule: LessonModule<HashTablesState> = {
  id: "hash-tables",
  create: (seed) => createHashTables(seed),
  reducer: hashTablesReducer,
  toProgress: toProgressHash,
  resume: (progress, seed) => resumeHashTables(progress, seed),
  hasProgress: hasProgressHash,
  totalParts: HASH_TOTAL_PARTS,
  filledParts: filledPartsHash,
  combo: (s) => s.combo,
  completed: (s) => s.completed,
  Stage: HashTablesStage,
}
