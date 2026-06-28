import { useState, type CSSProperties, type Dispatch } from "react"
import { Check, X } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AnswerCard, type AnswerState } from "@/components/willow/AnswerCard"
import { FeedbackFooter } from "@/components/willow/FeedbackFooter"
import { StatusChip } from "@/components/willow/StatusChip"
import { RewireSurface } from "@/components/rewire/RewireSurface"
import type { LessonAction, QuestionCopy } from "@/features/lesson/engine"
import {
  canCheckGraphs,
  currentBinLabel,
  currentPartGraphs,
  isTerminalGraphs,
  legalDrawTargets,
  legalTraceTargets,
  missingPlanEdges,
  neighbors,
  normalizeEdge,
  partQuotaGraphs,
  traceCurrent,
  tracePathEdges,
  type GraphOption,
  type GraphsQuestion,
  type GraphsState,
  type NodeId,
} from "@/features/lesson/graphsEngine"
import { StageSplit, StageCenter } from "@/components/willow/lesson/StageLayout"
import { FrameSequence } from "@/components/willow/lesson/FrameSequence"
import { AdjacencyPanel } from "./AdjacencyPanel"
import { GraphCanvas } from "./GraphCanvas"
import { SameGraphView } from "./SameGraphView"
import { SubwayMap, type SubwayVariant } from "./SubwayMap"
import {
  METRO_PLAN_LINES,
  TRANSIT_DRAW_LINES,
  TRANSIT_FULL_LINES,
  TRANSIT_LINES,
  type TransitLine,
} from "./transitData"
import { tintLines, useMetroSkin, type MetroSkin } from "./metroSkin"

/**
 * The Graphs stage. Routes the 14 beats: the drag-a-node + teach intros, the
 * multi-select reads, two active TRACES (walk the edges to the target), the
 * picture→list MCQ, two undirected single-edge draws (plain + a transit skin),
 * the build-the-line synthesis (draw the missing tracks toward the ghost plan),
 * the redraw demo, and two classify beats (same-graph, tree-or-not). The active
 * trace + build commit through their own taps/draws; the rest flow through the
 * shared FeedbackFooter. Nothing here grades.
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
    case "read-trace-far":
      return <TracePart state={state} dispatch={dispatch} />
    case "match-list":
      return <MatchListPart state={state} dispatch={dispatch} />
    case "draw-demo":
      return <DrawDemoPart state={state} dispatch={dispatch} />
    case "draw-edge":
    case "draw-transit":
      return <DrawPart state={state} dispatch={dispatch} />
    case "build-the-line":
      return <BuildLinePart state={state} dispatch={dispatch} />
    case "redraw-demo":
      return <RedrawDemoPart state={state} dispatch={dispatch} />
    case "same-graph":
    case "tree-or-not":
      return <ClassifyPart state={state} dispatch={dispatch} />
  }
}

type PartProps = { state: GraphsState; dispatch: Dispatch<LessonAction> }

/* --------------------------------- shared bits --------------------------------- */

