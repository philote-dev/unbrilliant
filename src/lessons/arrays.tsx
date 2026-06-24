import {
  ARRAYS_TOTAL_PARTS,
  arraysReducer,
  createArrays,
  filledPartsArrays,
  hasProgressArrays,
  resumeArrays,
  toProgressArrays,
  type ArraysState,
} from "@/features/lesson/arraysEngine"
import type { LessonModule } from "@/features/lesson/lessonModule"
import { ArraysStage } from "./arrays/Stage"

/** Arrays as a LessonModule — a real second lesson on the shared engine seam. */
export const arraysModule: LessonModule<ArraysState> = {
  id: "arrays",
  create: (seed) => createArrays(seed),
  reducer: arraysReducer,
  toProgress: toProgressArrays,
  resume: (progress, seed) => resumeArrays(progress, seed),
  hasProgress: hasProgressArrays,
  totalParts: ARRAYS_TOTAL_PARTS,
  filledParts: filledPartsArrays,
  combo: (s) => s.combo,
  completed: (s) => s.completed,
  Stage: ArraysStage,
}
