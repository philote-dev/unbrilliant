import { describe, it, expect } from "vitest"

import {
  CLASSIFY_BANK,
  SQ_GATE,
  SQ_TOTAL_PARTS,
  classifyVerdict,
  createStacksQueues,
  currentPart,
  drainOrder,
  isComplete,
  predictAnswer,
  removablePushedCell,
  resumeStacksQueues,
  solvedCount,
  stacksQueuesReducer,
  targetEmitStep,
  toProgress,
  type Cell,
  type SQState,
} from "./stacksQueuesEngine"
import type { LessonAction } from "./engine"

/**
 * Behavior-focused tests for the redesigned Stacks & Queues engine. Everything
 * is driven through dispatched actions and asserted via external behavior
 * (verdict, the 8-skill gate, combo, completion) with a FIXED seed so the
 * curated questions and option shuffles are deterministic (the no-AI guarantee).
 */
const SEED = 7

function apply(state: SQState, ...actions: LessonAction[]): SQState {
  return actions.reduce(stacksQueuesReducer, state)
}

/** Solve whatever graded question is current, correctly. */
function solve(s: SQState): SQState {
  const q = s.question!
  if (q.kind === "construct") {
    let t = s
    for (const id of q.correctPush) t = apply(t, { type: "rewire", from: id, to: "mouth" })
    return apply(t, { type: "check" })
  }
  return apply(s, { type: "select", letter: q.answer }, { type: "check" })
}

/** Walk demo/teach beats, solving every graded beat, to the given part (or end). */
function driveTo(stop?: string): SQState {
  let s = createStacksQueues(SEED)
  for (let guard = 0; guard < 40; guard++) {
    if (stop && currentPart(s) === stop) return s
    const part = currentPart(s)
    if (part === "compare") {
      // two sub-questions live here (classify then contrast)
      s = apply(solve(s), { type: "next" }) // classify -> contrast
      if (stop === "compare:contrast") return s
      s = apply(solve(s), { type: "next" }) // contrast -> complete
      return s
    }
    if (s.question) s = apply(solve(s), { type: "next" })
    else s = apply(s, { type: "continue" })
  }
  return s
}

describe("S&Q: flow shape", () => {
  it("has 11 beats and an 8-skill gate, starting on the stack demo", () => {
    expect(SQ_TOTAL_PARTS).toBe(11)
    expect(SQ_GATE).toBe(8)
    expect(currentPart(createStacksQueues(SEED))).toBe("stack-demo")
  })

  it("demo/teach advance via continue; graded beats ignore continue", () => {
    let s = createStacksQueues(SEED)
    expect(currentPart(s)).toBe("stack-demo")
    s = apply(s, { type: "continue" })
    expect(currentPart(s)).toBe("stack-teach")
    s = apply(s, { type: "continue" })
    expect(currentPart(s)).toBe("stack-predict")
    // a graded beat does not advance on continue
    expect(currentPart(apply(s, { type: "continue" }))).toBe("stack-predict")
  })
})

describe("S&Q: predict is de-cued (answer is a pure function of the ask)", () => {
  it("stack predict is a stepped-back after-k ask; queue predict is first-out", () => {
    const stackPredict = driveTo("stack-predict")
    const sq = stackPredict.question!
    if (sq.kind !== "predict") throw new Error("expected predict")
    // arrival A,B,C,D -> stack container reversed = D,C,B,A; after two pops B is on top
    expect(sq.cells.map((c) => c.id)).toEqual(["D", "C", "B", "A"])
    expect(sq.ask).toEqual({ kind: "after-k", k: 2 })
    expect(sq.answer).toBe("B")

    const queuePredict = driveTo("queue-predict")
    const qq = queuePredict.question!
    if (qq.kind !== "predict") throw new Error("expected predict")
    // arrival A,B,C -> queue keeps order, exit (cells[0]) = A (front)
    expect(qq.cells.map((c) => c.id)).toEqual(["A", "B", "C"])
    expect(qq.ask).toEqual({ kind: "first-out" })
    expect(qq.answer).toBe("A")
  })

  it("a correct pick climbs the combo; first wrong nudges, second fails", () => {
    const s = driveTo("stack-predict")
    const ok = apply(s, { type: "select", letter: "B" }, { type: "check" })
    expect(ok.feedback).toBe("correct")
    expect(ok.combo).toBe(1)
    expect(ok.solved.stackPredict).toBe(true)

    let bad = apply(s, { type: "select", letter: "A" }, { type: "check" })
    expect(bad.feedback).toBe("nudge")
    expect(bad.solved.stackPredict).toBe(false)
    bad = apply(bad, { type: "select", letter: "C" }, { type: "check" })
    expect(bad.feedback).toBe("fail")
    expect(bad.combo).toBe(0)
  })
})

