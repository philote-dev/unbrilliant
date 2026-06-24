import type { ComponentType, Dispatch } from "react"

import type {
  LessonAction,
  LessonProgress,
  ReconcilePlan,
} from "@/features/lesson/engine"

/**
 * A lesson is a small module behind one seam: a pure create/reducer over its own
 * state, the durable-progress mappers, a few selectors the shared chrome needs,
 * and a presentational `Stage`. Both lessons share the feedback machine + flame
 * (via `gradeAnswer`) and the same `LessonAction`/`LessonProgress` shapes, so the
 * run provider, the player chrome, and persistence stay lesson-agnostic.
 */
export interface LessonModule<S> {
  id: string
  create(seed?: number): S
  reducer(state: S, action: LessonAction): S
  /** Squash a run to its durable progress slice (lesson-shaped counters). */
  toProgress(state: S): LessonProgress
  /** Reinflate a run at the saved part/counts (cold combo); marks complete. */
  resume(progress: LessonProgress, seed?: number): S
  /** Has this run earned anything worth carrying up to a new account? */
  hasProgress(state: S): boolean
  totalParts: number
  filledParts(state: S): number
  combo(state: S): number
  completed(state: S): boolean
  Stage: ComponentType<{ state: S; dispatch: Dispatch<LessonAction> }>
}

/**
 * The shared sign-in reconciliation, generic over any lesson module: a returning
 * account's server progress wins (resume, no merge); a brand-new account with an
 * in-flight run carries it up; otherwise noop.
 */
export function reconcileModule<S>(
  module: LessonModule<S>,
  local: S,
  server: LessonProgress | null,
  seed?: number,
): ReconcilePlan<S> {
  if (server) return { kind: "resume", state: module.resume(server, seed) }
  if (module.hasProgress(local))
    return { kind: "carry-up", progress: module.toProgress(local) }
  return { kind: "noop" }
}
