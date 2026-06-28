import { useState, type Dispatch, type ReactNode } from "react"
import { ArrowLeft, ArrowRight, Check } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AnswerCard, type AnswerState } from "@/components/willow/AnswerCard"
import { CostReadout, type CostWord } from "@/components/willow/CostReadout"
import { FeedbackFooter } from "@/components/willow/FeedbackFooter"
import { StatusChip } from "@/components/willow/StatusChip"
import { RewireSurface } from "@/components/rewire/RewireSurface"
import type { LessonAction } from "@/features/lesson/engine"
import {
  currentPartLL,
  deleteWriteFrames,
  insertWriteFrames,
  isStuckLL,
  isTerminalLL,
  isWriteDoneLL,
  legalTargets,
  orphanedNodes,
  playlistOrphanedLL,
  playlistPhaseIndexLL,
  playlistStepLL,
  predictBreakFrames,
  remainingScriptLL,
  walkCursorLL,
  walkFrontierLL,
  type DoublyWrite,
  type LinkedListsState,
  type LLQuestion,
  type RewireFrame,
} from "@/features/lesson/linkedListsEngine"
import { StageSplit, StageCenter } from "@/components/willow/lesson/StageLayout"
import { FrameSequence } from "@/components/willow/lesson/FrameSequence"
import { ArrayRow } from "@/lessons/arrays/ArrayRow"
import { NodeGraph } from "./NodeGraph"
import { PlaylistQueue } from "./PlaylistQueue"
import { DoublyChain, DoublySplice } from "./DoublyGraph"

/**
 * The Linked Lists stage (12 beats, 9 graded). Forced-walk traverse, animated
 * pointer-write reveals (insert / delete / predict via the shared FrameSequence),
 * the multi-step playlist synthesis on the Spotify skin, the two-step contrast
 * (pick -> why-MCQ), and the doubly segment (demo, splice, backward walk). Verdict
 * UX flows through the shared FeedbackFooter; every animated path snaps under
 * reduced motion.
 */
export function LinkedListsStage({
  state,
  dispatch,
}: {
  state: LinkedListsState
  dispatch: Dispatch<LessonAction>
}) {
  switch (currentPartLL(state)) {
    case "node-demo":
      return <DemoPart state={state} dispatch={dispatch} />
    case "teach":
      return <TeachPart state={state} dispatch={dispatch} />
    case "traverse":
      return <TraversePart state={state} dispatch={dispatch} />
    case "rewire-insert":
    case "rewire-delete":
      return <RewirePart state={state} dispatch={dispatch} />
    case "playlist":
      return <PlaylistPart state={state} dispatch={dispatch} />
    case "predict":
      return <PredictPart state={state} dispatch={dispatch} />
    case "contrast-insert":
    case "contrast-reach":
      return <ContrastPart state={state} dispatch={dispatch} />
    case "doubly-demo":
      return <DoublyDemoPart state={state} dispatch={dispatch} />
    case "doubly-splice":
      return <DoublySplicePart state={state} dispatch={dispatch} />
    case "doubly-walk":
      return <DoublyWalkPart state={state} dispatch={dispatch} />
  }
}

/* -------------------------------- shared bits ------------------------------- */

/** The house teach/intro kicker: a small, wide-tracked lilac eyebrow. */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-lilac-strong">
      {children}
    </p>
  )
}

const feedbackCopy = (q: LLQuestion) => ({
  prompt: q.prompt,
  hint: q.hint,
  nudge: q.nudge,
  correct: q.correct,
  why: q.why,
})

function CompareLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
  )
}

function LabeledCost({
  label,
  cost,
}: {
  label: string
  cost: { word: CostWord; count: number; unit: string }
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <CompareLabel>{label}</CompareLabel>
      <CostReadout word={cost.word} count={cost.count} unit={cost.unit} />
    </div>
  )
}

/* --------------------------------- beat 1 --------------------------------- */

function DemoPart({
  state,
  dispatch,
}: {
  state: LinkedListsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q) return null
  return (
    <StageCenter>
      <div className="mt-7 text-center">
        <Eyebrow>Linked Lists</Eyebrow>
        <h2 className="mt-2 text-xl font-bold text-foreground lg:text-2xl">It's the arrows</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground lg:max-w-sm lg:text-base">{q.prompt}</p>
      </div>

      <div className="flex flex-1 flex-col py-4">
        <NodeGraph mode="demo" nodes={q.nodes} />
      </div>

      <div className="mt-auto">
        <p className="mb-3 text-center text-sm text-muted-foreground">
          Move a node anywhere - the order doesn't change. Only the <span className="concept">arrows</span> say what
          comes next.
        </p>
        <Button variant="tactile" size="lg" className="w-full" onClick={() => dispatch({ type: "continue" })}>
          Continue
        </Button>
      </div>
    </StageCenter>
  )
}

