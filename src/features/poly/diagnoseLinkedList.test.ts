import { describe, it, expect } from "vitest"
import { diagnoseLinkedListInsert, describeWritesGeneric } from "./diagnoseLinkedList"
import { pointerId, NIL } from "@/features/lesson/linkedListsEngine"

// Insert X after A in A -> B -> ∅ (so prev=A, at=B, head=A).
const q = {
  head: "A",
  prev: "A",
  at: "B",
  newNode: "X",
  nodes: ["A", "B"],
  correctNext: { [pointerId("X")]: "B", [pointerId("A")]: "X", [pointerId("B")]: NIL },
}

// Interior insert: X after B in A -> B -> C -> D (prev=B, at=C, head=A).
const interiorQ = {
  head: "A",
  prev: "B",
  at: "C",
  newNode: "X",
  nodes: ["A", "B", "C", "D"],
  correctNext: {
    [pointerId("A")]: "B",
    [pointerId("B")]: "X",
    [pointerId("X")]: "C",
    [pointerId("C")]: "D",
    [pointerId("D")]: NIL,
  },
}

describe("diagnoseLinkedListInsert", () => {
  it("returns null when nothing has been written yet", () => {
    expect(diagnoseLinkedListInsert(q, [])).toBeNull()
  })

  it("flags repointing prev before saving the tail (orphan)", () => {
    const d = diagnoseLinkedListInsert(q, [{ from: pointerId("A"), to: "X" }])
    expect(d?.kind).toBe("repointed-before-saving")
    expect(d?.stepNumber).toBe(1)
  })

  it("treats the save-first move as a safe-but-incomplete attempt", () => {
    const d = diagnoseLinkedListInsert(q, [{ from: pointerId("X"), to: "B" }])
    expect(d?.kind).toBe("incomplete")
  })

  it("marks a head insert as a boundary case", () => {
    const d = diagnoseLinkedListInsert(q, [{ from: pointerId("A"), to: "X" }])
    expect(d?.boundary).toBe(true)
    expect(d?.configKey).toBe("head-insert")
  })

  it("marks an interior insert as a non-boundary case", () => {
    const d = diagnoseLinkedListInsert(interiorQ, [{ from: pointerId("B"), to: "X" }])
    expect(d?.boundary).toBe(false)
    expect(d?.configKey).toBe("interior")
  })
})

describe("describeWritesGeneric (label-free, positional)", () => {
  it("describes the orphan move by role, with no node labels", () => {
    const phrases = describeWritesGeneric(q, [{ from: pointerId("A"), to: "X" }])
    expect(phrases).toEqual(["aimed the node before the gap at the new node"])
  })

  it("describes the save-first move by role, with no node labels", () => {
    const phrases = describeWritesGeneric(q, [{ from: pointerId("X"), to: "B" }])
    expect(phrases).toEqual(["aimed the new node at the node that should follow it"])
  })

  it("falls back to neutral roles for other sources/targets (incl. the end)", () => {
    const phrases = describeWritesGeneric(interiorQ, [
      { from: pointerId("C"), to: "D" },
      { from: pointerId("D"), to: NIL },
    ])
    expect(phrases).toEqual([
      "aimed an earlier node at another node",
      "aimed an earlier node at the end",
    ])
  })

  it("never leaks a concrete node label into the shared attempt", () => {
    const writes = [
      { from: pointerId("A"), to: "X" },
      { from: pointerId("X"), to: "B" },
    ]
    const joined = describeWritesGeneric(q, writes).join(" | ")
    for (const label of [...q.nodes, q.newNode, NIL]) {
      expect(joined).not.toContain(label)
    }
  })

  it("returns an empty trace for no writes", () => {
    expect(describeWritesGeneric(q, [])).toEqual([])
  })
})
