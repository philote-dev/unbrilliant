import { useState, type Dispatch } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AnswerCard, type AnswerState } from "@/components/willow/AnswerCard"
import { FeedbackFooter } from "@/components/willow/FeedbackFooter"
import { RewireSurface } from "@/components/rewire/RewireSurface"
import type { LessonAction, QuestionCopy } from "@/features/lesson/engine"
import {
  canCheckGraphs,
  currentBinLabel,
  currentPartGraphs,
  isTerminalGraphs,
  legalDrawTargets,
  neighbors,
  normalizeEdge,
  partQuotaGraphs,
  type GraphOption,
  type GraphsQuestion,
  type GraphsState,
  type NodeId,
} from "@/features/lesson/graphsEngine"
import { AdjacencyPanel } from "./AdjacencyPanel"
import { GraphCanvas } from "./GraphCanvas"
import { SameGraphView } from "./SameGraphView"

/**
 * The Graphs stage. Routes the 12 beats: the drag-a-node + teach intros, four
 * de-cued reads (tap-the-neighbors multi-select, path yes/no, picture→list MCQ),
 * two undirected edge-draws (plain + a transit skin) via the shared rewire
 * surface, the redraw demo, and two classify beats (same-graph, tree-or-not).
 * Every verdict flows through the shared FeedbackFooter; nothing here grades.
 */
export function GraphsStage({
  state,
  dispatch,
}: {
  state: GraphsState
  dispatch: Dispatch<LessonAction>
}) {
  switch (currentPartGraphs(state)) {
    case "demo":
      return <DemoPart state={state} dispatch={dispatch} />
    case "teach":
      return <TeachPart state={state} dispatch={dispatch} />
    case "read-list":
    case "read-degree":
      return <ReadMultiSelectPart state={state} dispatch={dispatch} />
    case "read-path":
      return <YesNoPart state={state} dispatch={dispatch} />
    case "match-list":
      return <MatchListPart state={state} dispatch={dispatch} />
    case "draw-demo":
      return <DrawDemoPart state={state} dispatch={dispatch} />
    case "draw-edge":
    case "draw-transit":
      return <DrawPart state={state} dispatch={dispatch} />
    case "redraw-demo":
      return <RedrawDemoPart state={state} dispatch={dispatch} />
    case "same-graph":
    case "tree-or-not":
      return <ClassifyPart state={state} dispatch={dispatch} />
  }
}

type PartProps = { state: GraphsState; dispatch: Dispatch<LessonAction> }

/* --------------------------------- shared bits --------------------------------- */

function feedbackCopy(q: GraphsQuestion): QuestionCopy {
  return { prompt: q.prompt, hint: q.hint, nudge: q.nudge, correct: q.correct, why: q.why }
}

function BinHeader({ state, transit }: { state: GraphsState; transit?: boolean }) {
  const q = state.question
  const quota = partQuotaGraphs(state)
  const label = currentBinLabel(state)
  return (
    <div className="mt-7">
      {quota && label && (
        <p className="text-center text-xs font-medium uppercase tracking-wide text-lilac-strong">
          {transit ? "Real-world · " : ""}
          {label} · {quota.done} / {quota.total} correct
        </p>
      )}
      <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground">
        {q?.prompt}
      </h2>
    </div>
  )
}

function optionState(
  feedback: GraphsState["feedback"],
  selected: string | null,
  showWhy: boolean,
  optId: string,
  answerId: string,
): AnswerState {
  if (feedback === "correct") return optId === answerId ? "correct" : "default"
  if (feedback === "nudge") return optId === selected ? "nudge" : "default"
  if (feedback === "fail") {
    if (showWhy && optId === answerId) return "correct"
    if (optId === selected) return "fail"
    return "default"
  }
  return optId === selected ? "selected" : "default"
}

/* --------------------------------- beat 1: demo --------------------------------- */

function DemoPart({ state, dispatch }: PartProps) {
  const q = state.question
  if (!q) return null
  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground">Graphs: the list is the data</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">{q.prompt}</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4">
        <GraphCanvas mode="demo" nodes={q.nodes} adj={q.adj} layout={q.layout} />
        <AdjacencyPanel nodes={q.nodes} adj={q.adj} />
      </div>

      <div className="mt-auto">
        <p className="mb-3 text-center text-sm text-muted-foreground">
          Drag a node anywhere — the connections (and the list) never change.
        </p>
        <Button variant="tactile" size="lg" className="w-full" onClick={() => dispatch({ type: "continue" })}>
          Continue
        </Button>
      </div>
    </div>
  )
}

