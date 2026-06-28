import { useReducedMotion } from "motion/react"
import type { Dispatch } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AnswerCard, type AnswerState } from "@/components/willow/AnswerCard"
import { CostReadout } from "@/components/willow/CostReadout"
import { FeedbackFooter } from "@/components/willow/FeedbackFooter"
import { StatusChip } from "@/components/willow/StatusChip"
import type { LessonAction } from "@/features/lesson/engine"
import {
  bstBuildCurrentKey,
  binOf,
  canCheckTrees,
  chainWalkDone,
  currentPartTrees,
  descendPath,
  droppedAlongPath,
  isTerminalTrees,
  nodeById,
  partQuotaTrees,
  watchedBuildFrames,
  type BstBuildBeat,
  type BuildFrame,
  type TreesBin,
  type TreesCost,
  type TreesQuestion,
  type TreesState,
} from "@/features/lesson/treesEngine"
import { StageSplit, StageCenter } from "@/components/willow/lesson/StageLayout"
import { FrameSequence } from "@/components/willow/lesson/FrameSequence"
import { DisplayTree, TreeFigure } from "./TreeFigure"
import { SortedChain } from "./SortedChain"
import { ContrastRace } from "./ContrastRace"
import { ArenaFooter, ArenaShell, RebalanceBracket } from "./Arena"

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
    case "find-big":
      return <DescendPart state={state} dispatch={dispatch} />
    case "watched-build":
      return <WatchedBuildPart state={state} dispatch={dispatch} />
    case "build-bst-1":
    case "build-bst-2":
      return <BuildPart state={state} dispatch={dispatch} />
    case "sequence-a":
    case "sequence-b":
    case "sequence-c":
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
  build: "Build",
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

/** The house teach/intro kicker: a small, wide-tracked lilac eyebrow (baseline). */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-lilac-strong">
      {children}
    </p>
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
        <Eyebrow>Trees</Eyebrow>
        <h2 className="mt-2 text-xl font-bold text-foreground lg:text-2xl">{q.title}</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground lg:max-w-sm lg:text-base">{q.prompt}</p>
      </div>

      <div className="flex flex-1 items-center justify-center py-6">
        <TreeFigure state={state} dispatch={dispatch} variant="tree" />
      </div>

      <div className="mt-auto">
        <p className="mb-3 text-center text-sm text-muted-foreground">
          Each tap <span className="concept">compares</span> and steps down one level. The half you skip
          is <span className="concept" style={{ animationDelay: "450ms" }}>discarded</span>.
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

interface TeachFrame {
  highlight: string[]
  dropped: string[]
  ranks?: string[]
  caption: string
}

/** Frames for teach-descend: the path lights step by step, the other half greys. */
function descendTeachFrames(tree: TreesQuestion["tree"], target: number): TeachFrame[] {
  const path = descendPath(tree, target).path
  return path.map((_, i) => {
    const lit = path.slice(0, i + 1)
    if (i === 0) {
      return { highlight: lit, dropped: [], caption: `Start at the root, ${nodeById(tree, path[0])!.key}.` }
    }
    const parent = nodeById(tree, path[i - 1])!
    const goLeft = target < parent.key
    return {
      highlight: lit,
      dropped: [...droppedAlongPath(tree, lit)],
      caption: `${target} is ${goLeft ? "less" : "greater"} than ${parent.key}: go ${
        goLeft ? "left" : "right"
      }, and the other half is gone.`,
    }
  })
}

/** Frames for teach-inorder: the visit-order badges appear one at a time. */
function inorderTeachFrames(order: string[], tree: TreesQuestion["tree"]): TeachFrame[] {
  return order.map((_, i) => {
    const ranks = order.slice(0, i + 1)
    const justKey = nodeById(tree, order[i])!.key
    return {
      highlight: ranks,
      dropped: [],
      ranks,
      caption: i === 0 ? `Left subtree first: ${justKey} comes out first.` : `Then ${justKey}.`,
    }
  })
}

