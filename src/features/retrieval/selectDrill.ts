import { conceptsForLesson } from "@/features/progress/concepts"
import { strength, type ConceptReview } from "@/features/progress/conceptReview"
import { DATA_STRUCTURES_LESSONS } from "@/lessons/catalog"
import { ITEM_PROVIDERS, type RetrievalItem } from "@/features/retrieval/itemProvider"

/**
 * The single most-overdue due concept whose lesson is completed and that has a
 * registered provider, assembled into 1..3 reworded items. Single-topic per drill;
 * interleaving emerges across sessions as the most-overdue concept rotates. Pure.
 */
export interface DueDrill {
  conceptId: string
  items: RetrievalItem[]
}

// The retrievable concepts that can actually be drilled (have a provider). Built
// from the catalog so it scales as lessons/providers are added.
const RETRIEVABLE_IDS = new Set(
  DATA_STRUCTURES_LESSONS.flatMap((l) => conceptsForLesson(l.id))
    .filter((c) => c.retrievable)
    .map((c) => c.id),
)

export function lessonOfConcept(conceptId: string): string {
  return conceptId.split(":")[0]
}

/** A stable per-user seed so item draws are deterministic and replayable. */
export function seedFromUid(uid: string): number {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (Math.imul(h, 31) + uid.charCodeAt(i)) | 0
  return h
}

function itemSeed(userSeed: number, conceptId: string, encounter: number): number {
  let h = userSeed | 0
  for (let i = 0; i < conceptId.length; i++)
    h = (Math.imul(h, 31) + conceptId.charCodeAt(i)) | 0
  return (h ^ Math.imul(encounter + 1, 0x9e3779b1)) | 0
}

export function selectDueDrill(
  reviews: ConceptReview[],
  ctx: {
    completedLessonIds: Set<string>
    now: number
    userSeed: number
    itemCount?: number
  },
): DueDrill | null {
  const due = reviews.filter(
    (r) =>
      RETRIEVABLE_IDS.has(r.conceptId) &&
      !!ITEM_PROVIDERS[r.conceptId] &&
      ctx.completedLessonIds.has(lessonOfConcept(r.conceptId)) &&
      r.dueAt <= ctx.now,
  )
  if (due.length === 0) return null

  due.sort((a, b) => {
    if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt // smaller dueAt = more overdue
    const s = strength(a, ctx.now) - strength(b, ctx.now) // then lowest strength
    if (s !== 0) return s
    return a.lastSeenAt - b.lastSeenAt // then oldest
  })

  const r = due[0]
  const provider = ITEM_PROVIDERS[r.conceptId]
  const count = Math.max(1, Math.min(ctx.itemCount ?? 1, 3))
  const items: RetrievalItem[] = []
  for (let i = 0; i < count; i++) {
    items.push(provider(itemSeed(ctx.userSeed, r.conceptId, r.seen + i), r.seen + i))
  }
  return { conceptId: r.conceptId, items }
}
