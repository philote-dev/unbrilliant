import { useMemo, type Dispatch } from "react"
import { Shuffle } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AnswerCard, type AnswerState } from "@/components/willow/AnswerCard"
import { CostReadout } from "@/components/willow/CostReadout"
import { FeedbackFooter } from "@/components/willow/FeedbackFooter"
import { StepTransport } from "@/components/willow/StepTransport"
import { useStepPlayer } from "@/components/willow/useStepPlayer"
import type { LessonAction } from "@/features/lesson/engine"
import {
  currentPartArrays,
  isTerminalA,
  partQuotaArrays,
  resizeFrames,
  shiftFrames,
  type ArrayOp,
  type ArrayResize,
  type ArraysState,
} from "@/features/lesson/arraysEngine"
import { ArrayRow } from "./ArrayRow"

export function ArraysStage({
  state,
  dispatch,
}: {
  state: ArraysState
  dispatch: Dispatch<LessonAction>
}) {
  return currentPartArrays(state) === "access" ? (
    <AccessPart state={state} dispatch={dispatch} />
  ) : (
    <PredictPart state={state} dispatch={dispatch} />
  )
}

function AccessPart({
  state,
  dispatch,
}: {
  state: ArraysState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q) return null
  const accessed = state.accessed

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground">
          Arrays: instant access
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
          {q.prompt}
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6">
        <ArrayRow
          cells={q.array}
          highlight={accessed ?? -1}
          onTap={(i) => dispatch({ type: "select", letter: String(i) })}
        />
        {accessed != null && (
          <CostReadout word="free" count={1} unit="step" />
        )}
      </div>

      <div className="mt-auto">
        {accessed != null && (
          <p className="mb-3 text-center text-sm text-muted-foreground">
            Index {accessed} → {q.array[accessed]}. A direct hit: one step, no
            matter how big the array grows.
          </p>
        )}
        <Button
          variant="tactile"
          size="lg"
          className="w-full"
          onClick={() => dispatch({ type: "continue" })}
        >
          Continue
        </Button>
      </div>
    </div>
  )
}

