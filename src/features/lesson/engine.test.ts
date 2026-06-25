import { describe, it, expect } from "vitest"
import {
  answerOf,
  createLesson,
  lessonReducer,
  currentPart,
  isComplete,
  isTerminal,
  reconcile,
  resumeLesson,
  type LessonProgress,
  type LessonState,
  type LessonAction,
  type Question,
  type PredictionQuestion,
  type ScenarioQuestion,
} from "./engine"
import { SCENARIO_POOL } from "./scenarios"

/**
 * Behavior-focused tests for the Willow lesson engine (see CONTEXT.md).
 *
 * Everything is driven through dispatched actions and asserted via external
 * behavior — feedback verdict, revealed/showWhy flags, correct-counts, combo,
 * completed/isComplete — never private internals. A FIXED seed (42) keeps the
 * shuffles deterministic so the "same state → same feedback" guarantee holds.
 */

const SEED = 42

/* -------------------------------- helpers -------------------------------- */

function fresh(): LessonState {
  return createLesson(SEED)
}

function apply(state: LessonState, ...actions: LessonAction[]): LessonState {
  return actions.reduce(lessonReducer, state)
}

function asPrediction(q: Question | null): PredictionQuestion {
  if (!q || q.kind === "scenario") {
    throw new Error("expected a prediction question")
  }
  return q
}

function asScenario(q: Question | null): ScenarioQuestion {
  if (!q || q.kind !== "scenario") {
    throw new Error("expected a scenario question")
  }
  return q
}

/** Select the top/front card (cards[0]) and check — the only correct answer. */
function correctPredict(s: LessonState): LessonState {
  const top = asPrediction(s.question).cards[0]
  return apply(s, { type: "select", letter: top }, { type: "check" })
}

/** Select a non-top card (default cards[1]) and check — always wrong. */
function wrongPredict(s: LessonState, idx = 1): LessonState {
  const card = asPrediction(s.question).cards[idx]
  return apply(s, { type: "select", letter: card }, { type: "check" })
}

function correctScenario(s: LessonState): LessonState {
  const answer = asScenario(s.question).scenario.answer
  return apply(s, { type: "select", letter: answer }, { type: "check" })
}

function wrongScenario(s: LessonState): LessonState {
  const { scenario } = asScenario(s.question)
  const wrong = scenario.options.find((o) => o.id !== scenario.answer)
  if (!wrong) throw new Error("scenario has no wrong option")
  return apply(s, { type: "select", letter: wrong.id }, { type: "check" })
}

/** Answer the current question correctly regardless of kind. */
function answerCorrect(s: LessonState): LessonState {
  return s.question?.kind === "scenario" ? correctScenario(s) : correctPredict(s)
}

/* Navigation: `continue` advances unconditionally part-to-part, so it is a
 * deterministic way to reach a given part for isolated unit tests. */
function atStackPop(): LessonState {
  return apply(fresh(), { type: "continue" })
}

function atQueueDequeue(): LessonState {
  return apply(fresh(), { type: "continue" }, { type: "continue" }, { type: "continue" })
}

function atScenario(): LessonState {
  return apply(
    fresh(),
    { type: "continue" },
    { type: "continue" },
    { type: "continue" },
    { type: "continue" },
  )
}

/** Drive the full mastery path: 3 pops, 3 dequeues, 4 scenarios — all correct. */
function happyPath(seed = SEED): LessonState {
  let s = createLesson(seed)
  s = apply(s, { type: "continue" }) // stack-build -> stack-pop
  for (let i = 0; i < 3; i++) {
    s = answerCorrect(s)
    s = apply(s, { type: "next" })
  }
  // 3rd correct pop + next advances to queue-build
  s = apply(s, { type: "continue" }) // queue-build -> queue-dequeue
  for (let i = 0; i < 3; i++) {
    s = answerCorrect(s)
    s = apply(s, { type: "next" })
  }
  // 3rd correct dequeue + next advances to scenario
  for (let i = 0; i < 4; i++) {
    s = answerCorrect(s)
    s = apply(s, { type: "next" })
  }
  return s
}

/* ------------------------------ 1. build parts ------------------------------ */

