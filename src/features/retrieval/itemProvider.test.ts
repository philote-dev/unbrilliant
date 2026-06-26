import { describe, expect, it } from "vitest"

import {
  classifyVerdict,
  drainOrder,
} from "@/features/lesson/stacksQueuesEngine"
import { ITEM_PROVIDERS } from "@/features/retrieval/itemProvider"

describe("retrieval item providers", () => {
  it("are pure: same (seed, encounter) yields the same item", () => {
    const p = ITEM_PROVIDERS["stacks-and-queues:classify"]
    expect(p(42, 0)).toEqual(p(42, 0))
  })

  it("reword across encounters (prompt changes)", () => {
    const p = ITEM_PROVIDERS["stacks-and-queues:classify"]
    expect(p(42, 0).prompt).not.toBe(p(42, 1).prompt)
  })

  it("classify answer matches the pure verdict and is a valid option", () => {
    const item = ITEM_PROVIDERS["stacks-and-queues:classify"](7, 0)
    expect(["stack", "queue", "neither"]).toContain(item.answerId)
    expect(item.options.map((o) => o.id)).toContain(item.answerId)
  })

  it("stack predict answer is the most-recently-added item", () => {
    const item = ITEM_PROVIDERS["stacks-and-queues:stackPredict"](3, 0)
    const arrival = item.options.map((o) => o.id)
    expect(item.answerId).toBe(drainOrder(arrival, "stack")[0])
    expect(item.answerId).toBe(arrival[arrival.length - 1])
  })

  it("queue predict answer is the earliest-added item", () => {
    const item = ITEM_PROVIDERS["stacks-and-queues:queuePredict"](3, 0)
    const arrival = item.options.map((o) => o.id)
    expect(item.answerId).toBe(drainOrder(arrival, "queue")[0])
    expect(item.answerId).toBe(arrival[0])
  })

  it("classify verdict helper stays the source of truth", () => {
    expect(classifyVerdict(["A", "B", "C"], ["C", "B", "A"])).toBe("stack")
  })
})