describe("S&Q: construct is push-all-then-drain with a unique order", () => {
  it("stack reverses the target; queue preserves it", () => {
    const sc = driveTo("stack-construct")
    if (sc.question?.kind !== "construct") throw new Error("expected construct")
    expect(sc.question.correctPush).toEqual(["C", "B", "A"]) // exit A,B,C ⇒ push reversed

    const qc = driveTo("queue-construct")
    if (qc.question?.kind !== "construct") throw new Error("expected construct")
    expect(qc.question.correctPush).toEqual(["C", "A", "B"]) // exit C,A,B ⇒ push same
  })

  it("the correct push order is correct; Check is blocked until all are pushed", () => {
    const s = driveTo("stack-construct")
    // not ready until every loose cell is pushed
    const partial = apply(s, { type: "rewire", from: "C", to: "mouth" }, { type: "check" })
    expect(partial.feedback).toBe("idle")
    const done = solve(s)
    expect(done.feedback).toBe("correct")
    expect(done.solved.stackConstruct).toBe(true)
  })

  it("a wrong order nudges and refills the bin to re-push", () => {
    const s = driveTo("stack-construct")
    // push in the WRONG order (the target exit order itself, not reversed)
    const wrong = apply(
      s,
      { type: "rewire", from: "A", to: "mouth" },
      { type: "rewire", from: "B", to: "mouth" },
      { type: "rewire", from: "C", to: "mouth" },
      { type: "check" },
    )
    expect(wrong.feedback).toBe("nudge")
    expect(wrong.construct?.pushed).toEqual([]) // bin refilled
    expect(wrong.construct?.loose.length).toBe(3)
  })
})

describe("S&Q: construct lets the learner take the open-end cell back", () => {
  for (const part of ["stack-construct", "queue-construct"] as const) {
    describe(part, () => {
      it("pops the last pushed cell back to the loose tray (appended)", () => {
        const s = driveTo(part)
        const [first, second] = s.construct!.loose
        const up = apply(
          s,
          { type: "rewire", from: first, to: "mouth" },
          { type: "rewire", from: second, to: "mouth" },
        )
        expect(up.construct!.pushed).toEqual([first, second])

        const back = apply(up, { type: "rewire", from: second, to: "tray" })
        expect(back.construct!.pushed).toEqual([first])
        // returned to the tray (order is not graded, so appended is fine)
        const { loose } = back.construct!
        expect(loose).toContain(second)
        expect(loose[loose.length - 1]).toBe(second)
        expect(back.feedback).toBe("idle")
      })

      it("ignores a pop that targets a cell that is not the open end", () => {
        const s = driveTo(part)
        const [first, second] = s.construct!.loose
        const up = apply(
          s,
          { type: "rewire", from: first, to: "mouth" },
          { type: "rewire", from: second, to: "mouth" },
        )
        // `first` is buried (not the open end), so taking it back is a no-op
        const noop = apply(up, { type: "rewire", from: first, to: "tray" })
        expect(noop).toBe(up)
        expect(noop.construct!.pushed).toEqual([first, second])
      })

      it("ignores a pop once the verdict is terminal (correct)", () => {
        const solved = solve(driveTo(part))
        expect(solved.feedback).toBe("correct")
        const { pushed } = solved.construct!
        const last = pushed[pushed.length - 1]
        const after = apply(solved, { type: "rewire", from: last, to: "tray" })
        expect(after).toBe(solved)
      })

      it("removablePushedCell is the last pushed while building, null otherwise", () => {
        const s = driveTo(part)
        expect(removablePushedCell(s)).toBeNull() // nothing pushed yet
        const [first, second] = s.construct!.loose
        const one = apply(s, { type: "rewire", from: first, to: "mouth" })
        expect(removablePushedCell(one)).toBe(first)
        const two = apply(one, { type: "rewire", from: second, to: "mouth" })
        expect(removablePushedCell(two)).toBe(second)
        // terminal (correct): no end cell is removable
        expect(removablePushedCell(solve(s))).toBeNull()
      })
    })
  }
})

