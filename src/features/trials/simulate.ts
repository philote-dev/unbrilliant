export type LineOp =
  | { t: "arrive"; id: string }
  | { t: "serve" }
  | { t: "leaveMiddle"; id: string }
  | { t: "undo" }

export interface LineResult {
  front: string | null
  line: string[]
  lastUndoReversed: string | null
}

export function simulateLine(ops: LineOp[]): LineResult {
  let line: string[] = []
  const history: { action: string; before: string[] }[] = []
  let lastUndoReversed: string | null = null
  for (const op of ops) {
    if (op.t === "arrive") {
      history.push({ action: "arrive", before: [...line] })
      line = [...line, op.id]
    } else if (op.t === "serve") {
      history.push({ action: "serve", before: [...line] })
      line = line.slice(1)
    } else if (op.t === "leaveMiddle") {
      history.push({ action: "leaveMiddle", before: [...line] })
      line = line.filter((x) => x !== op.id)
    } else {
      const h = history.pop()
      if (h) {
        lastUndoReversed = h.action
        line = h.before
      }
    }
  }
  return { front: line[0] ?? null, line, lastUndoReversed }
}

export function gradePrediction(
  ops: LineOp[],
  prediction: { front: string | null },
): { correct: boolean; truth: LineResult } {
  const truth = simulateLine(ops)
  return { correct: prediction.front === truth.front, truth }
}