/* --------------------------------- beat 2 --------------------------------- */

function TeachPart({
  state,
  dispatch,
}: {
  state: LinkedListsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  if (!q) return null
  // Animation-driven teach: a head-to-tail walk lights up hop by hop.
  const frames = Array.from({ length: q.nodes.length + 1 }, (_, i) => i)

  return (
    <StageCenter>
      <div className="mt-7 text-center">
        <Eyebrow>Pointers, not position</Eyebrow>
        <h2 className="mt-2 text-xl font-bold text-foreground lg:text-2xl">Walk from the head</h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6">
        <FrameSequence frames={frames} autoPlayMs={(i) => (i === 0 ? 700 : 520)} reduced={reduced}>
          {(cursor) => (
            <NodeGraph mode="walk" nodes={q.nodes} cursor={cursor} layout="wrap" reducedMotion={reduced} />
          )}
        </FrameSequence>
        <div className="mx-auto max-w-xs space-y-3 text-center text-sm text-muted-foreground lg:text-base">
          <p>
            Each node points to the next. To reach the k-th node you{" "}
            <span className="concept">walk from the head</span> - there's no jump.
          </p>
          <p>
            And the{" "}
            <span className="concept" style={{ animationDelay: "550ms" }}>
              head is sacred
            </span>
            : lose it and the whole list is gone.
          </p>
        </div>
      </div>

      <div className="mt-auto">
        <Button variant="tactile" size="lg" className="w-full" onClick={() => dispatch({ type: "continue" })}>
          Continue
        </Button>
      </div>
    </StageCenter>
  )
}

/* --------------------------------- beat 3 --------------------------------- */

function TraversePart({
  state,
  dispatch,
}: {
  state: LinkedListsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  if (!q) return null
  const { feedback, selected, showWhy } = state
  const terminal = isTerminalLL(state)

  const answerIdx = q.nodes.indexOf(q.answer)
  const reveal = feedback === "fail" && showWhy
  const cursor = reveal ? answerIdx : walkCursorLL(state)
  const frontier = terminal ? -1 : walkFrontierLL(state)
  const tone: "active" | "correct" | "wrong" =
    feedback === "correct" || reveal
      ? "correct"
      : feedback === "nudge" || feedback === "fail"
        ? "wrong"
        : "active"
  const showCost = cursor >= 1 || feedback === "correct"
  const costCount = feedback === "correct" ? q.cost.count : Math.max(0, cursor)

  return (
    <StageCenter>
      <div className="mt-7">
        <Eyebrow>Traverse</Eyebrow>
        <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground lg:text-2xl">{q.prompt}</h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-5">
        <NodeGraph
          mode="walk"
          nodes={q.nodes}
          cursor={cursor}
          cursorTone={tone}
          answerIndex={answerIdx}
          frontier={frontier}
          layout="wrap"
          reducedMotion={reduced}
          onTapNode={terminal ? undefined : (i) => dispatch({ type: "select", letter: q.nodes[i] })}
        />
        {showCost && (
          <CostReadout word="scales" count={costCount} unit={costCount === 1 ? "hop" : "hops"} />
        )}
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          Tap the next node to take one <span className="concept">hop</span> - the arrows are the only path. Commit when
          you've arrived.
        </p>
      </div>

      <FeedbackFooter
        feedback={feedback}
        selected={selected}
        showWhy={showWhy}
        hideFailHint
        copy={feedbackCopy(q)}
        dispatch={dispatch}
      />
    </StageCenter>
  )
}

/* ------------------------------- beats 4 & 5 ------------------------------ */

function RewirePart({
  state,
  dispatch,
}: {
  state: LinkedListsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  if (!q) return null
  const { feedback, showWhy } = state
  const canCheck = state.writes.length > 0
  const stuck = isStuckLL(state)
  const reveal = feedback === "correct" || (feedback === "fail" && showWhy)
  const frames = q.kind === "rewire-insert" ? insertWriteFrames(q) : deleteWriteFrames(q)

  return (
    <StageCenter>
      <div className="mt-7 flex flex-col items-center">
        <Eyebrow>Rewire</Eyebrow>
        <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground lg:text-2xl">{q.prompt}</h2>
      </div>

      <div className="flex flex-1 flex-col justify-center py-6">
        {reveal ? (
          <RewireReplay frames={frames} q={q} reduced={reduced} />
        ) : (
          <>
            <RewireSurface
              legalTargets={legalTargets(state)}
              onRewire={(from, to) => dispatch({ type: "rewire", from, to })}
              label="Rewire the chain by dragging a node's arrow onto another node"
              className="flex flex-col items-center"
            >
              <NodeGraph
                mode="rewire"
                nodes={q.nodes}
                newNode={q.newNode}
                prev={q.prev}
                at={q.at}
                workingNext={state.workingNext}
                orphaned={orphanedNodes(state)}
                rewires={q.rewires}
                reducedMotion={reduced}
              />
            </RewireSurface>

            {stuck && feedback !== "fail" && (
              <p className="mt-4 text-center text-sm text-faint">
                The tail floated off - there's no pointer left to reach it.
              </p>
            )}
          </>
        )}
      </div>

      {feedback === "correct" && (
        <div className="mb-4 flex justify-center">
          <CostReadout word={q.cost.word} count={q.cost.count} unit={q.cost.unit} />
        </div>
      )}

      <FeedbackFooter
        feedback={feedback}
        selected={null}
        canCheck={canCheck}
        showWhy={showWhy}
        hideFailHint
        copy={feedbackCopy(q)}
        dispatch={dispatch}
      />
    </StageCenter>
  )
}

/** The post-commit replay of the pointer writes (save-first splice / bypass). */
function RewireReplay({
  frames,
  q,
  reduced,
}: {
  frames: RewireFrame[]
  q: LLQuestion
  reduced: boolean
}) {
  return (
    <FrameSequence
      frames={frames}
      autoPlayMs={(i) => (i === 0 ? 900 : 820)}
      controls
      reduced={reduced}
      className="items-center"
    >
      {(frame) => (
        <>
          <NodeGraph
            mode="replay"
            nodes={q.nodes}
            newNode={q.newNode}
            prev={q.prev}
            at={q.at}
            workingNext={frame.workingNext}
            orphaned={frame.orphaned}
            reducedMotion={reduced}
          />
          <p className="max-w-xs text-center text-xs text-muted-foreground">{frame.caption}</p>
        </>
      )}
    </FrameSequence>
  )
}

/* ------------------------------- beat 6 (predict) ------------------------- */

function PredictPart({
  state,
  dispatch,
}: {
  state: LinkedListsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  if (!q) return null
  const { feedback, selected, showWhy } = state
  const terminal = isTerminalLL(state)
  const reveal = feedback === "correct" || (feedback === "fail" && showWhy)
  const frames = predictBreakFrames(q)

  const cardState = (id: string): AnswerState => {
    if (feedback === "correct") return id === q.answer ? "correct" : "default"
    if (feedback === "nudge") return id === selected ? "nudge" : "default"
    if (feedback === "fail") {
      if (showWhy && id === q.answer) return "correct"
      if (id === selected) return "fail"
      return "default"
    }
    return id === selected ? "selected" : "default"
  }

  return (
    <StageSplit
      header={
        <div className="mt-7">
          <Eyebrow>Predict the break</Eyebrow>
          <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground lg:text-2xl">{q.prompt}</h2>
        </div>
      }
      figure={
        <div className="flex justify-center py-5">
          {reveal ? (
            <FrameSequence
              frames={frames}
              autoPlayMs={(i) => (i === 0 ? 800 : 1)}
              reduced={reduced}
              className="items-center"
            >
              {(frame) => (
                <>
                  <NodeGraph
                    mode="replay"
                    nodes={q.nodes}
                    newNode={q.newNode}
                    prev={q.prev}
                    at={q.at}
                    workingNext={frame.workingNext}
                    orphaned={frame.orphaned}
                    reducedMotion={reduced}
                  />
                  <p className="max-w-xs text-center text-xs text-muted-foreground">{frame.caption}</p>
                </>
              )}
            </FrameSequence>
          ) : (
            <NodeGraph mode="walk" nodes={q.nodes} cursor={q.nodes.length} layout="wrap" reducedMotion={reduced} />
          )}
        </div>
      }
      interaction={
        <>
          <div className="flex flex-col gap-3">
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

          <FeedbackFooter
            feedback={feedback}
            selected={selected}
            showWhy={showWhy}
            hideFailHint
            copy={feedbackCopy(q)}
            dispatch={dispatch}
          />
        </>
      }
    />
  )
}

/* ------------------------------- beat 7 (playlist synthesis) ------------- */

const PHASE_LABEL: Record<string, string> = {
  insert: "Queue",
  delete: "Remove",
  reorder: "Reorder",
}

function PhaseRail({ phaseIndex, solved }: { phaseIndex: number; solved: boolean }) {
  const phases = ["insert", "delete", "reorder"]
  const active = solved ? phases.length : phaseIndex
  return (
    <div aria-hidden className="mt-3 flex items-center justify-center gap-1.5">
      {phases.map((p, i) => {
        const done = i < active
        const isActive = i === active
        return (
          <span
            key={p}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors",
              done
                ? "border-[#1db954]/40 bg-[#1db954]/10 text-[#1db954]"
                : isActive
                  ? "border-[#1db954] bg-[#1db954]/15 text-white"
                  : "border-white/10 bg-white/[0.03] text-white/40",
            )}
          >
            {PHASE_LABEL[p]}
          </span>
        )
      })}
    </div>
  )
}

function PlaylistPart({
  state,
  dispatch,
}: {
  state: LinkedListsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion()
  if (!q) return null
  const { feedback } = state
  const solved = feedback === "correct"
  const step = playlistStepLL(state)
  const phaseIndex = playlistPhaseIndexLL(state)

  return (
    <StageCenter>
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
        className="-mx-5 -mb-6 flex flex-1 flex-col bg-[#121212] px-5 pb-6 pt-7 text-white"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Queue</h2>
            <p className="mt-0.5 text-sm text-white/60">
              Playing <span className="font-semibold text-white">Liked Songs</span>
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold">Edit</span>
        </div>

        <PhaseRail phaseIndex={phaseIndex} solved={solved} />
        <p className="mt-3 text-center text-sm text-white/70">{solved ? q.correct : step?.prompt ?? q.prompt}</p>

        <div className="flex flex-1 flex-col justify-center py-3">
          <RewireSurface
            legalTargets={legalTargets(state)}
            onRewire={(from, to) => dispatch({ type: "rewire", from, to })}
            label="Re-aim a track's arrow onto another track to edit the queue"
          >
            <PlaylistQueue
              nodes={q.nodes}
              newNode={q.newNode}
              prev={q.prev}
              workingNext={state.workingNext}
              orphaned={playlistOrphanedLL(state)}
              rewires={remainingScriptLL(state)}
              reducedMotion={reduced ?? false}
            />
          </RewireSurface>
        </div>

        <PlaylistFooter state={state} dispatch={dispatch} />
      </motion.div>
    </StageCenter>
  )
}

function PlaylistFooter({
  state,
  dispatch,
}: {
  state: LinkedListsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question!
  const { feedback } = state
  const step = playlistStepLL(state)
  return (
    <div className="mt-auto min-h-[124px] pt-2">
      {feedback === "correct" && (
        <>
          <SpotifyChip tone="ok">{q.correct}</SpotifyChip>
          <SpotifyButton onClick={() => dispatch({ type: "next" })}>Continue</SpotifyButton>
        </>
      )}
      {feedback === "nudge" && <SpotifyChip tone="hint">{step?.nudge ?? q.nudge}</SpotifyChip>}
      {feedback === "idle" && (
        <p className="text-center text-sm text-white/55">
          Drag a track's arrow onto another track to do this step.
        </p>
      )}
    </div>
  )
}

function SpotifyButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full bg-[#1db954] py-3.5 text-center text-[15px] font-bold text-black outline-none transition-transform active:scale-[0.99] disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function SpotifyChip({ tone, children }: { tone: "ok" | "bad" | "hint"; children: ReactNode }) {
  const dot = tone === "ok" ? "bg-[#1db954]" : tone === "bad" ? "bg-red-500" : "bg-white/50"
  return (
    <div className="mb-4 flex flex-col items-center gap-2 text-center">
      <span className={cn("size-2.5 rounded-full", dot)} aria-hidden />
      <p className="text-sm text-white/70">{children}</p>
    </div>
  )
}

/* ------------------------------- beats 8 & 9 (contrast) ----------------------------- */

function ContrastPart({
  state,
  dispatch,
}: {
  state: LinkedListsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  if (!q) return null
  const { feedback, selected, showWhy, contrastPhase, pick } = state
  const terminal = isTerminalLL(state)
  const isInsert = currentPartLL(state) === "contrast-insert"
  const items = q.array ?? q.nodes
  const arrayHighlight = isInsert ? Math.floor(items.length / 2) : items.length - 1
  const listCursor = isInsert ? Math.floor(q.nodes.length / 2) : q.targetIndex
  const inWhy = contrastPhase === "why"
  const options = inWhy ? q.whyOptions : q.pickOptions
  const answerId = inWhy ? q.whyAnswer : q.pickAnswer
  const pickLabel = pick ? q.pickOptions.find((o) => o.id === pick)?.label : null

  const cardState = (id: string): AnswerState => {
    if (!inWhy) return id === selected ? "selected" : "default" // pick is low-stakes
    if (feedback === "correct") return id === q.whyAnswer ? "correct" : "default"
    if (feedback === "nudge") return id === selected ? "nudge" : "default"
    if (feedback === "fail") {
      if (showWhy && id === q.whyAnswer) return "correct"
      if (id === selected) return "fail"
      return "default"
    }
    return id === selected ? "selected" : "default"
  }

  return (
    <StageSplit
      header={
        <div className="mt-7">
          <Eyebrow>Array vs list</Eyebrow>
          <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground lg:text-2xl">
            {inWhy ? "Why?" : q.prompt}
          </h2>
          {inWhy && pickLabel && (
            <p className="mt-1 text-center text-xs text-muted-foreground">
              You picked <span className="font-semibold text-foreground">{pickLabel}</span>. Now, why?
            </p>
          )}
        </div>
      }
      figure={
        <>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex flex-col items-center gap-1.5">
              <CompareLabel>Array</CompareLabel>
              <ArrayRow cells={items} highlight={arrayHighlight} />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <CompareLabel>List</CompareLabel>
              <NodeGraph mode="walk" nodes={q.nodes} cursor={listCursor} layout="wrap" spotlight={isInsert} reducedMotion={reduced} />
            </div>
          </div>

          {feedback === "correct" && q.arrayCost && q.listCost && (
            <div className="mb-4 flex flex-wrap justify-center gap-2">
              <LabeledCost label="Array" cost={q.arrayCost} />
              <LabeledCost label="List" cost={q.listCost} />
            </div>
          )}
        </>
      }
      interaction={
        <>
          <div className="flex flex-col gap-3">
            {options.map((opt, i) => (
              <AnswerCard
                key={opt.id}
                letter={String.fromCharCode(65 + i)}
                label={opt.label}
                state={cardState(opt.id)}
                disabled={terminal}
                answerMarker={opt.id === answerId}
                onSelect={() => dispatch({ type: "select", letter: opt.id })}
              />
            ))}
          </div>

          <FeedbackFooter
            feedback={feedback}
            selected={selected}
            showWhy={showWhy}
            hideFailHint
            copy={{
              prompt: q.prompt,
              hint: inWhy ? "" : "Make your pick, then we'll dig into why.",
              nudge: q.nudge,
              correct: q.correct,
              why: q.why,
            }}
            dispatch={dispatch}
          />
        </>
      }
    />
  )
}

/* --------------------------------- beat 10 (doubly demo) -------------------------- */

function DoublyDemoPart({
  state,
  dispatch,
}: {
  state: LinkedListsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const [cursor, setCursor] = useState(0)
  if (!q) return null
  const nodes = q.nodes

  return (
    <StageCenter>
      <div className="mt-7 text-center">
        <Eyebrow>Doubly-linked · the twist</Eyebrow>
        <h2 className="mx-auto mt-2 max-w-sm text-xl font-bold text-foreground lg:text-2xl">{q.prompt}</h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-5">
        <DoublyChain nodes={nodes} cursor={cursor} />
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={cursor === 0}
            onClick={() => setCursor((c) => Math.max(0, c - 1))}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          <span className="min-w-16 text-center text-sm text-muted-foreground">At {nodes[cursor]}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={cursor === nodes.length - 1}
            onClick={() => setCursor((c) => Math.min(nodes.length - 1, c + 1))}
          >
            Forward <ArrowRight className="size-4" />
          </Button>
        </div>
        <p className="mx-auto max-w-xs text-center text-sm text-muted-foreground">
          A <span className="concept">back-pointer</span> means you can walk{" "}
          <span className="concept" style={{ animationDelay: "450ms" }}>
            either direction
          </span>
          .
        </p>
      </div>

      <div className="mt-auto">
        <Button variant="tactile" size="lg" className="w-full" onClick={() => dispatch({ type: "continue" })}>
          Continue
        </Button>
      </div>
    </StageCenter>
  )
}

/* --------------------------------- beat 11 (doubly splice) ----------------------- */

function DoublySplicePart({
  state,
  dispatch,
}: {
  state: LinkedListsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q) return null
  const { feedback } = state
  const solved = feedback === "correct"
  const performed = state.writes
    .map((w) => q.doublyWrites.find((d) => d.from === w.from && d.to === w.to))
    .filter((d): d is DoublyWrite => d != null)
  // Stable display order for the chips: shuffled once per question by label hash.
  const chips = orderChips(q.doublyWrites)

  return (
    <StageCenter>
      <div className="mt-7">
        <Eyebrow>Doubly splice · 4 writes</Eyebrow>
        <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground lg:text-2xl">{q.prompt}</h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-5">
        <DoublySplice nodes={q.nodes} newNode={q.newNode!} prev={q.prev!} at={q.at!} performed={performed} />

        <div className="grid w-full max-w-sm grid-cols-2 gap-2.5">
          {chips.map((w) => {
            const done = isWriteDoneLL(state, w)
            return (
              <button
                key={w.label}
                type="button"
                disabled={done || solved}
                onClick={() => dispatch({ type: "rewire", from: w.from, to: w.to })}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2.5 font-mono text-sm font-semibold outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  done
                    ? "border-success bg-success-soft text-foreground"
                    : "cursor-pointer border-border bg-card text-foreground hover:border-lilac-strong/50",
                )}
              >
                {done && <Check className="size-3.5 text-success" strokeWidth={3} />}
                {w.label}
              </button>
            )
          })}
        </div>
      </div>

      <DoublyFooter state={state} dispatch={dispatch} />
    </StageCenter>
  )
}

/** Deterministic chip order (a stable scramble so the correct order is not handed over). */
function orderChips(writes: DoublyWrite[]): DoublyWrite[] {
  // A fixed reordering: 3rd, 1st, 4th, 2nd. Stable and not the answer order.
  const order = [2, 0, 3, 1]
  return order.map((i) => writes[i]).filter((w): w is DoublyWrite => w != null)
}

function DoublyFooter({
  state,
  dispatch,
}: {
  state: LinkedListsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question!
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
          Tap the writes in the safe order, with the newcomer's own pointers first.
        </p>
      )}
    </div>
  )
}

/* --------------------------------- beat 12 (doubly walk) ------------------------- */

function DoublyWalkPart({
  state,
  dispatch,
}: {
  state: LinkedListsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q) return null
  const { feedback, selected, showWhy } = state
  const terminal = isTerminalLL(state)
  const tail = q.nodes.length - 1
  const answerIdx = q.nodes.indexOf(q.answer)
  const reveal = feedback === "fail" && showWhy
  const cursor = reveal ? answerIdx : walkCursorLL(state)
  const frontier = terminal ? undefined : walkFrontierLL(state)
  const tone: "active" | "correct" | "wrong" =
    feedback === "correct" || reveal ? "correct" : feedback === "nudge" || feedback === "fail" ? "wrong" : "active"
  const backHops = tail - cursor
  const showCost = backHops >= 1 || feedback === "correct"

  return (
    <StageCenter>
      <div className="mt-7">
        <Eyebrow>Doubly walk · backward</Eyebrow>
        <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground lg:text-2xl">{q.prompt}</h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-5">
        <DoublyChain
          nodes={q.nodes}
          cursor={cursor}
          litFrom={cursor}
          litTo={tail}
          litDir="prev"
          tone={tone}
          frontier={frontier}
          onTapNode={terminal ? undefined : (i) => dispatch({ type: "select", letter: q.nodes[i] })}
        />
        {showCost && (
          <CostReadout
            word="scales"
            count={feedback === "correct" ? q.cost.count : Math.max(0, backHops)}
            unit={backHops === 1 ? "hop" : "hops"}
          />
        )}
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          Follow the <span className="concept">prev pointer</span> one hop at a time from the tail. Commit when you've
          arrived.
        </p>
      </div>

      <FeedbackFooter
        feedback={feedback}
        selected={selected}
        showWhy={showWhy}
        hideFailHint
        copy={feedbackCopy(q)}
        dispatch={dispatch}
      />
    </StageCenter>
  )
}
