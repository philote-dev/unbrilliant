import { lazy, type ComponentType, type LazyExoticComponent } from "react"

import { DATA_STRUCTURES_LESSONS } from "@/lessons/catalog"

/**
 * The lazy "lessons" layer, DERIVED from the catalog's single descriptor list:
 * every lesson with a `load` thunk becomes a code-split chunk (React.lazy →
 * dynamic import) so it (and its heavy libs (@xyflow/react, d3-*, gsap)) stays
 * OUT of the proto bundle and loads per-lesson when opened.
 */
export const FUTURE_LESSONS: Record<string, LazyExoticComponent<ComponentType>> =
  Object.fromEntries(
    DATA_STRUCTURES_LESSONS.filter((l) => l.load).map((l) => [l.id, lazy(l.load!)]),
  )

export function isFutureLesson(id: string): boolean {
  return id in FUTURE_LESSONS
}