describe("S&Q: compare beat holds classify then contrast", () => {
  it("classify advances to contrast; contrast completes the lesson", () => {
    const classify = driveTo("compare")
    if (classify.question?.kind !== "classify") throw new Error("expected classify")
    const cq = classify.question
    // a seed-selected bank instance; its answer is the pure verdict and is offered
    expect(cq.answer).toBe(classifyVerdict(cq.inOrder, cq.outOrder))
    expect(cq.options.map((o) => o.id).sort()).toEqual(["neither", "queue", "stack"])
    expect(cq.options.some((o) => o.id === cq.answer)).toBe(true)

    const afterClassify = apply(solve(classify), { type: "next" })
    expect(afterClassify.compareStep).toBe(1)
    if (afterClassify.question?.kind !== "contrast") throw new Error("expected contrast")
    expect(afterClassify.question.answer).toBe("stack") // hands you C first

    const done = apply(solve(afterClassify), { type: "next" })
    expect(done.completed).toBe(true)
  })
})

describe("S&Q: the 8-skill mastery gate", () => {
  it("completes only after all 8 graded beats are solved", () => {
    const s = driveTo()
    expect(solvedCount(s)).toBe(8)
    expect(s.completed).toBe(true)
    expect(isComplete(s)).toBe(true)
  })

  it("seven of eight is not complete", () => {
    const seven = resumeStacksQueues(
      {
        counters: {
          stackPredict: 1,
          stackRealworld: 1,
          stackConstruct: 1,
          queuePredict: 1,
          queueRealworld: 1,
          queueConstruct: 1,
          classify: 1,
        },
        currentPart: "compare",
        completed: false,
      },
      SEED,
    )
    expect(solvedCount(seven)).toBe(7)
    expect(isComplete(seven)).toBe(false)
  })
})

describe("S&Q: resume / progress", () => {
  it("squashes to a 0/1 skill map plus attempts", () => {
    const p = toProgress(driveTo())
    expect(p.completed).toBe(true)
    expect(p.counters.classify).toBe(1)
    expect(p.counters.contrast).toBe(1)
    expect(p.counters.attempts).toBe(8) // 8 correct, no wrong attempts
  })

  it("restores the saved beat + solved skills with a cold combo", () => {
    const s = resumeStacksQueues(
      {
        counters: { stackPredict: 1, stackRealworld: 1, stackConstruct: 1 },
        currentPart: "queue-predict",
        completed: false,
      },
      SEED,
    )
    expect(currentPart(s)).toBe("queue-predict")
    expect(solvedCount(s)).toBe(3)
    expect(s.combo).toBe(0)
    expect(s.completed).toBe(false)
  })
})

describe("S&Q: determinism", () => {
  it("the same seed yields identical initial state", () => {
    expect(createStacksQueues(SEED)).toEqual(createStacksQueues(SEED))
  })
})

describe("S&Q: predictAnswer (pure, by ask)", () => {
  const cells: Cell[] = [
    { id: "D", label: "D" },
    { id: "C", label: "C" },
    { id: "B", label: "B" },
    { id: "A", label: "A" },
  ]

  it("first-out is the exit end; last-out is the deep end", () => {
    expect(predictAnswer(cells, { kind: "first-out" })).toBe("D")
    expect(predictAnswer(cells, { kind: "last-out" })).toBe("A")
  })

  it("after-k returns the cell on top once the first k have left", () => {
    expect(predictAnswer(cells, { kind: "after-k", k: 1 })).toBe("C")
    expect(predictAnswer(cells, { kind: "after-k", k: 2 })).toBe("B")
    expect(predictAnswer(cells, { kind: "after-k", k: 3 })).toBe("A")
  })

  it("after-k rejects k outside 0 < k < length", () => {
    expect(() => predictAnswer(cells, { kind: "after-k", k: 0 })).toThrow()
    expect(() => predictAnswer(cells, { kind: "after-k", k: 4 })).toThrow()
  })
})

describe("S&Q: drain selectors", () => {
  it("drainOrder reverses for a stack and preserves for a queue", () => {
    expect(drainOrder(["A", "B", "C"], "stack")).toEqual(["C", "B", "A"])
    expect(drainOrder(["A", "B", "C"], "queue")).toEqual(["A", "B", "C"])
  })

  it("targetEmitStep is 1-based and discipline-aware (0 when absent)", () => {
    expect(targetEmitStep(["A", "B", "C"], "C", "stack")).toBe(1)
    expect(targetEmitStep(["A", "B", "C"], "C", "queue")).toBe(3)
    expect(targetEmitStep(["A", "B", "C"], "A", "stack")).toBe(3)
    expect(targetEmitStep(["A", "B", "C"], "Z", "queue")).toBe(0)
  })
})

