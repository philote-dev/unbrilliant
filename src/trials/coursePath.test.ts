import { describe, expect, it } from "vitest"

import type { PathNode } from "@/components/willow/CoursePath"
import type { ProgressByLesson } from "@/lessons/catalog"

import { withTrialNodes } from "./coursePath"

const lessonNodes: PathNode[] = [
  { id: "intro", name: "Introduction", state: "completed" },
  { id: "stacks-and-queues", name: "Stacks & Queues", state: "completed" },
  { id: "arrays", name: "Arrays", state: "completed" },
  { id: "linked-lists", name: "Linked Lists", state: "current" },
  { id: "hash-tables", name: "Hash Tables", state: "locked" },
]

const completedThrough = (lessonId: string): ProgressByLesson => {
  const order = ["intro", "stacks-and-queues", "arrays", "linked-lists"]
  const progress: ProgressByLesson = {}
  for (const id of order) {
    progress[id] = { counters: {}, currentPart: "done", completed: true }
    if (id === lessonId) break
  }
  return progress
}

describe("withTrialNodes", () => {
  it("inserts Trial I right after linked-lists, locked until the unit is complete", () => {
    const nodes = withTrialNodes(lessonNodes, completedThrough("arrays"), new Set())
    const idx = nodes.findIndex((n) => n.id === "trial-1-linear")
    expect(idx).toBe(4) // immediately after linked-lists (index 3)
    expect(nodes[idx].state).toBe("locked")
    expect(nodes[idx].name).toBe("Trial")
  })

  it("opens the Trial as available once linked-lists is complete", () => {
    const nodes = withTrialNodes(lessonNodes, completedThrough("linked-lists"), new Set())
    const trial = nodes.find((n) => n.id === "trial-1-linear")
    expect(trial?.state).toBe("available")
  })

  it("marks the Trial completed when it is in the completed set", () => {
    const nodes = withTrialNodes(
      lessonNodes,
      completedThrough("linked-lists"),
      new Set(["trial-1-linear"]),
    )
    expect(nodes.find((n) => n.id === "trial-1-linear")?.state).toBe("completed")
  })

  it("leaves the lesson nodes untouched and in order", () => {
    const nodes = withTrialNodes(lessonNodes, completedThrough("linked-lists"), new Set())
    expect(nodes.filter((n) => n.id !== "trial-1-linear")).toEqual(lessonNodes)
  })
})