/** The house teach/intro kicker: a small, wide-tracked lilac eyebrow. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-lilac-strong">
      {children}
    </p>
  )
}

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
      <h2 className="mx-auto mt-2 max-w-sm text-center text-xl font-bold text-foreground lg:text-2xl">
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
    <StageCenter>
      <div className="mt-7 text-center animate-fade-in">
        <Eyebrow>Graphs</Eyebrow>
        <h2 className="mt-2 text-xl font-bold text-foreground lg:text-2xl">The list is the data</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground lg:max-w-sm lg:text-base">{q.prompt}</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4">
        <GraphCanvas mode="demo" nodes={q.nodes} adj={q.adj} layout={q.layout} />
        <AdjacencyPanel nodes={q.nodes} adj={q.adj} />
      </div>

      <div className="mt-auto">
        <p className="mb-3 text-center text-sm text-muted-foreground">
          Drag a node anywhere. The connections (and the list) never change.
        </p>
        <Button variant="tactile" size="lg" className="w-full" onClick={() => dispatch({ type: "continue" })}>
          Continue
        </Button>
      </div>
    </StageCenter>
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
    <StageCenter>
      <div className="mt-7 text-center animate-fade-in">
        <Eyebrow>The one idea</Eyebrow>
        <h2 className="mt-2 text-xl font-bold text-foreground lg:text-2xl">A graph is not a tree</h2>
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
        <div className="mx-auto max-w-xs space-y-3 text-center text-sm text-muted-foreground">
          <p>
            The <span className="concept">adjacency list is the data</span>; the picture is just
            decoration. Every question reads from the list.
          </p>
          <p>
            A graph has{" "}
            <span className="concept" style={{ animationDelay: "500ms" }}>
              no root
            </span>{" "}
            and may have{" "}
            <span className="concept" style={{ animationDelay: "1000ms" }}>
              cycles
            </span>
            : that is how it differs from a tree. (Some connections only go one way, a later idea.)
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
    <StageCenter>
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
    </StageCenter>
  )
}

/* ------------------------------- beats 5 & 6: trace --------------------------- */

/**
 * The active trace reads (`read-path` near, `read-trace-far` far): the learner
 * walks the graph node to node from the start to the target. Only the current
 * node's neighbors are tappable (dashed lilac steps); the walked trail lights up,
 * the matching rows in the adjacency list light up as the walk progresses, and a
 * wrong tap is a brief nudge (no fail wall). Reaching the target grades the read
 * bin and plays a `FrameSequence` recap of the flow found. Reduced motion snaps.
 */
function TracePart({ state, dispatch }: PartProps) {
  const q = state.question
  const beat = state.trace
  const reduced = useReducedMotion() ?? false
  const [announce, setAnnounce] = useState("")
  if (!q || !beat || !q.pair) return null
  const { feedback } = state
  const solved = feedback === "correct"
  const target = q.pair[1]
  const current = traceCurrent(beat)
  const walked = tracePathEdges(beat)
  const tip = walked.length ? walked[walked.length - 1] : null
  const trail = walked.slice(0, -1)

  const onStep = solved
    ? undefined
    : (n: NodeId) => {
        const row = neighbors(q.adj, n)
        setAnnounce(`Stepped to ${n}. ${n} connects to ${row.length ? row.join(", ") : "nothing"}.`)
        dispatch({ type: "select", letter: n })
      }

  return (
    <StageCenter>
      <BinHeader state={state} />

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-3">
        {solved ? (
          <TraceReplay beat={beat} q={q} reduced={reduced} />
        ) : (
          <GraphCanvas
            mode="trace"
            nodes={q.nodes}
            adj={q.adj}
            layout={q.layout}
            currentNode={current}
            visitedNodes={beat.path}
            legalNext={[...legalTraceTargets(beat)]}
            targetNode={target}
            litEdges={trail}
            pendingEdge={tip}
            onStep={onStep}
            terminal={isTerminalGraphs(state)}
            reducedMotion={reduced}
          />
        )}
        <p className="text-sm font-medium text-foreground">
          {solved ? (
            <>
              Reached <span className="font-bold text-lilac-strong">{target}</span>.
            </>
          ) : (
            <>
              At <span className="font-bold text-lilac-strong">{current}</span>, heading to{" "}
              <span className="font-bold text-foreground">{target}</span>
            </>
          )}
        </p>
        <AdjacencyPanel nodes={q.nodes} adj={q.adj} highlightNodes={beat.path} />
        <p role="status" aria-live="polite" className="sr-only">
          {announce}
        </p>
      </div>

      <TraceFooter state={state} q={q} dispatch={dispatch} />
    </StageCenter>
  )
}

/**
 * The trace recap: a `FrameSequence` that replays the walked path hop by hop, each
 * edge drawing on, so the learner sees the flow they found. Frame `i` lights the
 * solid trail up to the i-th hop and draws the i-th edge on. Reduced motion snaps
 * to the full path.
 */
