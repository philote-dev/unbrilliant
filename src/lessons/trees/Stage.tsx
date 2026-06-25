import type { Dispatch } from "react"

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
import { StageSplit, StageCenter } from "@/components/willow/lesson/StageLayout"
import { DisplayTree, TreeFigure } from "./TreeFigure"
import { SortedChain } from "./SortedChain"
import { ContrastRace } from "./ContrastRace"
import { ArenaFooter, ArenaShell } from "./Arena"

/**
 * The Trees stage. Every beat renders in the generic Willow UI (lilac accent, the
 * shared AnswerCard / FeedbackFooter / CostReadout, and the abstract circular-node
 * tree figure) EXCEPT the `realworld` beat, which keeps the full-bleed March
 * Madness tournament-bracket arena (ArenaShell + ArenaFooter + the bracket figure)
 * as its real-world championship application. Skins are presentational only: the
 * figures keep their pure-engine logic and every `data-*` hook byte-for-byte; only
 * the variant (paint) changes.
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

/** The "{Locate|Sequence|Comparison} n / m" progress for a graded beat. */
function quotaTrees(state: TreesState): { label: string; done: number; total: number } | null {
  const bin = binOf(currentPartTrees(state))
  const quota = partQuotaTrees(state)
  if (!bin || !quota) return null
  return { label: BIN_LABEL[bin], done: quota.done, total: quota.total }
}

const feedbackCopy = (q: TreesQuestion) => ({
  prompt: q.prompt,
  hint: q.hint,
  nudge: q.nudge,
  correct: q.correct,
  why: q.why,
})

/** The lilac quota line + prompt heading shared by every graded generic beat. */
function GradedHeader({ state }: { state: TreesState }) {
  const q = state.question
  const quota = quotaTrees(state)
  return (
    <div className="mt-7">
      {quota && (
        <p className="text-center text-xs font-medium uppercase tracking-wide text-lilac-strong">
          {quota.label} · {quota.done} / {quota.total} correct
        </p>
      )}
      <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground lg:text-2xl">
        {q?.prompt}
      </h2>
    </div>
  )
}

function MutedLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  )
}

function LabeledCost({ label, cost }: { label: string; cost: TreesCost }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <MutedLabel>{label}</MutedLabel>
      <CostReadout word={cost.word} count={cost.count} unit={cost.unit} />
    </div>
  )
}

function mcqCardState(state: TreesState, id: string, answer: string): AnswerState {
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
    <StageCenter>
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground lg:text-2xl">{q.title}</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground lg:max-w-sm lg:text-base">{q.prompt}</p>
      </div>

      <div className="flex flex-1 items-center justify-center py-6">
        <TreeFigure state={state} dispatch={dispatch} variant="tree" />
      </div>

      <div className="mt-auto">
        <p className="mb-3 text-center text-sm text-muted-foreground">
          Each tap compares and steps down one level. The half you skip is discarded.
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
    </StageCenter>
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
    <StageCenter>
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground lg:text-2xl">{q.title}</h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6">
        <DisplayTree
          tree={q.tree}
          highlightIds={highlight}
          orderRanks={isDescend ? undefined : q.order}
          variant="tree"
        />
        {isDescend ? (
          <p className="mx-auto max-w-xs text-center text-sm text-muted-foreground">
            Compare, go left if smaller or right if larger, and the half you skip is discarded.
          </p>
        ) : (
          <p className="mx-auto max-w-xs text-center text-sm text-muted-foreground">
            The badges count the visit order: left subtree, then the node, then the right subtree, and
            it comes out <span className="font-semibold text-foreground">sorted</span>.
          </p>
        )}
      </div>

      <Button
        variant="tactile"
        size="lg"
        className="mt-auto w-full"
        onClick={() => dispatch({ type: "continue" })}
      >
        Continue
      </Button>
    </StageCenter>
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
    <StageCenter>
      <GradedHeader state={state} />

      <div className="flex flex-1 items-center justify-center py-6">
        <TreeFigure state={state} dispatch={dispatch} variant="tree" />
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
    </StageCenter>
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
    <StageCenter>
      <GradedHeader state={state} />

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6">
        <TreeFigure state={state} dispatch={dispatch} variant="tree" />
        <p className="min-h-6 text-center text-sm font-bold tabular-nums text-lilac-strong">
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
    </StageCenter>
  )
}

/* ------------------- real-world skin (the bracket arena) ------------------ */

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
    <StageCenter>
      <ArenaShell
        eyebrow="Championship Search"
        title={q.prompt}
        quota={quotaTrees(state)}
        footer={
          <ArenaFooter
            feedback={state.feedback}
            showWhy={state.showWhy}
            canCheck={canCheckTrees(state)}
            copy={feedbackCopy(q)}
            dispatch={dispatch}
          />
        }
      >
        <TreeFigure state={state} dispatch={dispatch} variant="bracket" />
        {correct && q.cost && (
          <CostReadout word={q.cost.word} count={q.cost.count} unit={q.cost.unit} />
        )}
      </ArenaShell>
    </StageCenter>
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
    <StageSplit
      header={<GradedHeader state={state} />}
      figure={
        <>
          <div className="flex flex-col items-center gap-3 py-4">
            <DisplayTree tree={q.tree} caption="Balanced" variant="tree" />
            <DisplayTree tree={q.stick} caption="Same nodes, one long branch" variant="tree" />
          </div>

          {correct && q.cost && q.altCost && (
            <div className="mb-4 flex flex-wrap justify-center gap-2">
              <LabeledCost label="Balanced" cost={q.cost} />
              <LabeledCost label="Lopsided" cost={q.altCost} />
            </div>
          )}
        </>
      }
      interaction={
        <>
          <div className="flex w-full flex-col gap-3">
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
            canCheck={state.selected != null}
            showWhy={state.showWhy}
            hideFailHint
            copy={feedbackCopy(q)}
            dispatch={dispatch}
          />
        </>
      }
    />
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
    <StageCenter>
      <GradedHeader state={state} />

      {/* Until correct, the learner walks the sorted list then descends the tree.
          Once correct, the ContrastRace replay takes over so the page never stacks
          a duplicate list + tree (mobile overflow). */}
      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-4">
        {!correct && (
          <>
            <div className="flex flex-col items-center gap-1.5">
              <MutedLabel>Sorted list: walk every node</MutedLabel>
              <SortedChain
                keys={q.chain}
                cursor={state.chainCursor}
                targetIndex={q.chainTargetIndex}
                onAdvance={walkDone ? undefined : () => dispatch({ type: "select", letter: "chain" })}
              />
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <MutedLabel>Tree: descend it</MutedLabel>
              <TreeFigure state={state} dispatch={dispatch} variant="tree" lockDescend={!walkDone} />
              {!walkDone && (
                <p className="max-w-xs text-center text-xs text-muted-foreground">
                  Finish the walk first, then descend the tree.
                </p>
              )}
            </div>
          </>
        )}

        {correct && (
          <ContrastRace
            chain={q.chain}
            chainTargetIndex={q.chainTargetIndex}
            tree={q.tree}
            path={q.descend?.path ?? []}
            variant="tree"
          />
        )}

        {correct && q.cost && q.altCost && (
          <div className="flex flex-wrap justify-center gap-2">
            <LabeledCost label="Sorted list walk" cost={q.altCost} />
            <LabeledCost label="Tree" cost={q.cost} />
          </div>
        )}
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
    </StageCenter>
  )
}
