import { useState } from "react"
import { motion, useReducedMotion } from "motion/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FrameSequence } from "@/components/willow/lesson/FrameSequence"
import { useTrialRun } from "@/features/trials/TrialRunProvider"
import { currentSegment } from "@/features/trials/trialModule"
import { simulateLine, type LineOp } from "@/features/trials/simulate"

/** Ids that arrive in the script, in arrival order, de-duplicated. */
function arrivedIds(ops: LineOp[]): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const op of ops) {
    if (op.t === "arrive" && !seen.has(op.id)) {
      seen.add(op.id)
      ids.push(op.id)
    }
  }
  return ids
}

/** A plain-language line for one program step. */
function programStep(op: LineOp): string {
  switch (op.t) {
    case "arrive":
      return `${op.id} arrives at the back`
    case "serve":
      return "Serve the student at the front"
    case "leaveMiddle":
      return `${op.id} cancels from the middle`
    case "undo":
      return "Undo the most recent action"
  }
}

interface ReplayFrame {
  line: string[]
  caption: string
}

/**
 * Per-step line snapshots for the replay, mirroring `simulateLine`'s snapshot/undo
 * logic so the walkthrough matches the graded truth exactly. Frame 0 is the empty
 * line; each later frame is the line after that step.
 */
function replayFrames(ops: LineOp[]): ReplayFrame[] {
  const frames: ReplayFrame[] = [{ line: [], caption: "The line starts empty." }]
  let line: string[] = []
  const history: { before: string[] }[] = []
  for (const op of ops) {
    if (op.t === "arrive") {
      history.push({ before: [...line] })
      line = [...line, op.id]
      frames.push({ line: [...line], caption: `${op.id} joins the back.` })
    } else if (op.t === "serve") {
      const served = line[0]
      history.push({ before: [...line] })
      line = line.slice(1)
      frames.push({
        line: [...line],
        caption: served ? `${served} is served from the front.` : "Serve the front.",
      })
    } else if (op.t === "leaveMiddle") {
      history.push({ before: [...line] })
      line = line.filter((x) => x !== op.id)
      frames.push({ line: [...line], caption: `${op.id} cancels from the middle.` })
    } else {
      const h = history.pop()
      if (h) line = h.before
      frames.push({ line: [...line], caption: "Undo reverses the most recent action." })
    }
  }
  return frames
}

/** A row of cards for the current line; the front (index 0) is accented. */
function LineRow({ line }: { line: string[] }) {
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-center gap-1.5">
      {line.length === 0 ? (
        <span className="text-xs text-muted-foreground">(empty line)</span>
      ) : (
        line.map((id, i) => (
          <div
            key={`${id}-${i}`}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg border text-sm font-semibold",
              i === 0
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {id}
          </div>
        ))
      )}
    </div>
  )
}

/**
 * The A4-style final review: a prediction graded against the event-script simulator
 * (not the capability matrix). In the design phase the learner reads the program and
 * predicts the front; the verdict phase replays the script step by step and, on a
 * wrong call, names where the trace diverged. Recovery is forgiving: a correct
 * prediction continues, a wrong one re-opens the trace.
 */
export function PredictionReview() {
  const { state, dispatch } = useTrialRun()
  const segment = currentSegment(state)
  const script = (segment.eventScript ?? []) as LineOp[]
  const candidates = arrivedIds(script)
  const reduce = useReducedMotion() ?? false
  const [picked, setPicked] = useState<string | null>(null)

  if (state.phase === "design") {
    return (
      <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Trace the program
        </p>
        <ol className="mt-3 space-y-1.5">
          {script.map((op, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              {programStep(op)}
            </li>
          ))}
        </ol>

        <p className="mt-5 text-base font-medium text-foreground">
          Who is at the front of the line now?
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {candidates.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={picked === id}
              onClick={() => setPicked(id)}
              className={cn(
                "flex size-11 items-center justify-center rounded-xl border text-base font-semibold transition",
                picked === id
                  ? "border-primary bg-primary text-primary-foreground shadow-pop"
                  : "border-border bg-card text-foreground hover:border-primary/60",
              )}
            >
              {id}
            </button>
          ))}
        </div>

        <Button
          variant="tactile"
          size="lg"
          className="mt-5 w-full"
          disabled={picked == null}
          onClick={() =>
            dispatch({ type: "submit-prediction", prediction: { front: picked } })
          }
        >
          Lock in prediction
        </Button>
      </section>
    )
  }

  const correct = state.verdict?.status === "viable"
  const truthFront = simulateLine(script).front
  const tone = correct
    ? {
        label: "Correct",
        panel: "border-success/50 bg-success-soft",
        accent: "text-success-foreground",
      }
    : {
        label: "Not yet",
        panel: "border-danger/60 bg-danger-soft",
        accent: "text-danger-foreground",
      }

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-3xl border-2 border-border bg-card p-5 shadow-card"
    >
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/30 px-3 py-5">
        <FrameSequence frames={replayFrames(script)} controls reduced={reduce}>
          {(frame) => (
            <div className="flex flex-col items-center gap-2">
              <LineRow line={frame.line} />
              <p className="text-center text-xs text-muted-foreground">{frame.caption}</p>
            </div>
          )}
        </FrameSequence>
      </div>

      <div className={cn("mt-4 rounded-2xl border p-4", tone.panel)}>
        <p className={cn("text-xs font-semibold uppercase tracking-wide", tone.accent)}>
          {tone.label}
        </p>
        {!correct && picked != null && (
          <p className="mt-2 text-sm text-foreground">
            You predicted <strong>{picked}</strong>, but the front ends up being{" "}
            <strong>{truthFront ?? "no one"}</strong>.
          </p>
        )}
        <p className="mt-2 text-base leading-relaxed text-foreground">
          {state.verdict ? segment.explanations[state.verdict.status] : ""}
        </p>
      </div>

      <div className="mt-5">
        {correct ? (
          <Button
            variant="tactile"
            size="lg"
            className="w-full"
            onClick={() => dispatch({ type: "advance" })}
          >
            Continue
          </Button>
        ) : (
          <Button
            variant="tactile"
            size="lg"
            className="w-full"
            onClick={() => {
              setPicked(null)
              dispatch({ type: "revise" })
            }}
          >
            Try the trace again
          </Button>
        )}
      </div>
    </motion.section>
  )
}
