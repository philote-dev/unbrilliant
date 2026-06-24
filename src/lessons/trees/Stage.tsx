import type { Dispatch } from "react"
import { motion } from "motion/react"

import { Button } from "@/components/ui/button"
import { AnswerCard, type AnswerState } from "@/components/willow/AnswerCard"
import { CostReadout } from "@/components/willow/CostReadout"
import { FeedbackFooter } from "@/components/willow/FeedbackFooter"
import type { LessonAction } from "@/features/lesson/engine"
import {
  binOf,
  canCheckTrees,
  chainWalkDone,
  currentPartTrees,
  descendPath,
  isTerminalTrees,
  nodeById,
  partQuotaTrees,
  type TreesBin,
  type TreesCost,
  type TreesQuestion,
  type TreesState,
} from "@/features/lesson/treesEngine"
import { DisplayTree, TreeFigure } from "./TreeFigure"
import { SortedChain } from "./SortedChain"
import { ContrastRace } from "./ContrastRace"

/**
 * The Trees stage routes the eleven beats across the two faces (descend / locate
 * and in-order / sequence) and the comparison synthesis. Every verdict flows
 * through the shared FeedbackFooter (with its `canCheck` gate + `hideFailHint`
 * SR-only fail copy); the figures are tap-only (no rewire infra).
 */
export function TreesStage({
  state,
  dispatch,
}: {
  state: TreesState
  dispatch: Dispatch<LessonAction>
}) {
  switch (currentPartTrees(state)) {
    case "demo":
      return <DemoPart state={state} dispatch={dispatch} />
    case "teach-descend":
    case "teach-inorder":
      return <TeachPart state={state} dispatch={dispatch} />
    case "find-hit":
    case "find-miss":
    case "insert":
      return <DescendPart state={state} dispatch={dispatch} />
    case "sequence-a":
    case "sequence-b":
      return <SequencePart state={state} dispatch={dispatch} />
    case "realworld":
      return <RealWorldPart state={state} dispatch={dispatch} />
    case "compare-shape":
      return <ComparePart state={state} dispatch={dispatch} />
    case "contrast-list":
      return <ContrastPart state={state} dispatch={dispatch} />
  }
}

/* ------------------------------ shared pieces ------------------------------ */

const BIN_LABEL: Record<TreesBin, string> = {
  locate: "Locate",
  sequence: "Sequence",
  comparison: "Comparison",
}

function BinHeader({ state }: { state: TreesState }) {
  const q = state.question
  if (!q) return null
  const bin = binOf(currentPartTrees(state))
  const quota = partQuotaTrees(state)
  return (
    <div className="mt-7">
      {bin && quota && (
        <p className="text-center text-xs font-medium uppercase tracking-wide text-lilac-strong">
          {BIN_LABEL[bin]} · {quota.done} / {quota.total} correct
        </p>
      )}
      <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground">
        {q.prompt}
      </h2>
    </div>
  )
}

const feedbackCopy = (q: TreesQuestion) => ({
  prompt: q.prompt,
  hint: q.hint,
  nudge: q.nudge,
  correct: q.correct,
  why: q.why,
})

function LabeledCost({ label, cost }: { label: string; cost: TreesCost }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <CostReadout word={cost.word} count={cost.count} unit={cost.unit} />
    </div>
  )
}

function mcqCardState(
  state: TreesState,
  id: string,
  answer: string,
): AnswerState {
  const { feedback, selected, showWhy } = state
  if (feedback === "correct") return id === answer ? "correct" : "default"
  if (feedback === "nudge") return id === selected ? "nudge" : "default"
  if (feedback === "fail") {
    if (showWhy && id === answer) return "correct"
    if (id === selected) return "fail"
    return "default"
  }
  return id === selected ? "selected" : "default"
}

/* --------------------------------- beat 1 --------------------------------- */