function TraceReplay({
  beat,
  q,
  reduced,
}: {
  beat: NonNullable<GraphsState["trace"]>
  q: GraphsQuestion
  reduced: boolean
}) {
  const edges = tracePathEdges(beat)
  const target = q.pair?.[1]
  const frames = beat.path.map((_, i) => i)
  return (
    <FrameSequence
      frames={frames}
      autoPlayMs={(i) => (i === 0 ? 600 : 640)}
      controls
      reduced={reduced}
    >
      {(i) => (
        <GraphCanvas
          mode="trace"
          nodes={q.nodes}
          adj={q.adj}
          layout={q.layout}
          currentNode={beat.path[i]}
          visitedNodes={beat.path.slice(0, i + 1)}
          targetNode={target}
          litEdges={edges.slice(0, Math.max(0, i - 1))}
          pendingEdge={i > 0 ? edges[i - 1] : null}
          terminal
          reducedMotion={reduced}
        />
      )}
    </FrameSequence>
  )
}

/** The trace footer: a quiet instruction while walking, a nudge on a wrong step,
 *  and the correction + Continue once the target is reached. No Check button. */
function TraceFooter({
  state,
  q,
  dispatch,
}: {
  state: GraphsState
  q: GraphsQuestion
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
          Tap a highlighted neighbor to step there. Each step, read that node's row for your options.
        </p>
      )}
    </div>
  )
}

/* ------------------------------ beat 7: match-list ----------------------------- */

function MatchListPart({ state, dispatch }: PartProps) {
  const q = state.question
  if (!q) return null
  const { feedback, selected, showWhy } = state
  const terminal = isTerminalGraphs(state)

  return (
    <StageSplit
      header={<BinHeader state={state} />}
      figure={
        <div className="flex justify-center py-3">
          <GraphCanvas mode="display" nodes={q.nodes} adj={q.adj} layout={q.layout} />
        </div>
      }
      interaction={
        <>
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
        </>
      }
    />
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
              {neighbors(option.adj ?? {}, n).join(", ") || "(none)"}
            </span>
          </div>
        ))}
      </div>
    </button>
  )
}

/* ------------------------------- beat 8: draw demo ----------------------------- */

function DrawDemoPart({ state, dispatch }: PartProps) {
  const q = state.question
  if (!q) return null
  const drawn = state.pendingEdge
  return (
    <StageCenter>
      <div className="mt-7 text-center animate-fade-in">
        <Eyebrow>Draw the edge</Eyebrow>
        <h2 className="mt-2 text-xl font-bold text-foreground lg:text-2xl">Drag to connect two nodes</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground lg:max-w-sm lg:text-base">{q.prompt}</p>
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
    </StageCenter>
  )
}

/* ----------------------------- beats 9 & 10: draws ---------------------------- */

