import { describe, expect, it } from "vitest"
import { createInMemoryProgressRepository } from "@/features/progress/inMemoryProgressRepository"
import { newReview } from "@/features/progress/conceptReview"

describe("ConceptReview persistence (in-memory)", () => {
  it("round-trips reviews per user and upserts by conceptId", async () => {
    const repo = createInMemoryProgressRepository()
    expect(await repo.getConceptReviews("u1")).toEqual([])

    const a = newReview("stacks-and-queues:classify", 1_000)
    await repo.saveConceptReview("u1", a)
    await repo.saveConceptReview("u1", { ...a, level: 2 }) // upsert same id

    const rows = await repo.getConceptReviews("u1")
    expect(rows).toHaveLength(1)
    expect(rows[0].level).toBe(2)
    expect(await repo.getConceptReviews("u2")).toEqual([])
  })
})
