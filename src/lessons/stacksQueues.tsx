import {
  SQ_TOTAL_PARTS,
  createStacksQueues,
  filledParts,
  hasProgress,
  resumeStacksQueues,
  stacksQueuesReducer,
  toProgress,
  type SQState,
} from "@/features/lesson/stacksQueuesEngine"
import type { LessonModule } from "@/features/lesson/lessonModule"
import { StacksQueuesStage } from "./stacksQueues/Stage"

/**
 * Stacks & Queues as a LessonModule. The redesigned lesson
 * (docs/lessons/stacks-queues-redesign.md). Distinct bin/tube containers, a
 * de-cued predict, drag-to-construct, and a compare gate, behind the same shared
 * seam (LessonModule / LessonAction / LessonProgress) as every other lesson.
 */
export const stacksQueuesModule: LessonModule<SQState> = {
  id: "stacks-and-queues",
  create: (seed) => createStacksQueues(seed),
  reducer: stacksQueuesReducer,
  toProgress,
  resume: (progress, seed) => resumeStacksQueues(progress, seed),
  hasProgress,
  totalParts: SQ_TOTAL_PARTS,
  filledParts,
  combo: (s) => s.combo,
  completed: (s) => s.completed,
  Stage: StacksQueuesStage,
}