/* --------------------------------- beat 2: teach -------------------------------- */

function TeachPart({ state, dispatch }: PartProps) {
  const q = state.question
  // Default ON: hide the picture so the list carries the weight (the lesson's
  // whole point). Purely visual: no dispatch, teach beat only.
  const [hidePicture, setHidePicture] = useState(true)
  if (!q) return null
  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground">A graph is not a tree</h2>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-5">
        {!hidePicture && (
          <GraphCanvas mode="display" nodes={q.nodes} adj={q.adj} layout={q.layout} />
        )}
        <AdjacencyPanel nodes={q.nodes} adj={q.adj} />
        <Button
          variant="soft"
          size="sm"
          aria-pressed={hidePicture}
          onClick={() => setHidePicture((v) => !v)}
        >
          {hidePicture ? "Show the picture" : "Hide the picture"}
        </Button>
        {hidePicture && (
          <p className="text-center text-sm font-medium text-foreground">
            Everything the questions need is right here.
          </p>
        )}
        <div className="mx-auto max-w-xs space-y-3 text-sm text-muted-foreground">
          <p>
            The <span className="font-semibold text-foreground">adjacency list is the data</span>; the
            picture is decoration. Every question reads from the list.
          </p>
          <p>
            A graph has <span className="font-semibold text-foreground">no root and may have cycles</span> —
            that's how it differs from a tree. (Some connections only go one way — a later idea.)
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

/* ----------------------------- beats 3 & 4: reads ------------------------------ */

function ReadMultiSelectPart({ state, dispatch }: PartProps) {
  const q = state.question
  const [announce, setAnnounce] = useState("")
  if (!q) return null
  const { feedback, selectedNodes, showWhy } = state
  const terminal = isTerminalGraphs(state)
  const reveal = feedback === "correct" || (feedback === "fail" && showWhy)
  const focus = q.markedNodes?.[0]
  const litEdges =
    reveal && focus && q.answerSet ? q.answerSet.map((n) => normalizeEdge(focus, n)) : []
  const panelHighlight = reveal
    ? [...(q.answerSet ?? []), ...(focus ? [focus] : [])]
    : selectedNodes
  const isDegree = q.kind === "read-degree"

  const onToggle = terminal
    ? undefined
    : (n: NodeId) => {
        const list = neighbors(q.adj, n)
        setAnnounce(`${n} connects to ${list.length ? list.join(", ") : "nothing"}.`)
        dispatch({ type: "select", letter: n })
      }

  return (
    <div className="flex flex-1 flex-col">
      <BinHeader state={state} />

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-3">
        <GraphCanvas
          mode="multiselect"
          nodes={q.nodes}
          adj={q.adj}
          layout={q.layout}
          markedNodes={q.markedNodes}
          selectedNodes={selectedNodes}
          answerSet={q.answerSet}
          litEdges={litEdges}
          onToggleNode={onToggle}
          terminal={terminal}
        />
        <p className="text-sm font-medium text-foreground">
          {isDegree ? "Degree so far: " : "Selected: "}
          <span className="tabular-nums font-bold text-lilac-strong">{selectedNodes.length}</span>
        </p>
        <AdjacencyPanel nodes={q.nodes} adj={q.adj} highlightNodes={panelHighlight} />
        <p role="status" aria-live="polite" className="sr-only">
          {announce}
        </p>
      </div>

      <FeedbackFooter
        feedback={feedback}
        selected={null}
        canCheck={canCheckGraphs(state)}
        showWhy={showWhy}
        hideFailHint
        copy={feedbackCopy(q)}
        dispatch={dispatch}
      />
    </div>
  )
}

/* ------------------------------- beat 5: path yes/no --------------------------- */

function YesNoPart({ state, dispatch }: PartProps) {
  const q = state.question
  if (!q) return null
  const { feedback, selected, showWhy } = state
  const terminal = isTerminalGraphs(state)

  return (
    <div className="flex flex-1 flex-col">
      <BinHeader state={state} />

      <div className="flex flex-col items-center gap-3 py-3">
        <GraphCanvas mode="display" nodes={q.nodes} adj={q.adj} layout={q.layout} markedNodes={q.markedNodes} />
        <AdjacencyPanel
          nodes={q.nodes}
          adj={q.adj}
          highlightNodes={q.pair ? [q.pair[0], q.pair[1]] : undefined}
        />
      </div>

      <div className="flex gap-3">
        {q.options.map((opt, i) => (
          <AnswerCard
            key={opt.id}
            letter={String.fromCharCode(65 + i)}
            label={opt.label}
            state={optionState(feedback, selected, showWhy, opt.id, q.answer)}
            disabled={terminal}
            answerMarker={opt.id === q.answer}
            onSelect={() => dispatch({ type: "select", letter: opt.id })}
            className="flex-1"
          />
        ))}
      </div>

      <FeedbackFooter
        feedback={feedback}
        selected={selected}
        canCheck={canCheckGraphs(state)}
        showWhy={showWhy}
        hideFailHint
        copy={feedbackCopy(q)}
        dispatch={dispatch}
      />
    </div>
  )
}

/* ------------------------------ beat 6: match-list ----------------------------- */

function MatchListPart({ state, dispatch }: PartProps) {
  const q = state.question
  if (!q) return null
  const { feedback, selected, showWhy } = state
  const terminal = isTerminalGraphs(state)

  return (
    <div className="flex flex-1 flex-col">
      <BinHeader state={state} />

      <div className="flex justify-center py-3">
        <GraphCanvas mode="display" nodes={q.nodes} adj={q.adj} layout={q.layout} />
      </div>

      <div className="flex flex-col gap-2.5">
        {q.options.map((opt) => (
          <AdjOptionCard
            key={opt.id}
            option={opt}
            nodes={q.nodes}
            state={optionState(feedback, selected, showWhy, opt.id, q.answer)}
            isAnswer={opt.id === q.answer}
            disabled={terminal}
            onSelect={() => dispatch({ type: "select", letter: opt.id })}
          />
        ))}
      </div>

      <FeedbackFooter
        feedback={feedback}
        selected={selected}
        canCheck={canCheckGraphs(state)}
        showWhy={showWhy}
        hideFailHint
        copy={feedbackCopy(q)}
        dispatch={dispatch}
      />
    </div>
  )
}

const OPTION_SURFACE: Record<AnswerState, string> = {
  default: "border-border bg-card hover:border-lilac-strong/45",
  selected: "border-lilac-strong bg-lilac-soft ring-4 ring-lilac-strong/15",
  correct: "border-success bg-success-soft",
  nudge: "border-warning bg-warning-soft",
  fail: "border-danger bg-danger-soft",
}

function AdjOptionCard({
  option,
  nodes,
  state,
  isAnswer,
  disabled,
  onSelect,
}: {
  option: GraphOption
  nodes: NodeId[]
  state: AnswerState
  isAnswer: boolean
  disabled?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      data-testid="answer-card"
      data-answer={isAnswer && import.meta.env.DEV ? "1" : undefined}
      aria-pressed={state === "selected"}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border-2 p-3 text-left outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled && state === "default" && "cursor-default",
        OPTION_SURFACE[state],
      )}
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-xs">
        {nodes.map((n) => (
          <div key={n} className="flex gap-1.5">
            <span className="font-bold text-foreground">{n}:</span>
            <span className="text-muted-foreground">
              {neighbors(option.adj ?? {}, n).join(", ") || "—"}
            </span>
          </div>
        ))}
      </div>
    </button>
  )
}