function DrawPart({ state, dispatch }: PartProps) {
  const skin = useMetroSkin()
  const q = state.question
  if (!q) return null
  const { feedback, showWhy } = state
  const terminal = isTerminalGraphs(state)
  const correct = feedback === "correct"
  const drawn = state.pendingEdge

  // The transit draw beat takes over the whole stage as a station map poster.
  if (q.transit) {
    return (
      <StageCenter>
        <MetroScene
          eyebrow="Network planning"
          prompt={q.prompt}
          lines={TRANSIT_DRAW_LINES}
          ribbon
          status={{ label: terminal ? "In service" : "1 gap", ok: terminal }}
          footer={<MetroFeedbackFooter state={state} dispatch={dispatch} canCheck={canCheckGraphs(state)} />}
        >
          <RewireSurface
            legalTargets={legalDrawTargets(state)}
            onRewire={(from, to) => dispatch({ type: "rewire", from, to })}
            label="Add the missing line by dragging between two stations"
            className="flex w-full justify-center"
          >
            <SubwayMap
              mode="draw"
              fill
              nodes={q.nodes}
              adj={state.workingAdj}
              layout={q.layout}
              variant="diagrammatic"
              lines={tintLines(skin, TRANSIT_DRAW_LINES)}
              marker="node"
              labels="none"
              paper={skin.paper}
              backdrop={skin.backdrop}
              pendingEdge={drawn}
              missingEdge={q.missingEdge}
              terminal={terminal}
            />
          </RewireSurface>
          <AdjacencyPanel
            nodes={q.nodes}
            adj={q.adj}
            transit
            title={"Route list \u00b7 the plan"}
            highlightNodes={correct && q.missingEdge ? [q.missingEdge[0], q.missingEdge[1]] : undefined}
          />
        </MetroScene>
      </StageCenter>
    )
  }

  return (
    <StageCenter>
      <BinHeader state={state} />

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-3">
        <RewireSurface
          legalTargets={legalDrawTargets(state)}
          onRewire={(from, to) => dispatch({ type: "rewire", from, to })}
          label="Draw the missing edge by dragging between two nodes"
          className="flex w-full justify-center"
        >
          <GraphCanvas
            mode="draw"
            nodes={q.nodes}
            adj={state.workingAdj}
            layout={q.layout}
            pendingEdge={drawn}
            missingEdge={q.missingEdge}
            terminal={terminal}
          />
        </RewireSurface>
        <AdjacencyPanel
          nodes={q.nodes}
          adj={q.adj}
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
    </StageCenter>
  )
}

/* ----------------------------- beat 11: build the line ------------------------ */

/**
 * The build-the-line synthesis (`build-the-line`, the build bin): the learner draws
 * the missing tracks to grow the active colored network until it matches the
 * greyed-out PLAN ghost. Every plan station is a draw target (so a planned-but-
 * unbuilt station can be wired in); each laid track draws on in its line color over
 * the grey outline; an illegal track (not in the plan, or already running) is a
 * brief nudge with no fail wall; matching the plan grades the build bin. Keeps the
 * current metro skin. Reduced motion snaps.
 */
function BuildLinePart({ state, dispatch }: PartProps) {
  const skin = useMetroSkin()
  const q = state.question
  const beat = state.buildLine
  const reduced = useReducedMotion() ?? false
  if (!q || !beat) return null
  const terminal = isTerminalGraphs(state)
  const remainingEdges = missingPlanEdges(state.workingAdj, beat.planAdj)
  const remaining = remainingEdges.length
  const total = missingPlanEdges(q.shownAdj ?? {}, beat.planAdj).length
  const laid = total - remaining
  const drawn = state.pendingEdge

  return (
    <StageCenter>
      <MetroScene
        eyebrow={metroEyebrow(state)}
        prompt={q.prompt}
        lines={METRO_PLAN_LINES.slice(0, 3)}
        ribbon
        status={{
          label: terminal ? "Complete" : `${remaining} ${remaining === 1 ? "gap" : "gaps"}`,
          ok: terminal,
        }}
        footer={<MetroBuildFooter state={state} dispatch={dispatch} laid={laid} total={total} />}
      >
        <RewireSurface
          legalTargets={legalDrawTargets(state)}
          onRewire={(from, to) => dispatch({ type: "rewire", from, to })}
          label="Lay a missing track by dragging between two stations"
          className="flex w-full justify-center"
        >
          <SubwayMap
            mode="draw"
            fill
            nodes={q.nodes}
            adj={state.workingAdj}
            layout={q.layout}
            variant="diagrammatic"
            lines={tintLines(skin, METRO_PLAN_LINES)}
            ghost={{ nodes: q.nodes, adj: beat.planAdj, lines: METRO_PLAN_LINES }}
            marker="node"
            labels="none"
            paper={skin.paper}
            backdrop={skin.backdrop}
            pendingEdge={drawn}
            terminal={terminal}
            reducedMotion={reduced}
          />
        </RewireSurface>
        {/* The grey plan outline is visual; spell out the remaining tracks for a
            non-sighted learner so the build is reachable without the map. */}
        <p role="status" aria-live="polite" className="sr-only">
          {terminal
            ? "The live network now matches the plan."
            : `Tracks still to lay: ${remainingEdges.map(([u, v]) => `${u} to ${v}`).join(", ")}.`}
        </p>
      </MetroScene>
    </StageCenter>
  )
}

