import { describe, expect, it } from "vitest"

import {
  createRetrieval,
  retrievalReducer,
  type RetrievalState,
} from "@/features/retrieval/retrievalSession"
import type { RetrievalItem } from "@/features/retrieval/itemProvider"

const items: RetrievalItem[] = [
  {
    conceptId: "c1",
    prompt: "q1",
    options: [
      { id: "x", label: "x" },
      { id: "y", label: "y" },
    ],
    answerId: "x",
    why: "because x",
  },
]

const run = (s: RetrievalState, ...as: Parameters<typeof retrievalReducer>[1][]) =>
  as.reduce(retrievalReducer, s)

describe("retrieval session reducer", () => {
  it("a correct answer is terminal and records the result", () => {
    const s = run(
      createRetrieval(items),
      { type: "select", optionId: "x" },
      { type: "check" },
    )
    expect(s.feedback).toBe("correct")
    expect(s.results).toEqual([true])
  })

  it("first wrong nudges (retry), second wrong fails", () => {
    let s = run(
      createRetrieval(items),
      { type: "select", optionId: "y" },
      { type: "check" },
    )
    expect(s.feedback).toBe("nudge")
    expect(s.results).toEqual([])
    s = run(s, { type: "select", optionId: "y" }, { type: "check" })
    expect(s.feedback).toBe("fail")
    expect(s.results).toEqual([false])
  })

  it("next finishes the single-item drill", () => {
    const s = run(
      createRetrieval(items),
      { type: "select", optionId: "x" },
      { type: "check" },
      { type: "next" },
    )
    expect(s.done).toBe(true)
  })
})