/* ------------------------------- beat 7: draw demo ----------------------------- */

function DrawDemoPart({ state, dispatch }: PartProps) {
  const q = state.question
  if (!q) return null
  const drawn = state.pendingEdge
  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground">Draw an edge</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">{q.prompt}</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-3">
        <RewireSurface
          legalTargets={legalDrawTargets(state)}
          onRewire={(from, to) => dispatch({ type: "rewire", from, to })}
          label="Draw an edge by dragging from one node to another"
          className="flex w-full justify-center"
        >
          <GraphCanvas
            mode="draw"
            nodes={q.nodes}
            adj={state.workingAdj}
            layout={q.layout}
            pendingEdge={drawn}
          />
        </RewireSurface>
        <AdjacencyPanel
          nodes={q.nodes}
          adj={state.workingAdj}
          highlightNodes={drawn ? [drawn[0], drawn[1]] : undefined}
        />
      </div>

      <div className="mt-auto">
        <Button variant="tactile" size="lg" className="w-full" onClick={() => dispatch({ type: "continue" })}>
          Continue
        </Button>
      </div>
    </div>
  )
}

/* ----------------------------- beats 8 & 9: draws ----------------------------- */

function DrawPart({ state, dispatch }: PartProps) {
  const q = state.question
  if (!q) return null
  const { feedback, showWhy } = state
  const terminal = isTerminalGraphs(state)
  const correct = feedback === "correct"
  const drawn = state.pendingEdge

  const body = (
    <>
      <BinHeader state={state} transit={q.transit} />

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-3">
        <RewireSurface
          legalTargets={legalDrawTargets(state)}
          onRewire={(from, to) => dispatch({ type: "rewire", from, to })}
          label={
            q.transit
              ? "Add the missing line by dragging between two stations"
              : "Draw the missing edge by dragging between two nodes"
          }
          className="flex w-full justify-center"
        >
          <GraphCanvas
            mode="draw"
            nodes={q.nodes}
            adj={state.workingAdj}
            layout={q.layout}
            pendingEdge={drawn}
            missingEdge={q.missingEdge}
            transit={q.transit}
            terminal={terminal}
          />
        </RewireSurface>
        <AdjacencyPanel
          nodes={q.nodes}
          adj={q.adj}
          transit={q.transit}
          highlightNodes={correct && q.missingEdge ? [q.missingEdge[0], q.missingEdge[1]] : undefined}
        />
      </div>

      <FeedbackFooter
        feedback={feedback}
        selected={null}
        canCheck={canCheckGraphs(state)}
        showWhy={showWhy}
        hideFailHint
        copy={feedbackCopy(q)}
        dispatch={dispatch}
      />
    </>
  )

  if (q.transit) {
    return (
      <div className="flex flex-1 flex-col rounded-3xl border border-lilac-strong/30 bg-lilac-soft/15 px-3">
        {body}
      </div>
    )
  }
  return <div className="flex flex-1 flex-col">{body}</div>
}

