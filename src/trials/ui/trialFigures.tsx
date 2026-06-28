import { useEffect, useMemo, useState } from "react"
import { motion } from "motion/react"

import { FrameSequence } from "@/components/willow/lesson/FrameSequence"
import { shiftFrames } from "@/features/lesson/arraysEngine"
import type { Cell } from "@/features/lesson/stacksQueuesEngine"
import { NIL, pointerId } from "@/features/lesson/linkedListsEngine"
import type { StructureKind, Verdict } from "@/features/trials/types"
import { ArrayStrip } from "@/lessons/arrays/ArrayStrip"
import { NodeGraph } from "@/lessons/linkedLists/NodeGraph"
import { QueueTube } from "@/lessons/stacksQueues/QueueTube"
import { StackBin } from "@/lessons/stacksQueues/StackBin"

/**
 * Trial figures: thin adapters that drive the lesson's real animation primitives
 * from trial state instead of from a lesson engine, so the Client Scene and the
 * Stress Test reuse the same visual language the rest of the app teaches with.
 *
 *  - queue        -> {@link QueueTube}  (cells enter at the back, leave the front)
 *  - stack        -> {@link StackBin}   (cells drop in / lift off the top)
 *  - array        -> {@link ArrayStrip} (read for the calm view, ripple for shifts)
 *  - linked list  -> {@link NodeGraph}  (replay mode: a static chain that relinks)
 *
 * Two surfaces:
 *  - {@link StructureFigure}: a calm, representative render of the chosen structure
 *    (the Client Scene). It never animates a consequence, so it can't leak a
 *    verdict before the learner runs the stress test.
 *  - {@link ConsequenceFigure}: the post-Run animation. Driven by structure +
 *    segment, it plays the structure's natural behavior for that segment's
 *    signature operation, and falls back to a "blocked" shake whenever the design
 *    broke. Mounted only in the verdict phase, so it can only run after commitment.
 *
 * Every path is reduced-motion aware: the primitives honor it themselves, and the
 * timed transitions here start at their end-state (no timers) when `reduce` is set.
 */

// A short, representative line/pile. Index 0 is the front (queue) / head (list) /
// first slot (array) / top (stack). Kept small so the figures fit a phone without
// the fixed-width tube/bin overflowing.
const LINE_LABELS = ["A", "B", "C", "D"] as const
const ARRAY_LABELS = ["A", "B", "C", "D", "E"] as const
const STACK_LABELS = ["C", "B", "A"] as const // top -> floor (C is newest)

function toCells(labels: readonly string[]): Cell[] {
  return labels.map((label) => ({ id: label, label }))
}

/** The forward-pointer map for a clean head -> ... -> ∅ chain (NodeGraph replay). */
function chainNext(nodes: readonly string[]): Record<string, string> {
  const next: Record<string, string> = {}
  nodes.forEach((node, i) => {
    next[pointerId(node)] = nodes[i + 1] ?? NIL
  })
  return next
}

/** Re-point the removed node's left neighbor past it (the "neighbors reconnect"). */
function relinkNext(nodes: readonly string[], removeIndex: number): Record<string, string> {
  const next = chainNext(nodes)
  if (removeIndex > 0) {
    const prev = nodes[removeIndex - 1]
    next[pointerId(prev)] = nodes[removeIndex + 1] ?? NIL
  }
  return next
}

/* ------------------------------- static figure ------------------------------ */

/**
 * The calm, representative render of the chosen structure for the Client Scene.
 * Read-only: it shows what the structure looks like, never a consequence.
 */
export function StructureFigure({
  structure,
  reduce,
}: {
  structure: StructureKind
  reduce: boolean
}) {
  return (
    <div className="flex w-full justify-center">
      {structure === "queue" && <QueueTube cells={toCells(LINE_LABELS)} showEnds />}
      {structure === "stack" && <StackBin cells={toCells(STACK_LABELS)} showEnds />}
      {structure === "array" && (
        <ArrayStrip mode="read" cells={[...ARRAY_LABELS]} />
      )}
      {structure === "linked-list" && (
        <NodeGraph
          mode="replay"
          nodes={[...LINE_LABELS]}
          workingNext={chainNext(LINE_LABELS)}
          reducedMotion={reduce}
        />
      )}
    </div>
  )
}

/* ----------------------------- consequence figure --------------------------- */

