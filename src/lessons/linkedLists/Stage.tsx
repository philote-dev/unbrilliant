import { Fragment, useState, type Dispatch } from "react"
import { ArrowLeft, ArrowRight, Check } from "lucide-react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AnswerCard, type AnswerState } from "@/components/willow/AnswerCard"
import { CostReadout, type CostWord } from "@/components/willow/CostReadout"
import { FeedbackFooter } from "@/components/willow/FeedbackFooter"
import { RewireSurface } from "@/components/rewire/RewireSurface"
import type { LessonAction } from "@/features/lesson/engine"
import {
  currentPartLL,
  isStuckLL,
  isTerminalLL,
  legalTargets,
  orphanedNodes,
  type LinkedListsState,
} from "@/features/lesson/linkedListsEngine"
import { ArrayRow } from "@/lessons/arrays/ArrayRow"
import { NodeGraph } from "./NodeGraph"
import { PlaylistQueue } from "./PlaylistQueue"

/**
 * The Linked Lists stage. Slices 1–2 route the first four beats: a node-drag
 * demo (position is meaningless), a teach screen (pointers are the structure),
 * the tap-to-walk traverse (L1, MCQ after the felt walk), and the write-order
 * rewire-insert (L2). All verdict UX flows through the shared FeedbackFooter.
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
    case "doubly":
      return <DoublyPart state={state} dispatch={dispatch} />
  }
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
    <div className="flex flex-1 flex-col">
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground">Linked Lists: it's the arrows</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">{q.prompt}</p>
      </div>

      <div className="flex flex-1 flex-col py-4">
        <NodeGraph mode="demo" nodes={q.nodes} />
      </div>

      <div className="mt-auto">
        <p className="mb-3 text-center text-sm text-muted-foreground">
          Move a node anywhere — the order doesn't change. Only the arrows say what comes next.
        </p>
        <Button variant="tactile" size="lg" className="w-full" onClick={() => dispatch({ type: "continue" })}>
          Continue
        </Button>
      </div>
    </div>
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
  if (!q) return null
  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground">Pointers, not position</h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6">
        <NodeGraph mode="walk" nodes={q.nodes} cursor={q.nodes.length} layout="wrap" />
        <div className="mx-auto max-w-xs space-y-3 text-sm text-muted-foreground">
          <p>
            Each node points to the next. To reach the k-th node you{" "}
            <span className="font-semibold text-foreground">walk from the head</span> — there's no jump.
          </p>
          <p>
            And the <span className="font-semibold text-foreground">head is sacred</span>: lose it and the
            whole list is gone.
          </p>
        </div>
      </div>

      <div className="mt-auto">
        <Button variant="tactile" size="lg" className="w-full" onClick={() => dispatch({ type: "continue" })}>
          Continue
        </Button>
      </div>
    </div>
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
  if (!q) return null
  const { feedback, selected, showWhy } = state
  const terminal = isTerminalLL(state)

  // Click-to-answer: the selected node is the answer; tapping any node lights the
  // head→node path and shows the hop cost. On a full fail, Why? reveals the
  // correct node's path instead.
  const selectedIdx = selected ? q.nodes.indexOf(selected) : -1
  const answerIdx = q.nodes.indexOf(q.answer)
  const reveal = feedback === "fail" && showWhy
  const cursor = reveal ? answerIdx : selectedIdx
  const tone: "active" | "correct" | "wrong" =
    feedback === "correct" || reveal
      ? "correct"
      : feedback === "nudge" || feedback === "fail"
        ? "wrong"
        : "active"
  const showCost = cursor >= 1 || feedback === "correct"
  const costCount = feedback === "correct" ? q.cost.count : Math.max(0, cursor)

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7">
        <p className="text-center text-xs font-medium uppercase tracking-wide text-lilac-strong">Traverse</p>
        <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground">{q.prompt}</h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-5">
        <NodeGraph
          mode="walk"
          nodes={q.nodes}
          cursor={cursor}
          cursorTone={tone}
          answerIndex={answerIdx}
          layout="wrap"
          onTapNode={terminal ? undefined : (i) => dispatch({ type: "select", letter: q.nodes[i] })}
        />
        {showCost && (
          <CostReadout word="scales" count={costCount} unit={costCount === 1 ? "hop" : "hops"} />
        )}
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          Tap a node to walk there from the head — the arrows are the only path.
        </p>
      </div>

      <FeedbackFooter
        feedback={feedback}
        selected={selected}
        showWhy={showWhy}
        hideFailHint
        copy={{ prompt: q.prompt, hint: q.hint, nudge: q.nudge, correct: q.correct, why: q.why }}
        dispatch={dispatch}
      />
    </div>
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
  if (!q) return null
  const { feedback, showWhy } = state
  const canCheck = state.writes.length > 0
  const stuck = isStuckLL(state)

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7 flex flex-col items-center">
        <p className="text-center text-xs font-medium uppercase tracking-wide text-lilac-strong">Rewire</p>
        <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground">{q.prompt}</h2>
      </div>

      <div className="flex flex-1 flex-col justify-center py-6">
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
          />
        </RewireSurface>

        {stuck && feedback !== "fail" && (
          <p className="mt-4 text-center text-sm text-faint">
            The tail floated off — there's no pointer left to reach it.
          </p>
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
        copy={{ prompt: q.prompt, hint: q.hint, nudge: q.nudge, correct: q.correct, why: q.why }}
        dispatch={dispatch}
      />
    </div>
  )
}

/* ------------------------------- beat 7 (playlist) ------------------------ */

