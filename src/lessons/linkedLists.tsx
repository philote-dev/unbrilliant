import {
  LL_TOTAL_PARTS,
  createLinkedLists,
  filledPartsLL,
  hasProgressLinkedLists,
  linkedListsReducer,
  resumeLinkedLists,
  toProgressLinkedLists,
  type LinkedListsState,
} from "@/features/lesson/linkedListsEngine"
import type { LessonModule } from "@/features/lesson/lessonModule"
import { LinkedListsStage } from "./linkedLists/Stage"

/**
 * Linked Lists as a LessonModule. The third real lesson on the shared engine
 * seam, the exact mirror of Arrays (access "scales" / rewire "free"). It reuses
 * the feedback machine, cost readout, flame, and durable-progress shape; only
 * the chain engine, the NodeChain figure, and the rewire verdicts are new.
 */
export const linkedListsModule: LessonModule<LinkedListsState> = {
  id: "linked-lists",
  create: (seed) => createLinkedLists(seed),
  reducer: linkedListsReducer,
  toProgress: toProgressLinkedLists,
  resume: (progress, seed) => resumeLinkedLists(progress, seed),
  hasProgress: hasProgressLinkedLists,
  totalParts: LL_TOTAL_PARTS,
  filledParts: filledPartsLL,
  combo: (s) => s.combo,
  completed: (s) => s.completed,
  Stage: LinkedListsStage,
}