/**
 * The post-Run animation. Broken always plays a blocked shake (the operation
 * fails); otherwise the structure performs the segment's signature operation.
 */
export function ConsequenceFigure({
  structure,
  segmentId,
  status,
  reduce,
}: {
  structure: StructureKind | null
  segmentId: string
  status: Verdict
  reduce: boolean
}) {
  if (structure == null) return null

  if (status === "broken") {
    return <BlockedFigure structure={structure} reduce={reduce} />
  }

  return (
    <div className="flex w-full justify-center">
      {structure === "queue" && <QueueServe reduce={reduce} />}
      {structure === "stack" && <StackPop reduce={reduce} />}
      {structure === "array" && <ArrayShift segmentId={segmentId} reduce={reduce} />}
      {structure === "linked-list" && (
        <ListRelink segmentId={segmentId} reduce={reduce} />
      )}
    </div>
  )
}

/** A2/A3 broken: the structure can't do it. Shake the calm figure once. */
function BlockedFigure({
  structure,
  reduce,
}: {
  structure: StructureKind
  reduce: boolean
}) {
  return (
    <motion.div
      className="flex w-full justify-center"
      animate={reduce ? undefined : { x: [0, -7, 7, -6, 6, -3, 3, 0] }}
      transition={
        reduce ? undefined : { duration: 0.55, delay: 0.15, ease: "easeInOut" }
      }
    >
      <StructureFigure structure={structure} reduce={reduce} />
    </motion.div>
  )
}

/** A1 viable: serve the front of the line (the head cell leaves out the front). */
function QueueServe({ reduce }: { reduce: boolean }) {
  const full = useMemo(() => toCells(LINE_LABELS), [])
  const served = useMemo(() => full.slice(1), [full])
  const [cells, setCells] = useState<Cell[]>(reduce ? served : full)

  useEffect(() => {
    if (reduce) return
    const t = setTimeout(() => setCells(served), 520)
    return () => clearTimeout(t)
  }, [reduce, served])

  return <QueueTube cells={cells} showEnds />
}

/** A3 viable: undo lifts the most recent action straight off the top. */
function StackPop({ reduce }: { reduce: boolean }) {
  const full = useMemo(() => toCells(STACK_LABELS), [])
  const popped = useMemo(() => full.slice(1), [full])
  const [cells, setCells] = useState<Cell[]>(reduce ? popped : full)

  useEffect(() => {
    if (reduce) return
    const t = setTimeout(() => setCells(popped), 520)
    return () => clearTimeout(t)
  }, [reduce, popped])

  return <StackBin cells={cells} showEnds />
}

/** A1/A2 array: removing a cell ripples the tail left to close the gap. */
function ArrayShift({ segmentId, reduce }: { segmentId: string; reduce: boolean }) {
  // a1 serves the front (index 0); a2 pulls a mid-line cell (index 2).
  const index = segmentId === "a2-cancellation" ? 2 : 0
  const frames = useMemo(
    () => shiftFrames([...ARRAY_LABELS], { kind: "delete", index }),
    [index],
  )
  const finalCaption = frames[frames.length - 1]?.caption

  return (
    <FrameSequence frames={frames} autoPlayMs={150} reduced={reduce}>
      {(frame) => (
        <ArrayStrip
          mode="ripple"
          frame={frame}
          opIndex={index}
          caption={finalCaption}
        />
      )}
    </FrameSequence>
  )
}

/** A1/A2 linked list: the node leaves and its neighbors reconnect around the gap. */
function ListRelink({ segmentId, reduce }: { segmentId: string; reduce: boolean }) {
  const nodes = useMemo(() => [...LINE_LABELS], [])
  // a1 serves the head (index 0); a2 removes a clear middle node (index 2).
  const removeIndex = segmentId === "a1-intake" ? 0 : 2
  const removed = nodes[removeIndex]
  const after = useMemo(() => relinkNext(nodes, removeIndex), [nodes, removeIndex])
  const before = useMemo(() => chainNext(nodes), [nodes])

  const [done, setDone] = useState(reduce)
  useEffect(() => {
    if (reduce) return
    const t = setTimeout(() => setDone(true), 560)
    return () => clearTimeout(t)
  }, [reduce])

  return (
    <NodeGraph
      mode="replay"
      nodes={nodes}
      workingNext={done ? after : before}
      orphaned={done ? [removed] : []}
      reducedMotion={reduce}
    />
  )
}