/**
 * The real-world skin of the insert: a Spotify-style queue. Same engine + rewire
 * surface as RewirePart, but the page transitions into a dark/green theme and the
 * chain renders as a vertical track list. The new song is queued by re-aiming two
 * pointers in the save-first order (drag a track's arrow onto another track).
 */
function PlaylistPart({
  state,
  dispatch,
}: {
  state: LinkedListsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  if (!q) return null
  const { feedback, showWhy } = state
  const canCheck = state.writes.length > 0
  const stuck = isStuckLL(state)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
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

      <p className="mt-3 text-sm text-white/70">{q.prompt}</p>

      <div className="flex flex-1 flex-col justify-center py-3">
        <RewireSurface
          legalTargets={legalTargets(state)}
          onRewire={(from, to) => dispatch({ type: "rewire", from, to })}
          label="Re-aim a track's arrow onto another track to queue the new song"
        >
          <PlaylistQueue
            nodes={q.nodes}
            newNode={q.newNode}
            prev={q.prev}
            workingNext={state.workingNext}
            orphaned={orphanedNodes(state)}
            rewires={q.rewires}
          />
        </RewireSurface>

        {stuck && feedback !== "fail" && (
          <p className="mt-4 text-center text-sm text-white/45">
            The rest of the queue floated off — nothing points to it anymore.
          </p>
        )}
      </div>

      <PlaylistFooter state={state} dispatch={dispatch} canCheck={canCheck} showWhy={showWhy} />
    </motion.div>
  )
}

function PlaylistFooter({
  state,
  dispatch,
  canCheck,
  showWhy,
}: {
  state: LinkedListsState
  dispatch: Dispatch<LessonAction>
  canCheck: boolean
  showWhy: boolean
}) {
  const q = state.question!
  const { feedback } = state
  return (
    <div className="mt-auto min-h-[124px] pt-2">
      {feedback === "idle" && (
        <>
          <p className="mb-3 text-center text-sm text-white/55">{q.hint}</p>
          <SpotifyButton disabled={!canCheck} onClick={() => dispatch({ type: "check" })}>
            Check
          </SpotifyButton>
        </>
      )}
      {feedback === "nudge" && (
        <>
          <SpotifyChip tone="hint">{q.nudge}</SpotifyChip>
          <SpotifyButton disabled={!canCheck} onClick={() => dispatch({ type: "check" })}>
            Check
          </SpotifyButton>
        </>
      )}
      {feedback === "correct" && (
        <>
          <SpotifyChip tone="ok">{q.correct}</SpotifyChip>
          <SpotifyButton onClick={() => dispatch({ type: "next" })}>Continue</SpotifyButton>
        </>
      )}
      {feedback === "fail" && (
        <>
          <SpotifyChip tone="bad">
            {showWhy ? q.why : "Not quite — tap Why for the answer, or reattempt."}
          </SpotifyChip>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={showWhy}
              onClick={() => dispatch({ type: "reveal" })}
              className="flex-1 rounded-full bg-white/10 py-3.5 font-semibold text-white outline-none transition-colors hover:bg-white/15 disabled:opacity-40"
            >
              Why?
            </button>
            <SpotifyButton onClick={() => dispatch({ type: "reattempt" })}>Reattempt</SpotifyButton>
          </div>
        </>
      )}
    </div>
  )
}

function SpotifyButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
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

function SpotifyChip({ tone, children }: { tone: "ok" | "bad" | "hint"; children: React.ReactNode }) {
  const dot =
    tone === "ok" ? "bg-[#1db954]" : tone === "bad" ? "bg-red-500" : "bg-white/50"
  return (
    <div className="mb-4 flex flex-col items-center gap-2 text-center">
      <span className={cn("size-2.5 rounded-full", dot)} aria-hidden />
      <p className="text-sm text-white/70">{children}</p>
    </div>
  )
}

/* --------------------------------- beat 6 --------------------------------- */