/** The build footer: a running "tracks laid" count while building, a nudge on an
 *  illegal track, and the correction + Continue once the plan is matched. The
 *  build commits by drawing, so there is no Check button. */
function MetroBuildFooter({
  state,
  dispatch,
  laid,
  total,
}: {
  state: GraphsState
  dispatch: Dispatch<LessonAction>
  laid: number
  total: number
}) {
  const skin = useMetroSkin()
  const q = state.question
  const { feedback } = state
  if (!q) return null
  return (
    <div className="mt-auto min-h-[128px] pt-2">
      {feedback === "correct" ? (
        <>
          <MetroChip tone="ok">{q.correct}</MetroChip>
          <MetroButton className="w-full" onClick={() => dispatch({ type: "next" })}>
            Continue
          </MetroButton>
        </>
      ) : (
        <>
          {feedback === "nudge" ? (
            <MetroChip tone="hint">{q.nudge}</MetroChip>
          ) : (
            <p className="mb-3 text-center text-sm" style={{ color: skin.sub }}>
              {q.hint}
            </p>
          )}
          <p className="text-center text-sm font-bold tabular-nums" style={{ color: skin.ink }}>
            {laid} / {total} tracks laid
          </p>
        </>
      )}
    </div>
  )
}

/* ----------------------------- beat 12: redraw demo --------------------------- */

function RedrawDemoPart({ state, dispatch }: PartProps) {
  const skin = useMetroSkin()
  const q = state.question
  // One map that MORPHS between the geographic and diagrammatic layouts over the
  // SAME network. The route list underneath stays byte-identical through the
  // morph, making "the drawing changed, the data did not" concrete.
  const [variant, setVariant] = useState<SubwayVariant>("geographic")
  const reduced = useReducedMotion() ?? false
  if (!q) return null
  const layout = variant === "geographic" ? q.layout : (q.layoutB ?? q.layout)
  const fullLines = tintLines(skin, TRANSIT_FULL_LINES)

  return (
    <StageCenter>
      <MetroScene
        eyebrow="Same network, two drawings"
        prompt={q.prompt}
        lines={TRANSIT_FULL_LINES}
        footer={
          <div className="mt-auto pt-2">
            <MetroButton className="w-full" onClick={() => dispatch({ type: "continue" })}>
              Continue
            </MetroButton>
          </div>
        }
      >
        <SubwayMap
          mode="display"
          fill
          nodes={q.nodes}
          adj={q.adj}
          layout={layout}
          variant={variant}
          lines={fullLines}
          marker="node"
          labels="none"
          paper={skin.paper}
          backdrop={skin.backdrop}
          reducedMotion={reduced}
        />
        <button
          type="button"
          aria-pressed={variant === "diagrammatic"}
          onClick={() => setVariant((v) => (v === "geographic" ? "diagrammatic" : "geographic"))}
          className="rounded-full px-4 py-2 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-lilac-strong/70"
          style={{ background: skin.btn2Bg, color: skin.btn2Ink, border: `1px solid ${skin.cardEdge}` }}
        >
          {variant === "geographic" ? "Straighten to diagram" : "Back to street map"}
        </button>
        <AdjacencyPanel nodes={q.nodes} adj={q.adj} transit />
      </MetroScene>
    </StageCenter>
  )
}

/* --------------------------- beats 13 & 14: classify -------------------------- */