function TeachPart({
  state,
  dispatch,
}: {
  state: TreesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  if (!q) return null
  const isDescend = q.kind === "teach-descend"
  const frames = isDescend ? descendTeachFrames(q.tree, 10) : inorderTeachFrames(q.order, q.tree)

  return (
    <StageCenter>
      <div className="mt-7 text-center">
        <Eyebrow>{isDescend ? "Descend" : "In-order"}</Eyebrow>
        <h2 className="mt-2 text-xl font-bold text-foreground lg:text-2xl">{q.title}</h2>
        {isDescend ? (
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground lg:max-w-sm lg:text-base">
            <span className="concept">Compare</span> at each node, then{" "}
            <span className="concept" style={{ animationDelay: "450ms" }}>
              drop the half
            </span>{" "}
            you skip.
          </p>
        ) : (
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground lg:max-w-sm lg:text-base">
            <span className="concept">Left subtree</span>, then the{" "}
            <span className="concept" style={{ animationDelay: "450ms" }}>
              node
            </span>
            , then the{" "}
            <span className="concept" style={{ animationDelay: "900ms" }}>
              right subtree
            </span>
            : it comes out sorted.
          </p>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6">
        <FrameSequence
          frames={frames}
          autoPlayMs={(i) => (i === 0 ? 900 : 800)}
          controls
          reduced={reduced}
        >
          {(frame) => (
            <>
              <DisplayTree
                tree={q.tree}
                highlightIds={frame.highlight}
                droppedIds={frame.dropped}
                orderRanks={frame.ranks}
                variant="tree"
              />
              <p className="max-w-xs text-center text-xs text-muted-foreground">{frame.caption}</p>
            </>
          )}
        </FrameSequence>
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

/* ------------------------------ watched build ----------------------------- */

/** Which descend nodes to light for a watched-build frame (the path + the new node). */
function watchedHighlight(frame: BuildFrame): string[] {
  return frame.highlightIds
}

/**
 * Beat 6, watched-build (teach, ungraded): auto-plays a BST grown from scratch,
 * key by key, through the shared `FrameSequence`. Each frame lights the descend
 * the next key took and shows it attached, so the tree visibly grows. Replay
 * re-watches it; reduced motion snaps to the finished tree with no timers. The
 * concept copy glows in reading order (baseline).
 */
function WatchedBuildPart({
  state,
  dispatch,
}: {
  state: TreesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  if (!q || !q.buildKeys) return null
  const frames = watchedBuildFrames(q.buildKeys)

  return (
    <StageCenter>
      <div className="mt-7 text-center">
        <Eyebrow>Build a tree</Eyebrow>
        <h2 className="mt-2 text-xl font-bold text-foreground lg:text-2xl">Watch it grow, key by key</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground lg:max-w-sm lg:text-base">
          A tree is just <span className="concept">insert</span>, repeated. Each key{" "}
          <span className="concept" style={{ animationDelay: "450ms" }}>
            compares down
          </span>{" "}
          and attaches at the{" "}
          <span className="concept" style={{ animationDelay: "900ms" }}>
            first empty slot
          </span>
          .
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4">
        <FrameSequence
          frames={frames}
          autoPlayMs={(i) => (i === 0 ? 900 : 820)}
          controls
          reduced={reduced}
        >
          {(frame) => (
            <>
              <DisplayTree tree={frame.tree} highlightIds={watchedHighlight(frame)} variant="tree" />
              <p className="max-w-xs text-center text-xs text-muted-foreground">{frame.caption}</p>
            </>
          )}
        </FrameSequence>
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

/* ------------------------------- build the BST ---------------------------- */

/** The insert sequence as a queue: placed keys settle green, the current one glows. */
function BuildKeyQueue({ beat }: { beat: BstBuildBeat }) {
  const incoming = bstBuildCurrentKey(beat)
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5" aria-hidden>
      {beat.keys.map((k, i) => {
        const done = i < beat.placed
        const current = k === incoming && i === beat.placed
        return (
          <span
            key={`${i}-${k}`}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg border-2 text-xs font-bold transition-colors",
              done
                ? "border-success bg-success-soft text-foreground"
                : current
                  ? "border-lilac-strong bg-lilac-soft text-lilac-strong ring-4 ring-lilac-strong/15"
                  : "border-border bg-card text-muted-foreground",
            )}
          >
            {k}
          </span>
        )
      })}
    </div>
  )
}

/** The footer for an active build: a quiet instruction, a nudge on a wrong move,
 * and the correction + Continue once every key is placed. No Check / fail wall. */
function BuildFooter({
  state,
  q,
  dispatch,
}: {
  state: TreesState
  q: TreesQuestion
  dispatch: Dispatch<LessonAction>
}) {
  const { feedback } = state
  return (
    <div className="mt-auto min-h-[120px] pt-2">
      {feedback === "correct" ? (
        <div className="animate-fade-in">
          <div className="mb-4 flex flex-col items-center gap-2 text-center">
            <StatusChip status="correct" />
            <p className="text-sm text-muted-foreground lg:text-base">{q.correct}</p>
          </div>
          <Button variant="tactile" size="lg" className="w-full" onClick={() => dispatch({ type: "next" })}>
            Continue
          </Button>
        </div>
      ) : feedback === "nudge" ? (
        <div className="mb-4 flex flex-col items-center gap-2 text-center" role="status">
          <StatusChip status="hint" />
          <p className="text-sm text-muted-foreground lg:text-base">{q.nudge}</p>
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground lg:text-base">
          Descend each key to its empty slot, then drop it in.
        </p>
      )}
    </div>
  )
}

/**
 * Beats 7-8, build-the-BST (graded, the Build bin): the learner grows a BST by
 * inserting a fixed sequence of keys, descending each to its empty slot and
 * dropping it in (the TreeFigure build mode). The queue shows progress; a wrong
 * tap nudges (no fail wall) and the build clears once the last key lands. Reduced
 * motion snaps each placement.
 */
function BuildPart({
  state,
  dispatch,
}: {
  state: TreesState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const beat = state.build
  if (!q || !beat) return null
  const solved = state.feedback === "correct"
  const incoming = bstBuildCurrentKey(beat)

  return (
    <StageCenter>
      <GradedHeader state={state} />

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4">
        <BuildKeyQueue beat={beat} />
        <TreeFigure state={state} dispatch={dispatch} variant="tree" />
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          {solved
            ? "Every key found its slot. The tree is grown."
            : incoming != null
              ? `Insert ${incoming}: compare down, then tap the empty slot it lands in.`
              : ""}
        </p>
      </div>

      <BuildFooter state={state} q={q} dispatch={dispatch} />
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
  const reduced = useReducedMotion() ?? false
  if (!q || !q.stick) return null
  const correct = state.feedback === "correct"
  const terminal = isTerminalTrees(state)

  return (
    <StageSplit
      header={<GradedHeader state={state} />}
      figure={
        <>
          {/* De-cued (Bucket 2): the figures are captioned neutrally "Tree A" / "Tree
              B" (no "Balanced" / "stick" verdict). On a correct answer the lopsided
              Tree B visibly rebalances into Tree A (RebalanceBracket, Bucket 3),
              a non-gating flourish that delivers the verdict the labels withheld. */}
          {correct ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <RebalanceBracket balanced={q.tree} stick={q.stick} reducedMotion={reduced} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <DisplayTree tree={q.tree} caption="Tree A" variant="tree" />
              <DisplayTree tree={q.stick} caption="Tree B" variant="tree" />
            </div>
          )}

          {correct && q.cost && q.altCost && (
            <div className="mb-4 flex flex-wrap justify-center gap-2">
              <LabeledCost label="Tree A" cost={q.cost} />
              <LabeledCost label="Tree B" cost={q.altCost} />
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