describe("build parts", () => {
  it("build-step appends A, B, C in order (and caps at 3)", () => {
    let s = fresh()
    expect(currentPart(s)).toBe("stack-build")
    expect(s.built).toEqual([])

    s = apply(s, { type: "build-step" })
    expect(s.built).toEqual(["A"])
    s = apply(s, { type: "build-step" })
    expect(s.built).toEqual(["A", "B"])
    s = apply(s, { type: "build-step" })
    expect(s.built).toEqual(["A", "B", "C"])

    // a 4th build-step is a no-op — the build holds three cards
    s = apply(s, { type: "build-step" })
    expect(s.built).toEqual(["A", "B", "C"])
  })

  it("continue advances from stack-build to stack-pop", () => {
    const s = apply(fresh(), { type: "continue" })
    expect(currentPart(s)).toBe("stack-pop")
    expect(asPrediction(s.question).kind).toBe("pop")
  })

  it("continue advances from queue-build to queue-dequeue", () => {
    let s = apply(fresh(), { type: "continue" }, { type: "continue" })
    expect(currentPart(s)).toBe("queue-build")
    expect(s.built).toEqual([])

    s = apply(s, { type: "build-step" }, { type: "build-step" }, { type: "build-step" })
    expect(s.built).toEqual(["A", "B", "C"])

    s = apply(s, { type: "continue" })
    expect(currentPart(s)).toBe("queue-dequeue")
    expect(asPrediction(s.question).kind).toBe("dequeue")
  })
})

/* ------------------ 2. LIFO/FIFO — only the top/front leaves ------------------ */

describe("LIFO / FIFO — only the top/front leaves", () => {
  it("stack-pop: only cards[0] (the top) is correct", () => {
    const top = asPrediction(atStackPop().question).cards[0]

    const correct = correctPredict(atStackPop())
    expect(correct.feedback).toBe("correct")
    expect(correct.popsCorrect).toBe(1)

    // every non-top card is a wrong verdict (deterministic identical instance)
    for (const idx of [1, 2]) {
      const wrong = wrongPredict(atStackPop(), idx)
      expect(wrong.feedback).not.toBe("correct")
      expect(wrong.popsCorrect).toBe(0)
    }

    // the engine's stored answer is exactly the top card
    expect(asPrediction(atStackPop().question).answer).toBe(top)
  })

  it("queue-dequeue: only cards[0] (the front) is correct", () => {
    const correct = correctPredict(atQueueDequeue())
    expect(correct.feedback).toBe("correct")
    expect(correct.dequeuesCorrect).toBe(1)

    for (const idx of [1, 2]) {
      const wrong = wrongPredict(atQueueDequeue(), idx)
      expect(wrong.feedback).not.toBe("correct")
      expect(wrong.dequeuesCorrect).toBe(0)
    }

    expect(asPrediction(atQueueDequeue().question).answer).toBe(
      asPrediction(atQueueDequeue().question).cards[0],
    )
  })
})

/* ------------------------- 3. feedback state machine ------------------------- */

describe("feedback state machine", () => {
  it("1st wrong -> nudge: wrongCount++, SAME instance retained, count unchanged", () => {
    const start = atStackPop()
    const question = start.question
    const s = wrongPredict(start)

    expect(s.feedback).toBe("nudge")
    expect(s.wrongCount).toBe(1)
    expect(s.question).toBe(question) // same instance retained for the retry
    expect(s.revealed).toBe(false)
    expect(s.popsCorrect).toBe(0)
  })

  it("2nd wrong -> fail + revealed, the part's correct-count UNCHANGED", () => {
    let s = atStackPop()
    s = wrongPredict(s) // nudge
    s = wrongPredict(s) // fail

    expect(s.feedback).toBe("fail")
    expect(s.revealed).toBe(true)
    expect(s.wrongCount).toBe(2)
    expect(s.popsCorrect).toBe(0)
  })

  it("correct -> correct + revealed + correct-count +1", () => {
    const s = correctPredict(atStackPop())

    expect(s.feedback).toBe("correct")
    expect(s.revealed).toBe(true)
    expect(s.popsCorrect).toBe(1)
  })

  it("a correct verdict locks further select/check", () => {
    const s = correctPredict(atStackPop())
    const other = asPrediction(s.question).cards[1]
    const locked = apply(s, { type: "select", letter: other }, { type: "check" })

    expect(locked.feedback).toBe("correct")
    expect(locked.popsCorrect).toBe(1) // no double-count
  })
})

/* -------------------------- 4. answer withheld ------------------------------- */

describe("answer withheld until fail or reveal", () => {
  it("revealed stays false through a nudge; showWhy only flips after a reveal", () => {
    let s = atStackPop()
    expect(s.revealed).toBe(false)
    expect(s.showWhy).toBe(false)

    s = wrongPredict(s) // nudge
    expect(s.feedback).toBe("nudge")
    expect(s.revealed).toBe(false) // correction withheld
    expect(s.showWhy).toBe(false)

    s = apply(s, { type: "reveal" }) // learner taps "Why?"
    expect(s.showWhy).toBe(true)
    expect(s.revealed).toBe(false) // still no fail/correct, so not revealed
  })

  it("revealed becomes true once an attempt fails", () => {
    let s = atStackPop()
    s = wrongPredict(s)
    s = wrongPredict(s)
    expect(s.revealed).toBe(true)
  })

  it("revealed becomes true on a correct answer", () => {
    expect(correctPredict(atStackPop()).revealed).toBe(true)
  })
})