function ClassifyPart({ state, dispatch }: PartProps) {
  const q = state.question
  const reduced = useReducedMotion() ?? false
  if (!q) return null
  const { feedback, selected, showWhy } = state
  const terminal = isTerminalGraphs(state)
  const reveal = feedback === "correct" || (feedback === "fail" && showWhy)

  // The same-graph beat is the subway "two drawings, one network" proof, so it
  // takes over the stage as a map poster. Tree-or-not stays the plain figure.
  if (q.kind === "same-graph") {
    return (
      <StageCenter>
        <MetroScene
          eyebrow={metroEyebrow(state)}
          prompt={q.prompt}
          footer={<MetroFeedbackFooter state={state} dispatch={dispatch} canCheck={canCheckGraphs(state)} />}
        >
          <SameGraphView
            before={{ nodes: q.nodes, adj: q.adj, layout: q.layout }}
            after={{ nodes: q.nodes, adj: q.adjB ?? q.adj, layout: q.layoutB ?? q.layout }}
            reducedMotion={reduced}
            revealLists={reveal}
          />
          <div className="flex w-full gap-3">
            {q.options.map((opt) => (
              <MetroOption
                key={opt.id}
                label={opt.label}
                state={optionState(feedback, selected, showWhy, opt.id, q.answer)}
                isAnswer={opt.id === q.answer}
                disabled={terminal}
                onSelect={() => dispatch({ type: "select", letter: opt.id })}
              />
            ))}
          </div>
        </MetroScene>
      </StageCenter>
    )
  }

  return (
    <StageSplit
      header={<BinHeader state={state} />}
      figure={
        <div className="flex flex-col items-center gap-3 py-3">
          <GraphCanvas mode="display" nodes={q.nodes} adj={q.adj} layout={q.layout} />
        </div>
      }
      interaction={
        <>
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
        </>
      }
    />
  )
}

/* --------------------------------- metro scene --------------------------------- */

/** The bin label + cumulative gate count, shown in the metro header. */
function metroEyebrow(state: GraphsState): string {
  const quota = partQuotaGraphs(state)
  const label = currentBinLabel(state)
  if (quota && label) return `${label} · ${quota.done} / ${quota.total} correct`
  return "Transit map"
}

/**
 * The full-bleed "transit map poster" surface: cancels the lesson's px-5/pb-6
 * padding to go edge-to-edge (the Linked Lists technique), then lays out a metro
 * header, the map, the line legend, and a themed footer. Honors reduced motion.
 */
/** The masthead status badge: a neutral zone tag, or a live "gap / in service". */
type MetroStatus = { label: string; ok?: boolean }

function MetroScene({
  eyebrow,
  prompt,
  lines = TRANSIT_LINES,
  ribbon,
  status,
  children,
  footer,
}: {
  eyebrow: string
  prompt?: string
  lines?: TransitLine[]
  /** Show the three-color line ribbon under the masthead. */
  ribbon?: boolean
  /** The masthead badge (defaults to "Zone 1"). */
  status?: MetroStatus
  children: React.ReactNode
  footer: React.ReactNode
}) {
  const skin = useMetroSkin()
  const reduced = useReducedMotion() ?? false
  const tinted = tintLines(skin, lines)
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
      className="-mx-5 -mb-6 flex flex-1 flex-col px-5 pb-6 pt-6"
      style={{ background: skin.sceneBg }}
    >
      <MetroHeader
        skin={skin}
        eyebrow={eyebrow}
        prompt={prompt}
        status={status}
        ribbon={ribbon ? tinted : undefined}
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">{children}</div>
      <MetroLegend skin={skin} lines={tinted} />
      {footer}
    </motion.div>
  )
}

function MetroHeader({
  skin,
  eyebrow,
  prompt,
  status,
  ribbon,
}: {
  skin: MetroSkin
  eyebrow: string
  prompt?: string
  status?: MetroStatus
  ribbon?: TransitLine[]
}) {
  const badge = status ?? { label: "Zone 1" }
  const badgeStyle: CSSProperties = badge.ok
    ? { background: "#1f9d57", color: "#ffffff" }
    : { background: skin.badgeBg, color: skin.badgeInk }
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <MetroRoundel skin={skin} />
          <div className="leading-tight">
            <p className="text-[15px] font-extrabold tracking-tight" style={{ color: skin.ink }}>
              {skin.title}
            </p>
            <p className="text-[11px] font-medium" style={{ color: skin.sub }}>
              {eyebrow}
            </p>
          </div>
        </div>
        <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={badgeStyle}>
          {badge.label}
        </span>
      </div>
      {ribbon && <LineRibbon lines={ribbon} />}
      {prompt && (
        <p className="mt-3 text-[15px] font-semibold leading-snug" style={{ color: skin.ink }}>
          {prompt}
        </p>
      )}
    </div>
  )
}

