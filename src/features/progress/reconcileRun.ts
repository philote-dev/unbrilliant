import type { LessonProgress, ReconcilePlan } from "@/features/lesson/engine"
import type { ProgressRepository } from "@/features/progress/ProgressRepository"

export interface ReconcileIds {
  uid: string
  displayName: string
  lessonId: string
}

/**
 * The sign-in orchestration — the persistence seam's real test surface. Performs
 * the I/O the pure `reconcile` decision implies, against an injected
 * `ProgressRepository` (Firestore in the app, the in-memory fake in tests):
 * ensure the user doc, read server progress, decide, and carry up if needed.
 * The pure decision is passed in (per-lesson module), keeping this lesson-agnostic.
 */
export async function reconcileRun<S>(
  repo: ProgressRepository,
  ids: ReconcileIds,
  getLocal: () => S,
  reconcile: (local: S, server: LessonProgress | null) => ReconcilePlan<S>,
  isCancelled: () => boolean = () => false,
): Promise<ReconcilePlan<S>> {
  await repo.ensureUser(ids.uid, { displayName: ids.displayName })
  const server = await repo.getProgress(ids.uid, ids.lessonId)
  const plan = reconcile(getLocal(), server)
  // Skip the one-time carry-up write if the pass was cancelled (e.g. React
  // StrictMode's mount→unmount→mount) — the re-run handles it.
  if (plan.kind === "carry-up" && !isCancelled()) {
    await repo.saveProgress(ids.uid, ids.lessonId, plan.progress)
  }
  return plan
}