/* ----------------------------- beat 10: redraw demo --------------------------- */

function RedrawDemoPart({ state, dispatch }: PartProps) {
  const q = state.question
  // Both layouts at once over the SAME data; "Show the data" reveals each
  // picture's (identical) adjacency to make "the data doesn't move" concrete.
  const [showData, setShowData] = useState(false)
  if (!q) return null

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7 text-center">
        <h2 className="text-xl font-bold text-foreground">Same graph, new layout</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">{q.prompt}</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-3">
        <SameGraphView
          before={{ nodes: q.nodes, adj: q.adj, layout: q.layout }}
          after={{ nodes: q.nodes, adj: q.adj, layout: q.layoutB ?? q.layout }}
          showData={showData}
        />
        <Button
          variant="soft"
          size="sm"
          aria-pressed={showData}
          onClick={() => setShowData((v) => !v)}
        >
          {showData ? "Hide the data" : "Show the data"}
        </Button>
        {!showData && <AdjacencyPanel nodes={q.nodes} adj={q.adj} />}
      </div>

      <div className="mt-auto">
        <Button variant="tactile" size="lg" className="w-full" onClick={() => dispatch({ type: "continue" })}>
          Continue
        </Button>
      </div>
    </div>
  )
}

/* --------------------------- beats 11 & 12: classify -------------------------- */

function ClassifyPart({ state, dispatch }: PartProps) {
  const q = state.question
  if (!q) return null
  const { feedback, selected, showWhy } = state
  const terminal = isTerminalGraphs(state)
  const isSame = q.kind === "same-graph"
  const reveal = feedback === "correct" || (feedback === "fail" && showWhy)

  return (
    <div className="flex flex-1 flex-col">
      <BinHeader state={state} />

      <div className="flex flex-col items-center gap-3 py-3">
        {isSame ? (
          <SameGraphView
            before={{ nodes: q.nodes, adj: q.adj, layout: q.layout }}
            after={{ nodes: q.nodes, adj: q.adjB ?? q.adj, layout: q.layoutB ?? q.layout }}
          />
        ) : (
          <GraphCanvas mode="display" nodes={q.nodes} adj={q.adj} layout={q.layout} />
        )}

        {isSame && reveal && (
          <div className="flex w-full flex-wrap justify-center gap-2">
            <AdjacencyPanel nodes={q.nodes} adj={q.adj} title="First — data" />
            <AdjacencyPanel nodes={q.nodes} adj={q.adjB ?? q.adj} title="Second — data" />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {q.options.map((opt, i) => (
          <AnswerCard
            key={opt.id}
            letter={String.fromCharCode(65 + i)}
            label={opt.label}
            state={optionState(feedback, selected, showWhy, opt.id, q.answer)}
            disabled={terminal}
            answerMarker={opt.id === q.answer}
            onSelect={() => dispatch({ type: "select", letter: opt.id })}
            className="flex-1"
          />
        ))}
      </div>

      <FeedbackFooter
        feedback={feedback}
        selected={selected}
        canCheck={canCheckGraphs(state)}
        showWhy={showWhy}
        hideFailHint
        copy={feedbackCopy(q)}
        dispatch={dispatch}
      />
    </div>
  )
}