/* --------------------------- 5. quota gating (wall) -------------------------- */

describe("quota gating — the hard until-correct wall", () => {
  it("next is a no-op unless the current verdict is correct", () => {
    const s = atStackPop()
    expect(apply(s, { type: "next" })).toBe(s) // idle -> unchanged
    const failed = wrongPredict(wrongPredict(s))
    expect(apply(failed, { type: "next" })).toBe(failed) // fail -> unchanged
  })

  it("stack-pop: cannot leave until popsCorrect === 3", () => {
    let s = atStackPop()

    s = correctPredict(s) // 1
    s = apply(s, { type: "next" })
    expect(currentPart(s)).toBe("stack-pop") // quota unmet -> stay, fresh question
    expect(s.popsCorrect).toBe(1)
    expect(s.feedback).toBe("idle")
    expect(asPrediction(s.question).kind).toBe("pop")

    s = correctPredict(s) // 2
    s = apply(s, { type: "next" })
    expect(currentPart(s)).toBe("stack-pop")
    expect(s.popsCorrect).toBe(2)

    s = correctPredict(s) // 3 — quota met
    expect(s.popsCorrect).toBe(3)
    expect(currentPart(s)).toBe("stack-pop") // still here until next
    s = apply(s, { type: "next" })
    expect(currentPart(s)).toBe("queue-build") // advances
  })

  it("queue-dequeue: cannot leave until dequeuesCorrect === 3", () => {
    let s = atQueueDequeue()

    for (let i = 1; i <= 2; i++) {
      s = correctPredict(s)
      s = apply(s, { type: "next" })
      expect(currentPart(s)).toBe("queue-dequeue")
      expect(s.dequeuesCorrect).toBe(i)
    }

    s = correctPredict(s) // 3rd
    expect(s.dequeuesCorrect).toBe(3)
    s = apply(s, { type: "next" })
    expect(currentPart(s)).toBe("scenario") // advances
  })

  it("scenario: cannot finish until scenariosCorrect === 4", () => {
    let s = atScenario()

    for (let i = 1; i <= 3; i++) {
      s = correctScenario(s)
      expect(s.scenariosCorrect).toBe(i)
      s = apply(s, { type: "next" })
      expect(currentPart(s)).toBe("scenario")
      expect(s.completed).toBe(false)
    }

    s = correctScenario(s) // 4th
    expect(s.scenariosCorrect).toBe(4)
    s = apply(s, { type: "next" })
    expect(s.completed).toBe(true)
  })
})

/* ----------------------------- 6. completion gate ---------------------------- */

describe("completion gate (3 pops + 3 dequeues + 4 scenarios)", () => {
  it("drives the full happy path to completion", () => {
    const s = happyPath()
    expect(s.popsCorrect).toBe(3)
    expect(s.dequeuesCorrect).toBe(3)
    expect(s.scenariosCorrect).toBe(4)
    expect(s.completed).toBe(true)
    expect(isComplete(s)).toBe(true)
  })

  it("isComplete is true ONLY when every quota is met", () => {
    const part = "scenario" as const
    expect(
      isComplete(
        resumeLesson({ counters: { pops: 3, dequeues: 3, scenarios: 4 }, currentPart: part }, SEED),
      ),
    ).toBe(true)

    // each single missing quota keeps it incomplete
    expect(
      isComplete(
        resumeLesson({ counters: { pops: 2, dequeues: 3, scenarios: 4 }, currentPart: part }, SEED),
      ),
    ).toBe(false)
    expect(
      isComplete(
        resumeLesson({ counters: { pops: 3, dequeues: 2, scenarios: 4 }, currentPart: part }, SEED),
      ),
    ).toBe(false)
    expect(
      isComplete(
        resumeLesson({ counters: { pops: 3, dequeues: 3, scenarios: 3 }, currentPart: part }, SEED),
      ),
    ).toBe(false)
  })

  it("failed / revealed answers never increment a count", () => {
    // two wrongs -> fail, count stays 0
    const failed = wrongPredict(wrongPredict(atStackPop()))
    expect(failed.feedback).toBe("fail")
    expect(failed.popsCorrect).toBe(0)

    // a nudge + reveal also leaves the count untouched
    const revealed = apply(wrongPredict(atStackPop()), { type: "reveal" })
    expect(revealed.showWhy).toBe(true)
    expect(revealed.popsCorrect).toBe(0)
  })
})