/** A three-color line ribbon from the network's own routes: one masthead rule. */
function LineRibbon({ lines }: { lines: TransitLine[] }) {
  return (
    <div className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full">
      {lines.map((l, i) => (
        <span key={l.id} style={{ flex: i === 0 ? 3 : 2, background: l.color }} />
      ))}
    </div>
  )
}

/** A transit roundel stamp in the style of a real metro mark: a colored ring with
 *  a horizontal bar through it, here using the map's own two route colors. */
function MetroRoundel({ skin }: { skin: MetroSkin }) {
  const ring = skin.tint(TRANSIT_LINES[0]?.color ?? "#ef5350")
  const bar = skin.tint(TRANSIT_LINES[1]?.color ?? "#1aa7e0")
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
      <circle cx="15" cy="15" r="10.5" fill={skin.paper} stroke={ring} strokeWidth="4" />
      <rect x="1" y="12" width="28" height="6" rx="1.5" fill={bar} />
    </svg>
  )
}

function MetroLegend({ skin, lines = TRANSIT_LINES }: { skin: MetroSkin; lines?: TransitLine[] }) {
  return (
    <div
      className="mx-auto mt-2 flex w-fit max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-1.5 rounded-xl px-3.5 py-2"
      style={{ background: skin.legendBg, border: `1px solid ${skin.cardEdge}` }}
      aria-hidden
    >
      {lines.map((l) => (
        <span key={l.id} className="flex items-center gap-2 text-[11px] font-bold" style={{ color: skin.ink }}>
          <span className="h-2.5 w-7 rounded-full" style={{ background: l.color }} />
          {l.name}
        </span>
      ))}
      <span className="flex items-center gap-2 text-[11px] font-bold" style={{ color: skin.ink }}>
        <span
          className="h-[18px] w-3 rounded-full"
          style={{ background: "#ffffff", border: `3px solid ${skin.ink}` }}
        />
        Transfer station
      </span>
    </div>
  )
}

function MetroButton({
  children,
  onClick,
  disabled,
  className,
  tone = "primary",
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  className?: string
  tone?: "primary" | "secondary"
}) {
  const skin = useMetroSkin()
  const style: CSSProperties =
    tone === "primary"
      ? { background: skin.btnBg, color: skin.btnInk }
      : { background: skin.btn2Bg, color: skin.btn2Ink, border: `1px solid ${skin.cardEdge}` }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full py-3.5 text-center text-[15px] font-bold outline-none transition-transform active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-lilac-strong/70 disabled:opacity-40",
        className,
      )}
      style={style}
    >
      {children}
    </button>
  )
}

function MetroChip({ tone, children }: { tone: "ok" | "bad" | "hint"; children: React.ReactNode }) {
  const skin = useMetroSkin()
  const ok = skin.id === "night" ? "#34d399" : "#1f9d57"
  const bad = skin.id === "night" ? "#ff6b6b" : "#d4493a"
  const color = tone === "ok" ? ok : tone === "bad" ? bad : skin.sub
  return (
    <div className="mb-3 flex flex-col items-center gap-1.5 text-center">
      <span
        className="flex size-6 items-center justify-center rounded-full text-white"
        style={{ background: color }}
        aria-hidden
      >
        {tone === "ok" ? (
          <Check className="size-3.5" strokeWidth={3} />
        ) : tone === "bad" ? (
          <X className="size-3.5" strokeWidth={3} />
        ) : (
          <span className="size-1.5 rounded-full bg-white" />
        )}
      </span>
      <p role="status" aria-live="polite" className="text-sm" style={{ color: skin.ink }}>
        {children}
      </p>
    </div>
  )
}