describe("S&Q: classifyVerdict + bank", () => {
  it("reverse is a stack, same is a queue, anything else is neither", () => {
    expect(classifyVerdict(["A", "B", "C"], ["C", "B", "A"])).toBe("stack")
    expect(classifyVerdict(["A", "B", "C"], ["A", "B", "C"])).toBe("queue")
    expect(classifyVerdict(["A", "B", "C"], ["C", "A", "B"])).toBe("neither")
    expect(classifyVerdict(["A", "B", "C"], ["B", "A", "C"])).toBe("neither")
  })

  it("every CLASSIFY_BANK instance maps to exactly one discipline", () => {
    const eq = (a: string[], b: string[]) =>
      a.length === b.length && a.every((x, i) => x === b[i])
    for (const { inOrder, outOrder } of CLASSIFY_BANK) {
      const isStack = eq(outOrder, [...inOrder].reverse())
      const isQueue = eq(outOrder, inOrder)
      const matches = [isStack, isQueue, !isStack && !isQueue].filter(Boolean)
      expect(matches).toHaveLength(1)
      expect(classifyVerdict(inOrder, outOrder)).toBe(
        isStack ? "stack" : isQueue ? "queue" : "neither",
      )
    }
  })

  it("the bank covers all three verdicts", () => {
    const verdicts = CLASSIFY_BANK.map((i) => classifyVerdict(i.inOrder, i.outOrder))
    expect(new Set(verdicts)).toEqual(new Set(["stack", "queue", "neither"]))
  })
})

describe("S&Q: classify selection is seed-deterministic", () => {
  it("the same seed selects the same bank instance and offers three options", () => {
    const a = driveTo("compare").question
    const b = driveTo("compare").question
    if (a?.kind !== "classify" || b?.kind !== "classify") {
      throw new Error("expected classify")
    }
    expect({ inOrder: a.inOrder, outOrder: a.outOrder }).toEqual({
      inOrder: b.inOrder,
      outOrder: b.outOrder,
    })
    expect(CLASSIFY_BANK).toContainEqual({ inOrder: a.inOrder, outOrder: a.outOrder })
    expect(a.options).toHaveLength(3)
  })
})

describe("S&Q: real-world predict skins (browser-back + printer)", () => {
  it("stack real-world wears the browser theme: 4 pages, answer is the top (newest)", () => {
    const q = driveTo("stack-realworld").question!
    if (q.kind !== "predict") throw new Error("expected predict")
    expect(q.theme).toBe("browser")
    expect(q.discipline).toBe("stack")
    expect(q.cells).toHaveLength(4)
    expect(q.ask).toEqual({ kind: "first-out" })
    // container order is reverse(arrival); cells[0] = newest visited = the answer
    expect(q.answer).toBe(q.cells[0].id)
    expect(q.cells[0].id).toBe(q.arrival[q.arrival.length - 1])
  })

  it("queue real-world wears the printer theme: 4 documents, answer is the front (oldest)", () => {
    const q = driveTo("queue-realworld").question!
    if (q.kind !== "predict") throw new Error("expected predict")
    expect(q.theme).toBe("printer")
    expect(q.discipline).toBe("queue")
    expect(q.cells).toHaveLength(4)
    expect(q.ask).toEqual({ kind: "first-out" })
    // a queue keeps order; cells[0] = first arrived = the answer
    expect(q.answer).toBe(q.cells[0].id)
    expect(q.cells[0].id).toBe(q.arrival[0])
  })

  it("real-world copy carries no em dash (locked content rule)", () => {
    for (const part of ["stack-realworld", "queue-realworld"] as const) {
      const q = driveTo(part).question!
      const text = [q.prompt, q.hint, q.nudge, q.correct, q.why].join(" ")
      expect(text).not.toContain("\u2014")
    }
  })
})

describe("S&Q: contrast verdict is the earlier emitter", () => {
  it("the contrast answer is the discipline with the smaller targetEmitStep", () => {
    const contrast = driveTo("compare:contrast").question
    if (contrast?.kind !== "contrast") throw new Error("expected contrast")
    const { arrival, target, answer } = contrast
    const stackStep = targetEmitStep(arrival, target, "stack")
    const queueStep = targetEmitStep(arrival, target, "queue")
    expect(answer).toBe(stackStep < queueStep ? "stack" : "queue")
  })
})