function PredictPart({
  state,
  dispatch,
}: {
  state: ArraysState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  if (!q) return null
  const { feedback, selected, showWhy } = state
  const quota = partQuotaArrays(state)
  const terminal = isTerminalA(state)
  // The op/cost replay reveals the resulting arrangement, so it mounts only AFTER
  // the verdict: on a correct answer, or on a fail once the learner taps Why.
  const reveal = feedback === "correct" || (feedback === "fail" && showWhy)

  const cardState = (id: string): AnswerState => {
    if (feedback === "correct") return id === q.answer ? "correct" : "default"
    if (feedback === "nudge") return id === selected ? "nudge" : "default"
    if (feedback === "fail") {
      // The learner's own wrong pick reads red; the correct answer is revealed
      // (in green) only once they ask Why. Never auto-revealed on the miss.
      if (showWhy && id === q.answer) return "correct"
      if (id === selected) return "fail"
      return "default"
    }
    return id === selected ? "selected" : "default"
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7">
        {quota && (
          <p className="text-center text-xs font-medium uppercase tracking-wide text-lilac-strong">
            {quota.done} / {quota.total} correct
          </p>
        )}
        <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground">
          {q.prompt}
        </h2>
        {/* Re-roll a fresh instance. Gated to the pristine idle state so it can
            never dodge a graded verdict or the until-correct mastery wall. */}
        {feedback === "idle" && (
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => dispatch({ type: "reattempt" })}
              aria-label="Regenerate this example"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Shuffle className="size-3.5" /> New example
            </button>
          </div>
        )}
      </div>

      <div className="mt-5 flex min-h-[72px] justify-center">
        {reveal && q.op ? (
          <ShiftWavePlayer array={q.array} op={q.op} reduced={reduced} />
        ) : reveal && q.resize ? (
          <ResizeViz resize={q.resize} reduced={reduced} />
        ) : q.array.length > 0 ? (
          <ArrayRow cells={q.array} highlight={q.highlight} />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3 py-6">
        {q.options.map((opt, i) => (
          <AnswerCard
            key={opt.id}
            letter={String.fromCharCode(65 + i)}
            label={opt.label}
            state={cardState(opt.id)}
            disabled={terminal}
            answerMarker={opt.id === q.answer}
            onSelect={() => dispatch({ type: "select", letter: opt.id })}
          />
        ))}
      </div>

      {reveal && (
        <div className="mb-4 flex justify-center">
          <CostReadout
            word={q.cost.word}
            count={q.cost.count}
            unit={q.cost.unit}
          />
        </div>
      )}

      <FeedbackFooter
        feedback={feedback}
        selected={selected}
        showWhy={showWhy}
        copy={{
          prompt: q.prompt,
          hint: q.hint,
          nudge: q.nudge,
          correct: q.correct,
          why: q.why,
        }}
        dispatch={dispatch}
      />
    </div>
  )
}

/* ------------------------------ post-verdict viz ----------------------------- */

/** Shared opt-in transport wiring so the wave and the resize viz behave alike. */
function PlaybackTransport({
  player,
  caption,
  label,
}: {
  player: ReturnType<typeof useStepPlayer>
  caption: string
  label: string
}) {
  return (
    <StepTransport
      index={player.index}
      total={player.total}
      playing={player.playing}
      onPlayToggle={player.toggle}
      onPrev={player.prev}
      onNext={player.next}
      onReplay={player.replay}
      onFirst={player.first}
      onLast={player.last}
      onScrub={player.goTo}
      speed={player.speed}
      onSpeedChange={player.setSpeed}
      keyboard
      liveLabel={caption}
      label={label}
    />
  )
}

/**
 * The mid-insert/delete wave-of-shifts replay: a play/step/scrub walk over the
 * pure `shiftFrames`. View-state only (a frame index), mounted post-verdict, so
 * it never leaks or skips the graded answer. Reduced motion starts on the snapped
 * end-state.
 */
function ShiftWavePlayer({
  array,
  op,
  reduced,
}: {
  array: string[]
  op: ArrayOp
  reduced: boolean
}) {
  const frames = useMemo(() => shiftFrames(array, op), [array, op])
  const player = useStepPlayer(frames.length, { reduced, autoPlay: true })
  const frame = frames[Math.min(player.index, frames.length - 1)]
  return (
    <div className="flex flex-col items-center gap-3">
      <ArrayRow frame={frame} opIndex={op.index} reduced={reduced} />
      <p className="min-h-8 max-w-xs text-center text-xs text-muted-foreground">
        {frame.caption}
      </p>
      <PlaybackTransport player={player} caption={frame.caption} label="Shift playback" />
    </div>
  )
}

/**
 * The dynamic-array doubling visualization: when the block is full, allocate a
 * block twice the size and copy everything over (the occasional big reshuffle),
 * then drop the new item in. Same view-only step player as the wave.
 */
function ResizeViz({
  resize,
  reduced,
}: {
  resize: ArrayResize
  reduced: boolean
}) {
  const frames = useMemo(() => resizeFrames(resize), [resize])
  const player = useStepPlayer(frames.length, { reduced, autoPlay: true })
  const frame = frames[Math.min(player.index, frames.length - 1)]
  return (
    <div className="flex flex-col items-center gap-3">
      <ResizeBlock frame={frame} reduced={reduced} />
      <p className="min-h-8 max-w-xs text-center text-xs text-muted-foreground">
        {frame.caption}
      </p>
      <PlaybackTransport player={player} caption={frame.caption} label="Resize playback" />
    </div>
  )
}

function ResizeBlock({
  frame,
  reduced,
}: {
  frame: ReturnType<typeof resizeFrames>[number]
  reduced: boolean
}) {
  return (
    <motion.div
      layout={!reduced}
      data-testid="resize-block"
      data-capacity={frame.capacity}
      data-filled={frame.filled}
      className="flex max-w-[18rem] flex-wrap justify-center gap-1.5"
    >
      {Array.from({ length: frame.capacity }).map((_, i) => {
        const filled = i < frame.filled
        const copying = frame.copying === i
        return (
          <div
            key={i}
            className={cn(
              "flex h-9 w-6 items-center justify-center rounded-md border-2 text-[10px] font-bold transition-colors",
              copying
                ? "border-lilac-strong bg-lilac-soft text-lilac-strong"
                : filled
                  ? "border-border bg-card text-foreground"
                  : "border-dashed border-border/60 text-faint",
            )}
          >
            {filled ? "•" : ""}
          </div>
        )
      })}
    </motion.div>
  )
}