/* ----------------------------- 7. flame combo ------------------------------- */

describe("flame combo (on-fire effect)", () => {
  it("increments on each correct answer, counted lesson-wide across parts", () => {
    let s = atStackPop()
    s = correctPredict(s) // combo 1 (a pop)
    expect(s.combo).toBe(1)

    // cross part boundaries — the chain is one lesson-wide streak
    s = apply(s, { type: "continue" }, { type: "continue" }) // -> queue-dequeue
    expect(currentPart(s)).toBe("queue-dequeue")
    expect(s.combo).toBe(1) // survives the part change

    s = correctPredict(s) // combo 2 (a dequeue follows the pop)
    expect(s.combo).toBe(2)
  })

  it("a flawless full run climbs the combo the whole way (no cap in the engine)", () => {
    expect(happyPath().combo).toBe(10) // 3 + 3 + 4 correct answers
  })

  it("survives a single wrong-then-recovered attempt", () => {
    let s = atStackPop()
    s = correctPredict(s) // combo 1
    s = apply(s, { type: "next" }) // fresh question, combo preserved
    expect(s.combo).toBe(1)

    s = wrongPredict(s) // nudge — NOT a full fail
    expect(s.feedback).toBe("nudge")
    expect(s.combo).toBe(1) // fire kept through the fumble

    s = correctPredict(s) // recover on the same instance
    expect(s.feedback).toBe("correct")
    expect(s.combo).toBe(2) // keeps climbing
  })

  it("resets to 0 only on a full fail (two wrong)", () => {
    let s = atStackPop()
    s = correctPredict(s)
    s = apply(s, { type: "next" })
    s = correctPredict(s)
    expect(s.combo).toBe(2)

    s = apply(s, { type: "next" }) // fresh question, combo 2
    s = wrongPredict(s) // nudge, combo still 2
    expect(s.combo).toBe(2)
    s = wrongPredict(s) // full fail -> breaks the fire
    expect(s.feedback).toBe("fail")
    expect(s.combo).toBe(0)
  })

  it("starts cold (0) after resume", () => {
    const s = resumeLesson(
      { counters: { pops: 3, dequeues: 1, scenarios: 0 }, currentPart: "queue-dequeue" },
      SEED,
    )
    expect(s.combo).toBe(0)
  })
})

/* --------------------------- 8. scenario selection -------------------------- */

describe("scenario selection (pool of 8, draw 4)", () => {
  it("draws exactly 4 unique scenarios from indices 0..7", () => {
    expect(SCENARIO_POOL).toHaveLength(8)

    const order = fresh().scenarioOrder
    expect(order).toHaveLength(4)
    expect(new Set(order).size).toBe(4) // unique
    for (const i of order) {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(8)
    }
  })

  it("is deterministic — the same seed reproduces the same draw", () => {
    expect(createLesson(SEED).scenarioOrder).toEqual(createLesson(SEED).scenarioOrder)
  })

  it("reattempt on a failed scenario retries the SAME scenario", () => {
    let s = atScenario()
    const firstId = asScenario(s.question).scenario.id

    s = wrongScenario(s) // nudge
    s = wrongScenario(s) // fail
    expect(s.feedback).toBe("fail")

    s = apply(s, { type: "reattempt" })
    expect(asScenario(s.question).scenario.id).toBe(firstId) // same scenario
    expect(s.feedback).toBe("idle")
    expect(s.wrongCount).toBe(0)
    expect(s.scenariosCorrect).toBe(0)
  })

  it("a correct answer + next advances to the next drawn scenario", () => {
    let s = atScenario()
    const order = s.scenarioOrder
    expect(asScenario(s.question).scenario.id).toBe(SCENARIO_POOL[order[0]].id)

    s = correctScenario(s)
    s = apply(s, { type: "next" })
    expect(asScenario(s.question).scenario.id).toBe(SCENARIO_POOL[order[1]].id)
  })
})

/* ------------------------------- 9. resume ---------------------------------- */

