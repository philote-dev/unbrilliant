/**
 * Diagnose a learner's multi-step stack-buffer attempt.
 *
 * This is the deterministic read of "what went wrong" that an AI hint sits on
 * top of. It is a pure function of the question (arrival + goal) and the
 * learner's operation trace, so it lands on the engine's deterministic test
 * surface with no model call. It returns a concept-agnostic ErrorShape: the
 * first place the attempt steps off the unique correct line, described
 * structurally (a step index and a failure kind) and deliberately WITHOUT naming
 * any answer item, so a hint built from it can stay giveaway-free.
 *
 * Stack-buffer question: items `arrival` come in left to right; you may push the
 * next arrival or pop the top; the popped items, in order, must equal `goal`.
 * Because a pop is only valid when the top is the next needed item, and pushing
 * past a needed item buries it, the correct line is forced (unique). That makes
 * "first divergence from the greedy line" an unambiguous diagnosis.
 */

export type Step = { op: "push"; item: string } | { op: "pop" }

export type ErrorKind =
  | "covered-a-needed-item" // pushed when the needed item was already on top
  | "popped-too-early" // popped when more had to be staged first
  | "popped-empty" // popped with nothing buffered
  | "off-path" // diverged in some other way (fallback)

export interface Diagnosis {
  /** Index into the learner trace of the first step that left the correct line. */
  firstWrongIndex: number
  /** What the learner did at that step. */
  learnerStep: Step
  /** What the unique correct line does at that step. */
  correctStep: Step
  /** Structural failure kind, safe to phrase a hint around (no answer items). */
  kind: ErrorKind
  /** 1-based step number, for human-facing copy ("your third move"). */
  stepNumber: number
}

/** The unique correct line: pop when the top is next needed, else push. */
export function correctLine(arrival: string[], goal: string[]): Step[] {
  const stack: string[] = []
  const incoming = [...arrival]
  const steps: Step[] = []
  let g = 0
  while (g < goal.length) {
    if (stack.length > 0 && stack[stack.length - 1] === goal[g]) {
      steps.push({ op: "pop" })
      stack.pop()
      g += 1
    } else if (incoming.length > 0) {
      const item = incoming.shift() as string
      steps.push({ op: "push", item })
      stack.push(item)
    } else {
      break // goal is not reachable with a single stack; nothing more to stage
    }
  }
  return steps
}

function classify(learnerStep: Step, correctStep: Step, stackWasEmpty: boolean): ErrorKind {
  if (learnerStep.op === "pop" && stackWasEmpty) return "popped-empty"
  // Correct line popped (the needed item was reachable) but the learner pushed:
  // they buried something they could have handed back.
  if (correctStep.op === "pop" && learnerStep.op === "push") return "covered-a-needed-item"
  // Correct line still needed to stage more, but the learner popped.
  if (correctStep.op === "push" && learnerStep.op === "pop") return "popped-too-early"
  return "off-path"
}

/**
 * Returns the first divergence from the correct line, or null when the trace
 * matches the correct line for as far as it goes (i.e. nothing is wrong yet).
 */
export function diagnoseBufferTrace(
  arrival: string[],
  goal: string[],
  trace: Step[],
): Diagnosis | null {
  const correct = correctLine(arrival, goal)
  let depth = 0 // stack depth as we replay the learner's trace
  const upTo = Math.min(trace.length, correct.length)
  for (let i = 0; i < upTo; i += 1) {
    const learnerStep = trace[i]
    const correctStep = correct[i]
    const same =
      learnerStep.op === correctStep.op &&
      (learnerStep.op === "pop" ||
        (correctStep.op === "push" && learnerStep.item === correctStep.item))
    if (!same) {
      return {
        firstWrongIndex: i,
        learnerStep,
        correctStep,
        kind: classify(learnerStep, correctStep, depth === 0),
        stepNumber: i + 1,
      }
    }
    depth += learnerStep.op === "push" ? 1 : -1
  }
  // The learner overran the correct line (extra moves) without matching it.
  if (trace.length > correct.length) {
    const i = correct.length
    return {
      firstWrongIndex: i,
      learnerStep: trace[i],
      correctStep: correct[correct.length - 1] ?? { op: "pop" },
      kind: "off-path",
      stepNumber: i + 1,
    }
  }
  return null
}