function DemoPart({
  state,
  dispatch,
}: {
  state: TreesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q) return null
  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground">Trees: descend to search</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">{q.prompt}</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-5">
        <TreeFigure state={state} dispatch={dispatch} />
      </div>

      <div className="mt-auto">
        <p className="mb-3 text-center text-sm text-muted-foreground">
          Each tap compares and steps down — the half you skip drops away.
        </p>
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

/* ------------------------------- teach beats ------------------------------ */

function TeachPart({
  state,
  dispatch,
}: {
  state: TreesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q) return null
  const isDescend = q.kind === "teach-descend"
  const highlight = isDescend ? descendPath(q.tree, 10).path : q.order

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground">{q.title}</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">{q.prompt}</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6">
        <DisplayTree tree={q.tree} highlightIds={highlight} />
        {isDescend ? (
          <p className="mx-auto max-w-xs text-center text-sm text-muted-foreground">
            Compare, go left if smaller or right if larger, and throw away the half you
            didn't pick.
          </p>
        ) : (
          <p className="mx-auto max-w-xs text-center text-sm text-muted-foreground">
            Left subtree, then the node, then the right subtree — and it comes out{" "}
            <span className="font-semibold text-foreground">sorted</span>.
          </p>
        )}
      </div>

      <div className="mt-auto">
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

/* ----------------------------- descend (locate) --------------------------- */

function DescendPart({
  state,
  dispatch,
}: {
  state: TreesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q) return null
  const correct = state.feedback === "correct"

  return (
    <div className="flex flex-1 flex-col">
      <BinHeader state={state} />

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-5">
        <TreeFigure state={state} dispatch={dispatch} />
      </div>

      {correct && q.cost && (
        <div className="mb-4 flex justify-center">
          <CostReadout word={q.cost.word} count={q.cost.count} unit={q.cost.unit} />
        </div>
      )}

      <FeedbackFooter
        feedback={state.feedback}
        selected={null}
        canCheck={canCheckTrees(state)}
        showWhy={state.showWhy}
        hideFailHint
        copy={feedbackCopy(q)}
        dispatch={dispatch}
      />
    </div>
  )
}

/* ------------------------------ sequence beats ---------------------------- */

function SequencePart({
  state,
  dispatch,
}: {
  state: TreesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q) return null
  const tappedKeys = state.tappedOrder.map((id) => nodeById(q.tree, id)?.key ?? "?")

  return (
    <div className="flex flex-1 flex-col">
      <BinHeader state={state} />

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-5">
        <TreeFigure state={state} dispatch={dispatch} />
        <p className="min-h-6 text-center text-sm font-semibold tabular-nums text-lilac-strong">
          {tappedKeys.length > 0 ? tappedKeys.join(" → ") : "Tap the nodes in order"}
        </p>
      </div>

      <FeedbackFooter
        feedback={state.feedback}
        selected={null}
        canCheck={canCheckTrees(state)}
        showWhy={state.showWhy}
        hideFailHint
        copy={feedbackCopy(q)}
        dispatch={dispatch}
      />
    </div>
  )
}

/* ----------------------- real-world skin (higher/lower) ------------------- */

function RealWorldPart({
  state,
  dispatch,
}: {
  state: TreesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q) return null
  const correct = state.feedback === "correct"

  return (
    <div className="flex flex-1 flex-col">
      <BinHeader state={state} />

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full rounded-3xl border border-lilac-strong/30 bg-gradient-to-b from-lilac-soft/60 to-card p-4"
        >
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-lilac-strong">
            Higher or Lower
          </p>
          <TreeFigure state={state} dispatch={dispatch} />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Lower means go left, higher means go right — each guess halves the range.
          </p>
        </motion.div>
      </div>

      {correct && q.cost && (
        <div className="mb-4 flex justify-center">
          <CostReadout word={q.cost.word} count={q.cost.count} unit={q.cost.unit} />
        </div>
      )}

      <FeedbackFooter
        feedback={state.feedback}
        selected={null}
        canCheck={canCheckTrees(state)}
        showWhy={state.showWhy}
        hideFailHint
        copy={feedbackCopy(q)}
        dispatch={dispatch}
      />
    </div>
  )
}

/* --------------------------- comparison: shapes (MCQ) --------------------- */

function ComparePart({
  state,
  dispatch,
}: {
  state: TreesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q || !q.stick) return null
  const correct = state.feedback === "correct"
  const terminal = isTerminalTrees(state)

  return (
    <div className="flex flex-1 flex-col">
      <BinHeader state={state} />

      <div className="flex flex-col items-center gap-3 py-3">
        <DisplayTree tree={q.tree} caption="Balanced" />
        <DisplayTree tree={q.stick} caption="Stick (same keys)" />
      </div>

      {correct && q.cost && q.altCost && (
        <div className="mb-3 flex flex-wrap justify-center gap-2">
          <LabeledCost label="Balanced" cost={q.cost} />
          <LabeledCost label="Stick" cost={q.altCost} />
        </div>
      )}

      <div className="flex flex-col gap-3">
        {q.options.map((opt, i) => (
          <AnswerCard
            key={opt.id}
            letter={String.fromCharCode(65 + i)}
            label={opt.label}
            state={mcqCardState(state, opt.id, q.answer)}
            disabled={terminal}
            answerMarker={opt.id === q.answer}
            onSelect={() => dispatch({ type: "select", letter: opt.id })}
          />
        ))}
      </div>

      <FeedbackFooter
        feedback={state.feedback}
        selected={state.selected}
        showWhy={state.showWhy}
        hideFailHint
        copy={feedbackCopy(q)}
        dispatch={dispatch}
      />
    </div>
  )
}

/* ------------------------ comparison: list vs tree (T5) ------------------- */

function ContrastPart({
  state,
  dispatch,
}: {
  state: TreesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q || !q.chain) return null
  const correct = state.feedback === "correct"
  const walkDone = chainWalkDone(state)

  return (
    <div className="flex flex-1 flex-col">
      <BinHeader state={state} />

      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-4">
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Sorted list — walk it
          </span>
          <SortedChain
            keys={q.chain}
            cursor={state.chainCursor}
            targetIndex={q.chainTargetIndex}
            onAdvance={walkDone ? undefined : () => dispatch({ type: "select", letter: "chain" })}
          />
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Balanced tree — descend it
          </span>
          <TreeFigure state={state} dispatch={dispatch} lockDescend={!walkDone} />
          {!walkDone && (
            <p className="max-w-xs text-center text-xs text-faint">
              Finish the walk first, then descend the tree.
            </p>
          )}
        </div>
      </div>

      {correct && (
        <div className="mb-4 flex justify-center">
          <ContrastRace
            chain={q.chain}
            chainTargetIndex={q.chainTargetIndex}
            tree={q.tree}
            path={q.descend?.path ?? []}
          />
        </div>
      )}

      {correct && q.cost && q.altCost && (
        <div className="mb-3 flex flex-wrap justify-center gap-2">
          <LabeledCost label="List walk" cost={q.altCost} />
          <LabeledCost label="Tree descend" cost={q.cost} />
        </div>
      )}

      <FeedbackFooter
        feedback={state.feedback}
        selected={null}
        canCheck={canCheckTrees(state)}
        showWhy={state.showWhy}
        hideFailHint
        copy={feedbackCopy(q)}
        dispatch={dispatch}
      />
    </div>
  )
}
