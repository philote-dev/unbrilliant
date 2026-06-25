import type { Dispatch } from "react"

import { AnswerCard, type AnswerState } from "@/components/willow/AnswerCard"
import { CostReadout } from "@/components/willow/CostReadout"
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
import { ArenaContinue, ArenaFooter, ArenaShell, RebalanceBracket, type ArenaQuota } from "./Arena"

/**
 * The Trees stage, skinned as a March Madness TOURNAMENT BRACKET. Every beat
 * renders inside the full-bleed `ArenaShell` (a page-transforming arena, like the
 * Linked Lists Spotify immersion): the BST is drawn top-down as a bracket, a
 * descend is a championship search that eliminates (greys) half the field each
 * round, the in-order beats seed the bracket, and the compare beat rebalances a
 * lopsided bracket into a fair one. Nothing here changes a verdict: the figures
 * keep their pure-engine logic and `data-*` hooks; only the paint changes (the
 * arena overrides design-token CSS variables for its subtree).
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

function arenaQuota(state: TreesState): ArenaQuota | null {
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

function ArenaLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wide"
      style={{ color: "#64748b" }}
    >
      {children}
    </span>
  )
}

function LabeledCost({ label, cost }: { label: string; cost: TreesCost }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <ArenaLabel>{label}</ArenaLabel>
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
    <ArenaShell
      eyebrow="Tip-off"
      title="It's a bracket: tap a seed to advance, and the half you skip is out"
      footer={
        <ArenaContinue
          onClick={() => dispatch({ type: "continue" })}
          hint="Each tap compares and advances one round. The half you skip is eliminated."
        />
      }
    >
      <TreeFigure state={state} dispatch={dispatch} variant="bracket" />
    </ArenaShell>
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
    <ArenaShell
      eyebrow={isDescend ? "Scouting report" : "Seeding"}
      title={q.title}
      footer={<ArenaContinue onClick={() => dispatch({ type: "continue" })} />}
    >
      <DisplayTree
        tree={q.tree}
        highlightIds={highlight}
        orderRanks={isDescend ? undefined : q.order}
        variant="bracket"
      />
      {isDescend ? (
        <p className="mx-auto max-w-xs text-center text-sm" style={{ color: "#475569" }}>
          Compare, advance left if smaller or right if larger, and the half you skip is
          eliminated.
        </p>
      ) : (
        <p className="mx-auto max-w-xs text-center text-sm" style={{ color: "#475569" }}>
          The badges count the visit order: left bracket, then the seed, then the right
          bracket, and it comes out{" "}
          <span className="font-semibold" style={{ color: "#0f2a4a" }}>
            sorted
          </span>
          .
        </p>
      )}
    </ArenaShell>
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
    <ArenaShell
      eyebrow="Bracket search"
      title={q.prompt}
      quota={arenaQuota(state)}
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
    <ArenaShell
      eyebrow="Seed the bracket"
      title={q.prompt}
      quota={arenaQuota(state)}
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
      <p
        className="min-h-6 text-center text-sm font-semibold tabular-nums"
        style={{ color: "#0f2a4a" }}
      >
        {tappedKeys.length > 0 ? tappedKeys.join(" → ") : "Tap the seeds in order"}
      </p>
    </ArenaShell>
  )
}

/* ------------------------- real-world skin (the bracket) ------------------ */

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
    <ArenaShell
      eyebrow="Championship search"
      title={q.prompt}
      quota={arenaQuota(state)}
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
    <ArenaShell
      eyebrow="Bracket math"
      title={q.prompt}
      quota={arenaQuota(state)}
      footer={
        <ArenaFooter
          feedback={state.feedback}
          showWhy={state.showWhy}
          canCheck={state.selected != null}
          copy={feedbackCopy(q)}
          dispatch={dispatch}
        />
      }
    >
      {correct ? (
        <>
          <RebalanceBracket balanced={q.tree} stick={q.stick} />
          {q.cost && q.altCost && (
            <div className="flex flex-wrap justify-center gap-2">
              <LabeledCost label="Fair bracket" cost={q.cost} />
              <LabeledCost label="Lopsided" cost={q.altCost} />
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <DisplayTree tree={q.tree} caption="Fair bracket" variant="bracket" />
          <DisplayTree tree={q.stick} caption="Lopsided (same seeds)" variant="bracket" />
        </div>
      )}

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
    </ArenaShell>
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
    <ArenaShell
      eyebrow="Seed line vs bracket"
      title={q.prompt}
      quota={arenaQuota(state)}
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
      {/* Until correct, the learner walks the seed line then advances the bracket.
          Once correct, the ContrastRace replay takes over so the page never stacks
          a duplicate seed line + bracket (mobile overflow). */}
      {!correct && (
        <>
          <div className="flex flex-col items-center gap-1.5">
            <ArenaLabel>Seed line: walk every team</ArenaLabel>
            <SortedChain
              keys={q.chain}
              cursor={state.chainCursor}
              targetIndex={q.chainTargetIndex}
              onAdvance={walkDone ? undefined : () => dispatch({ type: "select", letter: "chain" })}
            />
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <ArenaLabel>Bracket: advance it</ArenaLabel>
            <TreeFigure state={state} dispatch={dispatch} variant="bracket" lockDescend={!walkDone} />
            {!walkDone && (
              <p className="max-w-xs text-center text-xs" style={{ color: "#94a3b8" }}>
                Finish the walk first, then advance the bracket.
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
          variant="bracket"
        />
      )}

      {correct && q.cost && q.altCost && (
        <div className="flex flex-wrap justify-center gap-2">
          <LabeledCost label="Seed line walk" cost={q.altCost} />
          <LabeledCost label="Bracket" cost={q.cost} />
        </div>
      )}
    </ArenaShell>
  )
}
