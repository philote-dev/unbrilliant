import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { CoursePath, type PathNode } from "../CoursePath"
import { pathLayoutFor } from "./registry"
import { QueuePath } from "./QueuePath"
import { ArrayPath } from "./ArrayPath"
import { LinkedListPath } from "./LinkedListPath"
import { HashTablePath } from "./HashTablePath"
import { TreePath } from "./TreePath"
import { HeapPath } from "./HeapPath"
import { GraphPath } from "./GraphPath"
import { lessonStructure } from "@/lessons/catalog"

// CoursePath measures itself via ResizeObserver, which jsdom lacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver =
  globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver)

describe("pathLayoutFor", () => {
  it("falls back to the generic CoursePath for undefined", () => {
    expect(pathLayoutFor(undefined)).toBe(CoursePath)
  })

  it("maps each structure kind to its layout", () => {
    expect(pathLayoutFor("queue")).toBe(QueuePath)
    expect(pathLayoutFor("array")).toBe(ArrayPath)
    expect(pathLayoutFor("linked-list")).toBe(LinkedListPath)
    expect(pathLayoutFor("hash-table")).toBe(HashTablePath)
    expect(pathLayoutFor("tree")).toBe(TreePath)
    expect(pathLayoutFor("heap")).toBe(HeapPath)
    expect(pathLayoutFor("graph")).toBe(GraphPath)
  })
})

describe("lessonStructure", () => {
  it("maps each lesson id to its structure", () => {
    expect(lessonStructure("stacks-and-queues")).toBe("queue")
    expect(lessonStructure("arrays")).toBe("array")
    expect(lessonStructure("linked-lists")).toBe("linked-list")
    expect(lessonStructure("hash-tables")).toBe("hash-table")
    expect(lessonStructure("trees")).toBe("tree")
    expect(lessonStructure("heaps")).toBe("heap")
    expect(lessonStructure("graphs")).toBe("graph")
  })

  it("returns undefined for an unknown lesson id", () => {
    expect(lessonStructure("not-a-lesson")).toBeUndefined()
  })
})

const NODES: PathNode[] = [
  { id: "a", name: "Alpha", state: "completed" },
  { id: "b", name: "Bravo", state: "current" },
  { id: "c", name: "Charlie", state: "locked" },
]

const LAYOUTS = [
  ["CoursePath", CoursePath],
  ["QueuePath", QueuePath],
  ["ArrayPath", ArrayPath],
  ["LinkedListPath", LinkedListPath],
  ["HashTablePath", HashTablePath],
  ["TreePath", TreePath],
  ["HeapPath", HeapPath],
  ["GraphPath", GraphPath],
] as const

describe.each(LAYOUTS)("%s node accessibility", (_name, Layout) => {
  it("disables locked nodes and enters unlocked ones", async () => {
    const onSelect = vi.fn()
    render(<Layout nodes={NODES} onSelect={onSelect} />)

    const locked = screen.getAllByRole("button", { name: /Charlie \(locked\)/ })[0]
    expect(locked).toBeDisabled()

    const current = screen.getAllByRole("button", { name: "Bravo" })[0]
    await userEvent.click(current)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})

const REVIEW_NODES: PathNode[] = [
  { id: "a", name: "Alpha", state: "completed", needsReview: true },
  { id: "b", name: "Bravo", state: "current" },
]

describe.each(LAYOUTS)("%s needs-review marker", (_name, Layout) => {
  it("renders a marker only for a node that needs review", () => {
    const { rerender } = render(<Layout nodes={REVIEW_NODES} />)
    expect(screen.getAllByLabelText("Needs review").length).toBeGreaterThan(0)

    rerender(<Layout nodes={NODES} />)
    expect(screen.queryByLabelText("Needs review")).toBeNull()
  })
})