describe("resumeLesson", () => {
  it("restores the persisted part, counts, and a cold combo", () => {
    const s = resumeLesson(
      { counters: { pops: 3, dequeues: 3, scenarios: 2 }, currentPart: "scenario" },
      SEED,
    )
    expect(currentPart(s)).toBe("scenario")
    expect(s.popsCorrect).toBe(3)
    expect(s.dequeuesCorrect).toBe(3)
    expect(s.scenariosCorrect).toBe(2)
    expect(s.combo).toBe(0)
    expect(isComplete(s)).toBe(false) // scenarios quota not yet met
  })

  it("resumes a prediction part with a fresh question of the right kind", () => {
    const s = resumeLesson(
      { counters: { pops: 3, dequeues: 0, scenarios: 0 }, currentPart: "queue-dequeue" },
      SEED,
    )
    expect(currentPart(s)).toBe("queue-dequeue")
    expect(asPrediction(s.question).kind).toBe("dequeue")
    expect(s.feedback).toBe("idle")
    expect(isComplete(s)).toBe(false)
  })

  it("isComplete reflects carried counts when every quota is met", () => {
    const s = resumeLesson(
      { counters: { pops: 3, dequeues: 3, scenarios: 4 }, currentPart: "scenario" },
      SEED,
    )
    expect(isComplete(s)).toBe(true)
  })

  it("clamps over-large persisted counts to their quotas", () => {
    const s = resumeLesson(
      { counters: { pops: 99, dequeues: 99, scenarios: 99 }, currentPart: "scenario" },
      SEED,
    )
    expect(s.popsCorrect).toBe(3)
    expect(s.dequeuesCorrect).toBe(3)
    expect(s.scenariosCorrect).toBe(4)
    expect(isComplete(s)).toBe(true)
  })
})

/* ----------------------------- 10. reconcile -------------------------------- */

describe("reconcile (sign-in)", () => {
  it("noop for a brand-new account with a fresh run", () => {
    // server null = account never saved; a fresh run has earned nothing.
    expect(reconcile(fresh(), null)).toEqual({ kind: "noop" })
  })

  it("carry-up for a brand-new account with an in-flight run", () => {
    const local = correctPredict(atStackPop()) // earned 1 correct pop
    expect(reconcile(local, null)).toEqual({
      kind: "carry-up",
      progress: {
        counters: { pops: 1, dequeues: 0, scenarios: 0, attempts: 1 },
        currentPart: "stack-pop",
        completed: false,
      },
    })
  })

  it("resume from a returning account's saved progress", () => {
    const server: LessonProgress = {
      counters: { pops: 3, dequeues: 1, scenarios: 0 },
      currentPart: "queue-dequeue",
      completed: false,
    }
    const plan = reconcile(fresh(), server, SEED)
    expect(plan.kind).toBe("resume")
    if (plan.kind !== "resume") return
    expect(currentPart(plan.state)).toBe("queue-dequeue")
    expect(plan.state.popsCorrect).toBe(3)
    expect(plan.state.dequeuesCorrect).toBe(1)
    expect(plan.state.combo).toBe(0) // fire is transient — cold on resume
    expect(plan.state.completed).toBe(false)
    expect(isComplete(plan.state)).toBe(false)
  })

  it("resume marks the run complete when the server says so", () => {
    const server: LessonProgress = {
      counters: { pops: 3, dequeues: 3, scenarios: 4 },
      currentPart: "scenario",
      completed: true,
    }
    const plan = reconcile(fresh(), server, SEED)
    expect(plan.kind).toBe("resume")
    if (plan.kind !== "resume") return
    expect(plan.state.completed).toBe(true)
    expect(isComplete(plan.state)).toBe(true)
  })

  it("server wins even when the local run has progress (no merge)", () => {
    const local = correctPredict(atStackPop()) // local earned a pop...
    const server: LessonProgress = {
      counters: { pops: 0, dequeues: 0, scenarios: 0 },
      currentPart: "stack-pop",
      completed: false,
    }
    const plan = reconcile(local, server, SEED)
    expect(plan.kind).toBe("resume") // ...not carried up
    if (plan.kind !== "resume") return
    expect(plan.state.popsCorrect).toBe(0) // server's counts, not the local 1
  })
})

/* ----------------------------- 11. selectors -------------------------------- */

describe("answerOf", () => {
  it("is the top card for a prediction and the scenario's answer for a scenario", () => {
    const pop = asPrediction(atStackPop().question)
    expect(answerOf(pop)).toBe(pop.cards[0])

    const sc = asScenario(atScenario().question)
    expect(answerOf(sc)).toBe(sc.scenario.answer)
  })
})

describe("isTerminal", () => {
  it("is true only after a correct or failed verdict", () => {
    expect(isTerminal(atStackPop())).toBe(false) // idle
    expect(isTerminal(wrongPredict(atStackPop()))).toBe(false) // nudge
    expect(isTerminal(correctPredict(atStackPop()))).toBe(true) // correct
    expect(isTerminal(wrongPredict(wrongPredict(atStackPop())))).toBe(true) // fail
  })
})
