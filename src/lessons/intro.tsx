import type { LessonModule } from "@/features/lesson/lessonModule"
import {
  createIntro,
  filledParts,
  hasProgress,
  introReducer,
  resumeIntro,
  toProgress,
  totalParts,
  type IntroState,
  type IntroVariant,
} from "@/features/lesson/introEngine"
import { IntroStage } from "./intro/IntroStage"

/**
 * "Intro to Data Structures" behind the shared LessonModule seam. One engine + one
 * Stage; the variant only changes the reading shape (see
 * docs/plans/specs/2026-06-25-intro-lesson-prototypes-design.md and docs/lessons/intro.md).
 *  - pages  (live): dedicated reading pages first, then the checks.
 *  - reveal (alt):  text-first interleaved; kept as a Dev Gallery prototype only.
 */
function makeIntroModule(variant: IntroVariant, id: string): LessonModule<IntroState> {
  return {
    id,
    create: (seed) => createIntro(variant, seed),
    reducer: introReducer,
    toProgress,
    resume: (progress, seed) => resumeIntro(variant, progress, seed),
    hasProgress,
    totalParts: totalParts(variant),
    filledParts,
    combo: (s) => s.combo,
    completed: (s) => s.completed,
    Stage: IntroStage,
  }
}

/** The live Introduction lesson: the reading-first "pages" design. */
export const introModule = makeIntroModule("pages", "intro")
/** Gallery-only prototype of the interleaved "reveal" variant. */
export const introRevealModule = makeIntroModule("reveal", "intro-reveal")