function PredictPart({
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
    <div className="flex flex-1 flex-col">
      <div className="mt-7">
        <p className="text-center text-xs font-medium uppercase tracking-wide text-lilac-strong">
          Predict the break
        </p>
        <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground">{q.prompt}</h2>
      </div>

      <div className="flex justify-center py-5">
        <NodeGraph mode="walk" nodes={q.nodes} cursor={q.nodes.length} layout="wrap" />
      </div>

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
        copy={{ prompt: q.prompt, hint: q.hint, nudge: q.nudge, correct: q.correct, why: q.why }}
        dispatch={dispatch}
      />
    </div>
  )
}

/* ------------------------------- beats 8 & 9 ----------------------------- */

function ContrastPart({
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
  const isInsert = currentPartLL(state) === "contrast-insert"
  const items = q.array ?? q.nodes
  const arrayHighlight = isInsert ? Math.floor(items.length / 2) : items.length - 1
  const listCursor = isInsert ? q.nodes.length : q.targetIndex

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
    <div className="flex flex-1 flex-col">
      <div className="mt-7">
        <p className="text-center text-xs font-medium uppercase tracking-wide text-lilac-strong">
          Array vs list
        </p>
        <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground">{q.prompt}</h2>
      </div>

      <div className="flex flex-col items-center gap-4 py-4">
        <div className="flex flex-col items-center gap-1.5">
          <CompareLabel>Array</CompareLabel>
          <ArrayRow cells={items} highlight={arrayHighlight} />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <CompareLabel>List</CompareLabel>
          <NodeGraph mode="walk" nodes={q.nodes} cursor={listCursor} layout="wrap" />
        </div>
      </div>

      {feedback === "correct" && q.arrayCost && q.listCost && (
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          <LabeledCost label="Array" cost={q.arrayCost} />
          <LabeledCost label="List" cost={q.listCost} />
        </div>
      )}

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
        copy={{ prompt: q.prompt, hint: q.hint, nudge: q.nudge, correct: q.correct, why: q.why }}
        dispatch={dispatch}
      />
    </div>
  )
}

function CompareLabel({ children }: { children: React.ReactNode }) {
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

/* --------------------------------- beat 10 -------------------------------- */

function DoublyPart({
  state,
  dispatch,
}: {
  state: LinkedListsState
  dispatch: Dispatch<LessonAction>
}) {
  const q = state.question
  const [cursor, setCursor] = useState(0)
  const [writes, setWrites] = useState(0)
  if (!q) return null
  const nodes = q.nodes
  const A = q.prev ?? nodes[0]
  const B = q.at ?? nodes[1]
  const X = q.newNode ?? "X"
  const steps = [`${X}.next = ${B}`, `${X}.prev = ${A}`, `${A}.next = ${X}`, `${B}.prev = ${X}`]

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-lilac-strong">
          Doubly-linked · the twist
        </p>
        <h2 className="mx-auto mt-2 max-w-sm text-xl font-bold text-foreground">{q.prompt}</h2>
      </div>

      <div className="flex flex-col items-center gap-4 py-5">
        <div className="flex flex-wrap items-center justify-center gap-1">
          {nodes.map((n, i) => (
            <Fragment key={n}>
              <span
                className={cn(
                  "flex h-12 min-w-12 items-center justify-center rounded-xl border-2 px-3 font-bold text-foreground transition-colors",
                  i === cursor ? "border-lilac-strong bg-lilac-soft" : "border-border bg-card",
                )}
              >
                {n}
              </span>
              {i < nodes.length - 1 && <BiArrow />}
            </Fragment>
          ))}
        </div>

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
        <p className="text-center text-xs text-muted-foreground">
          A back-pointer means you can walk either direction.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-foreground">
          Splicing in a node now takes <span className="font-semibold">4 ordered writes</span>:
        </p>
        <ol className="mt-3 space-y-2">
          {steps.map((s, i) => (
            <li
              key={s}
              className={cn(
                "flex items-center gap-2 font-mono text-sm",
                i < writes ? "text-foreground" : "text-faint",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full",
                  i < writes ? "bg-success text-white" : "bg-muted text-muted-foreground",
                )}
              >
                {i < writes ? <Check className="size-3" strokeWidth={3} /> : <span className="text-[10px]">{i + 1}</span>}
              </span>
              {s}
            </li>
          ))}
        </ol>
        {writes < 4 ? (
          <Button variant="soft" size="sm" className="mt-3 w-full" onClick={() => setWrites((w) => w + 1)}>
            Show write {writes + 1}
          </Button>
        ) : (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Four writes — and the list stays linked both directions.
          </p>
        )}
      </div>

      <div className="mt-auto pt-4">
        <Button variant="tactile" size="lg" className="w-full" onClick={() => dispatch({ type: "continue" })}>
          Finish lesson
        </Button>
      </div>
    </div>
  )
}

function BiArrow() {
  return (
    <span className="flex flex-col items-center text-faint" aria-hidden>
      <ArrowRight className="size-3.5" strokeWidth={2.4} />
      <ArrowLeft className="-mt-1 size-3.5" strokeWidth={2.4} />
    </span>
  )
}