/** A themed clone of FeedbackFooter for the metro surface; same dispatched actions. */
function MetroFeedbackFooter({
  state,
  dispatch,
  canCheck,
}: {
  state: GraphsState
  dispatch: Dispatch<LessonAction>
  canCheck: boolean
}) {
  const skin = useMetroSkin()
  const q = state.question
  const { feedback, showWhy } = state
  if (!q) return null
  return (
    <div className="mt-auto min-h-[128px] pt-2">
      {feedback === "idle" && (
        <>
          <p className="mb-3 text-center text-sm" style={{ color: skin.sub }}>
            {q.hint}
          </p>
          <MetroButton className="w-full" disabled={!canCheck} onClick={() => dispatch({ type: "check" })}>
            Check
          </MetroButton>
        </>
      )}
      {feedback === "nudge" && (
        <>
          <MetroChip tone="hint">{q.nudge}</MetroChip>
          <MetroButton className="w-full" disabled={!canCheck} onClick={() => dispatch({ type: "check" })}>
            Check
          </MetroButton>
        </>
      )}
      {feedback === "correct" && (
        <>
          <MetroChip tone="ok">{q.correct}</MetroChip>
          <MetroButton className="w-full" onClick={() => dispatch({ type: "next" })}>
            Continue
          </MetroButton>
        </>
      )}
      {feedback === "fail" && (
        <>
          <MetroChip tone="bad">
            {showWhy ? q.why : "Not quite. Tap Why for the answer, or reattempt."}
          </MetroChip>
          <div className="flex gap-3">
            <MetroButton tone="secondary" className="flex-1" disabled={showWhy} onClick={() => dispatch({ type: "reveal" })}>
              Why?
            </MetroButton>
            <MetroButton className="flex-1" onClick={() => dispatch({ type: "reattempt" })}>
              Reattempt
            </MetroButton>
          </div>
        </>
      )}
    </div>
  )
}

function metroOption(skin: MetroSkin): Record<AnswerState, CSSProperties> {
  if (skin.id === "night") {
    return {
      default: { background: "#101a30", borderColor: "#26324f", color: "#e7ecf5" },
      selected: { background: "#211d3a", borderColor: "#b4a7e7", color: "#cfc6f2" },
      correct: { background: "#10241a", borderColor: "#34d399", color: "#a7f3d0" },
      nudge: { background: "#2a2310", borderColor: "#fbbf24", color: "#fde68a" },
      fail: { background: "#2a1416", borderColor: "#ff6b6b", color: "#fecaca" },
    }
  }
  return {
    default: { background: "#ffffff", borderColor: skin.cardEdge, color: skin.ink },
    selected: { background: "#eef0fb", borderColor: "#8b7fd6", color: "#8b7fd6" },
    correct: { background: "#e7f5ec", borderColor: "#1f9d57", color: "#15683b" },
    nudge: { background: "#fdf3e0", borderColor: "#d8a23a", color: "#855612" },
    fail: { background: "#fbe9e7", borderColor: "#d4493a", color: "#9a2c21" },
  }
}

/** Themed same/different option, carrying the e2e data-answer hook byte-for-byte. */
function MetroOption({
  label,
  state,
  isAnswer,
  disabled,
  onSelect,
}: {
  label: string
  state: AnswerState
  isAnswer: boolean
  disabled?: boolean
  onSelect: () => void
}) {
  const skin = useMetroSkin()
  return (
    <button
      type="button"
      data-testid="answer-card"
      data-answer={isAnswer && import.meta.env.DEV ? "1" : undefined}
      aria-pressed={state === "selected"}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3.5 text-center text-sm font-bold outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-lilac-strong/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled && state === "default" && "cursor-default",
      )}
      style={metroOption(skin)[state]}
    >
      {state === "correct" && <Check className="size-4" strokeWidth={3} aria-hidden />}
      {state === "fail" && <X className="size-4" strokeWidth={3} aria-hidden />}
      {label}
    </button>
  )
}
