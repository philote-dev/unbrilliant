import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { RewireContext } from "@/components/rewire/RewireContext"
import { useRewireNode } from "@/components/rewire/useRewireNode"
import { NIL, pointerId, sourceNode, type RewirePair } from "@/features/lesson/linkedListsEngine"
import {
  GAP_X,
  HEAD_HALF,
  HEAD_LEN,
  LOOSE_GAP,
  MARGIN_X,
  NODE_H,
  NODE_R,
  NODE_W,
  ROW_Y,
  arrowGeom,
  boxesExtent,
  center,
  columnBoxes,
  directArrow,
  looseBox,
  radius,
  rowBoxes,
  wrapBoxes,
  type Box,
  type Pt,
} from "./graphLayout"

type Mode = "rewire" | "walk" | "demo" | "replay"
export type ChainLayout = "row" | "column" | "wrap"

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
/** Length of the "lifted" stub drawn when an arrow is grabbed but not yet aimed. */
const STUB_LEN = 30
/** Per-hop delay (ms) for the sequential traverse fill: felt as a walk, not a jump. */
const HOP_FILL_MS = 60

/**
 * The literal-arrow figure, in three modes:
 *  - **demo**: drag a node anywhere inside a roomy, device-sized play area —
 *    arrows re-route, the list is unchanged (position is meaningless; the arrow
 *    is identity). Nodes are clamped to the area so they can't be lost.
 *  - **walk**: tap the next node to walk from the head — each hop lights up; the
 *    hop count is the cost (no jumping).
 *  - **rewire**: grab a node's arrow and drag it onto another node. It detaches
 *    on grab, stretches to the cursor, and snaps onto a glowing legal node. Doing
 *    the writes in the unsafe order orphans the tail (it floats away, greys out,
 *    and can't be grabbed). Rides on <RewireSurface> for drag/tap/keyboard/SR.
 *  - **replay**: a read-only render of a pointer map (`workingNext` + `orphaned`),
 *    used by the FrameSequence reveals to animate the save-first writes and the
 *    tail orphaning. No <RewireSurface>, no interaction.
 *
 * Nodes are circles; every arrow is anchored on the rim along its travel
 * direction and the shaft meets the arrowhead flush (one continuous stroke).
 */
export function NodeGraph({
  mode,
  nodes,
  newNode,
  prev,
  at,
  workingNext,
  orphaned,
  rewires,
  cursor = 0,
  cursorTone = "active",
  answerIndex,
  frontier,
  onTapNode,
  reducedMotion,
  layout = "row",
  spotlight = false,
}: {
  mode: Mode
  nodes: string[]
  newNode?: string | null
  prev?: string | null
  at?: string | null
  workingNext?: Record<string, string>
  orphaned?: string[]
  rewires?: RewirePair[]
  cursor?: number
  /** Colour of the walked path's end node: selecting (active), right, or wrong. */
  cursorTone?: NodeTone
  /** Index of the correct node (walk) — stamps a dev-only answer hook for the tracer. */
  answerIndex?: number
  /** Forced walk: the ONLY tappable node index (the next hop). Others are inert. */
  frontier?: number
  onTapNode?: (index: number) => void
  reducedMotion?: boolean
  /** How the chain is laid out: a row (default), a vertical column, or wrapped. */
  layout?: ChainLayout
  /** Walk mode: highlight only the `cursor` node (no lit path), mirroring a single
   * highlighted array cell for the insert contrast, not a traversal. */
  spotlight?: boolean
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false

  if (mode === "demo") return <DemoGraph nodes={nodes} reduced={reduced} />

  if (mode === "walk" && layout !== "row") {
    return (
      <LayoutWalkGraph
        nodes={nodes}
        cursor={cursor}
        cursorTone={cursorTone}
        answerIndex={answerIndex}
        frontier={frontier}
        onTapNode={onTapNode}
        layout={layout}
        spotlight={spotlight}
        reduced={reduced}
      />
    )
  }

  return (
    <StructuredGraph
      mode={mode === "replay" ? "replay" : mode}
      nodes={nodes}
      newNode={newNode}
      prev={prev}
      at={at}
      workingNext={workingNext}
      orphaned={orphaned}
      rewires={rewires}
      cursor={cursor}
      cursorTone={cursorTone}
      answerIndex={answerIndex}
      onTapNode={onTapNode}
      reduced={reduced}
    />
  )
}

type NodeTone = "active" | "correct" | "wrong"

/* ------------------------------ demo (free play) ------------------------------ */

/**
 * A roomy, responsive play surface: the figure fills its container and the nodes
 * are positioned by *fraction* of the area, so it adapts to any device and a
 * dragged node is clamped inside the panel instead of vanishing into the page.
 */
function DemoGraph({ nodes, reduced }: { nodes: string[]; reduced: boolean }) {
  const areaRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 320, h: 300 })
  const [frac, setFrac] = useState<Record<string, Pt>>({})
  const dragRef = useRef<{ id: string; ptr: number } | null>(null)

  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure)
      ro.observe(el)
    } else {
      window.addEventListener("resize", measure)
    }
    return () => {
      ro?.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [])

  const chain = [...nodes, NIL]
  const pad = NODE_R + 12
  const innerW = Math.max(1, size.w - pad * 2)
  const innerH = Math.max(1, size.h - pad * 2)

  const fracFor = (id: string, i: number): Pt =>
    frac[id] ?? {
      x: chain.length > 1 ? i / (chain.length - 1) : 0.5,
      y: clamp01(0.5 + 0.22 * Math.sin(i * 1.7)),
    }

  const boxFor = (id: string, i: number): Box => {
    const f = fracFor(id, i)
    return { x: pad + f.x * innerW - NODE_R, y: pad + f.y * innerH - NODE_R, w: NODE_W, h: NODE_H }
  }

  const boxes = new Map<string, Box>()
  chain.forEach((id, i) => boxes.set(id, boxFor(id, i)))

  function startDrag(id: string, e: React.PointerEvent) {
    e.preventDefault()
    const ptr = e.pointerId
    dragRef.current = { id, ptr }
    try {
      e.currentTarget.setPointerCapture?.(ptr)
    } catch {
      // jsdom / unsupported — window listeners cover the gesture.
    }
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d || ev.pointerId !== d.ptr) return
      const rect = areaRef.current?.getBoundingClientRect()
      if (!rect) return
      setFrac((p) => ({
        ...p,
        [d.id]: {
          x: clamp01((ev.clientX - rect.left - pad) / innerW),
          y: clamp01((ev.clientY - rect.top - pad) / innerH),
        },
      }))
    }
    const stop = (ev: PointerEvent) => {
      if (dragRef.current && ev.pointerId !== dragRef.current.ptr) return
      dragRef.current = null
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", stop)
    window.addEventListener("pointercancel", stop)
  }

  return (
    <div
      ref={areaRef}
      data-testid="node-graph"
      data-reduced-motion={reduced ? "1" : undefined}
      className="relative w-full flex-1 self-stretch overflow-hidden rounded-3xl border border-border/60 bg-card/30 min-h-[280px]"
    >
      <svg className="pointer-events-none absolute inset-0" width={size.w} height={size.h} aria-hidden>
        {chain.slice(0, -1).map((id, i) => (
          <Arrow key={id} geom={directArrow(boxes.get(id)!, boxes.get(chain[i + 1])!)} />
        ))}
      </svg>

      {chain.map((id) => {
        const box = boxes.get(id)!
        if (id === NIL) return <NilNode key={id} box={box} />
        return (
          <button
            key={id}
            type="button"
            aria-label={`node ${id}, drag to move`}
            onPointerDown={(e) => startDrag(id, e)}
            className={cn(
              "absolute flex touch-none cursor-grab items-center justify-center rounded-full border-2 border-border bg-card",
              "text-base font-bold text-foreground shadow-sm outline-none active:cursor-grabbing",
              "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
          >
            {id}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------------- column / wrap (mobile-friendly walk) --------------- */

/**
 * Walk-mode chains in a vertical column or a wrapped snake, so a long
 * "head → … → ∅" line fits a phone instead of shrinking. Consecutive nodes are
 * always physical neighbours (down the column, or along/over the snake), so a
 * plain edge-to-edge arrow connects each pair. Read-only or tap-to-select.
 */
function LayoutWalkGraph({
  nodes,
  cursor,
  cursorTone,
  answerIndex,
  frontier,
  onTapNode,
  layout,
  spotlight = false,
  reduced = false,
}: {
  nodes: string[]
  cursor: number
  cursorTone: NodeTone
  answerIndex?: number
  /** Forced walk: the ONLY tappable node index (the next hop). */
  frontier?: number
  onTapNode?: (index: number) => void
  layout: "column" | "wrap"
  /** Highlight only the `cursor` node, with no lit path (insert contrast). */
  spotlight?: boolean
  reduced?: boolean
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 320, h: 360 })

  useLayoutEffect(() => {
    const el = outerRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure)
      ro.observe(el)
    } else {
      window.addEventListener("resize", measure)
    }
    return () => {
      ro?.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [])

  const chain = [...nodes, NIL]
  const perRow =
    layout === "wrap"
      ? Math.max(2, Math.min(chain.length, Math.floor((size.w - 2 * MARGIN_X) / (NODE_W + GAP_X))))
      : 1
  const boxes = layout === "column" ? columnBoxes(chain) : wrapBoxes(chain, perRow)
  const { width: figW, height: figH } = boxesExtent(boxes.values())
  // Wrap fits the width (nodes stay full-size, height is natural); a column also
  // fits the available height so a long list doesn't overflow.
  const scale =
    layout === "column"
      ? Math.min(1, size.w / figW, size.h / figH)
      : Math.min(1, size.w / figW)

  return (
    <div ref={outerRef} className="flex w-full flex-1 items-center justify-center overflow-hidden">
      <div className="relative" style={{ width: figW * scale, height: figH * scale }}>
        <div
          data-testid="node-graph"
          className="absolute left-0 top-0"
          style={{ width: figW, height: figH, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          <svg className="pointer-events-none absolute inset-0" width={figW} height={figH} aria-hidden>
            {chain.slice(0, -1).map((node, i) => {
              const lit = !spotlight && i < cursor
              return (
                <Arrow
                  key={node}
                  geom={directArrow(boxes.get(node)!, boxes.get(chain[i + 1])!)}
                  className={cn("transition-colors", lit ? "text-lilac-strong" : "text-faint")}
                  // Stagger each hop's fill so the walk reads left-to-right instead
                  // of lighting all at once (CSS transition; the reduced-motion
                  // reset zeroes the duration, so it snaps).
                  style={reduced || !lit ? undefined : { transitionDelay: `${i * HOP_FILL_MS}ms` }}
                />
              )
            })}
          </svg>

          {nodes.map((node, i) => {
            // Forced walk: only the frontier (next hop) is tappable; if no
            // frontier is given, every node is tappable (legacy behaviour).
            const gated = onTapNode != null && (frontier == null || i === frontier)
            return (
              <Positioned key={node} box={boxes.get(node)!}>
                <ChainNode
                  node={node}
                  visited={spotlight ? true : i <= cursor}
                  isCurrent={i === cursor}
                  isNext={spotlight ? false : frontier != null ? i === frontier : i === cursor + 1}
                  clickable={gated}
                  tone={cursorTone}
                  isAnswer={answerIndex === i}
                  onTap={gated ? () => onTapNode!(i) : undefined}
                />
              </Positioned>
            )
          })}

          <Positioned box={boxes.get(NIL)!}>
            <span className="flex size-full items-center justify-center rounded-full border-2 border-dashed border-border/60 font-mono text-base text-muted-foreground">
              {NIL}
            </span>
          </Positioned>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------- structured (row) ------------------------------ */

function StructuredGraph({
  mode,
  nodes,
  newNode,
  prev,
  at,
  workingNext,
  orphaned,
  rewires,
  cursor,
  cursorTone,
  answerIndex,
  onTapNode,
  reduced,
}: {
  mode: "rewire" | "walk" | "replay"
  nodes: string[]
  newNode?: string | null
  prev?: string | null
  at?: string | null
  workingNext?: Record<string, string>
  orphaned?: string[]
  rewires?: RewirePair[]
  cursor: number
  cursorTone: NodeTone
  answerIndex?: number
  onTapNode?: (index: number) => void
  reduced: boolean
}) {
  const ctx = useContext(RewireContext)
  const armedSource = mode === "rewire" ? ctx?.armedSource ?? null : null
  const hoveredTarget = mode === "rewire" ? ctx?.hoveredTarget ?? null : null
  // Both rewire and the read-only replay draw arrows live from the pointer map.
  const fromWorking = mode === "rewire" || mode === "replay"

  const outerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [liveCursor, setLiveCursor] = useState<Pt | null>(null)
  const [scale, setScale] = useState(1)
  const scaleRef = useRef(1)
  scaleRef.current = scale

  const n = nodes.length
  const boxes = new Map<string, Box>(rowBoxes(nodes))
  const nilBox: Box = { x: MARGIN_X + n * (NODE_W + GAP_X), y: ROW_Y, w: NODE_W, h: NODE_H }
  boxes.set(NIL, nilBox)
  // The loose new node ("X") is positioned for BOTH the interactive rewire and the
  // read-only replay: the insert post-correct replay and the predict break reveal
  // run in `replay` mode and draw X's arrows + node, so its box must exist there too.
  if ((mode === "rewire" || mode === "replay") && newNode) {
    const pb = prev ? boxes.get(prev) : undefined
    const ab = at ? boxes.get(at) : undefined
    const looseCenter = pb && ab ? (center(pb).x + center(ab).x) / 2 : nilBox.x
    boxes.set(newNode, looseBox(looseCenter))
  }

  const width = nilBox.x + NODE_W + MARGIN_X
  const height = ROW_Y + NODE_H + LOOSE_GAP + NODE_H + ROW_Y

  const orphanSet = new Set(orphaned ?? [])
  const live = workingNext ?? {}

  // Scale the fixed-px figure down to fit its container (phones are ~300px wide).
  useLayoutEffect(() => {
    const el = outerRef.current
    if (!el) return
    const measure = () => {
      const avail = el.clientWidth
      setScale(avail > 0 ? Math.min(1, avail / width) : 1)
    }
    measure()
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure)
      ro.observe(el)
    } else {
      window.addEventListener("resize", measure)
    }
    return () => {
      ro?.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [width])

  // Rewire: while a pointer is armed, track the cursor in intrinsic coords so the
  // live arrow stretches to the fingertip (keyboard/tap fall back to the hover).
  useEffect(() => {
    if (!armedSource) {
      setLiveCursor(null)
      return
    }
    const onMove = (e: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const s = scaleRef.current || 1
      setLiveCursor({ x: (e.clientX - rect.left) / s, y: (e.clientY - rect.top) / s })
    }
    window.addEventListener("pointermove", onMove)
    return () => window.removeEventListener("pointermove", onMove)
  }, [armedSource])

  const arrows: { key: string; from: Box; to: Box; tone: "muted" | "active" | "faint" }[] = []
  if (fromWorking) {
    for (const node of [...nodes, ...(newNode ? [newNode] : [])]) {
      const target = live[pointerId(node)]
      // Guard the SOURCE box the same way the target is guarded: a node with no box
      // (e.g. a loose node not positioned for this mode) can never draw an arrow.
      if (!boxes.has(node)) continue
      if (!target || !boxes.has(target)) continue
      if (armedSource === pointerId(node)) continue // detached → drawn as live stretch
      const faded = orphanSet.has(node) || orphanSet.has(target)
      arrows.push({ key: node, from: boxes.get(node)!, to: boxes.get(target)!, tone: faded ? "faint" : "muted" })
    }
  } else {
    nodes.forEach((node, i) => {
      const target = nodes[i + 1] ?? NIL
      const tone = i < cursor ? "active" : "faint"
      arrows.push({ key: node, from: boxes.get(node)!, to: boxes.get(target)!, tone })
    })
  }

  return (
    <div ref={outerRef} className="w-full overflow-hidden">
      <div className="relative mx-auto" style={{ width: width * scale, height: height * scale }}>
        <div
          ref={containerRef}
          data-testid="node-graph"
          data-reduced-motion={reduced ? "1" : undefined}
          className="absolute left-0 top-0"
          style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden>
            {arrows.map((arw) => (
              <Arrow
                key={arw.key}
                geom={arrowGeom(arw.from, arw.to)}
                className={
                  arw.tone === "active"
                    ? "text-lilac-strong"
                    : arw.tone === "faint"
                      ? "text-faint"
                      : "text-muted-foreground"
                }
              />
            ))}
            {mode === "rewire" && (
              <LiveStretch
                armedSource={armedSource}
                boxes={boxes}
                cursor={liveCursor}
                hoveredTarget={hoveredTarget}
              />
            )}
          </svg>

          {/* nodes — in rewire mode each node is BOTH the drag handle for its own
              arrow AND a drop target (grab a node, drag onto another). */}
          {nodes.map((node, i) => {
            const box = boxes.get(node)!
            if (mode === "rewire") {
              if (orphanSet.has(node)) return <OrphanNode key={node} node={node} box={box} reduced={reduced} />
              return (
                <Positioned key={node} box={box}>
                  <RewireNode node={node} orderHint={orderHintFor(rewires, node)} scale={scale} />
                </Positioned>
              )
            }
            if (mode === "replay") {
              if (orphanSet.has(node)) return <OrphanNode key={node} node={node} box={box} reduced={reduced} />
              return (
                <Positioned key={node} box={box}>
                  <PlainNode node={node} />
                </Positioned>
              )
            }
            return (
              <Positioned key={node} box={box}>
                <ChainNode
                  node={node}
                  visited={i <= cursor}
                  isCurrent={i === cursor}
                  isNext={i === cursor + 1}
                  clickable={!!onTapNode}
                  tone={cursorTone}
                  isAnswer={answerIndex === i}
                  onTap={onTapNode ? () => onTapNode(i) : undefined}
                />
              </Positioned>
            )
          })}

          {/* the new node — rewire only (also a grab handle + drop target) */}
          {mode === "rewire" && newNode && !orphanSet.has(newNode) && (
            <Positioned box={boxes.get(newNode)!}>
              <RewireNode node={newNode} isNew orderHint={orderHintFor(rewires, newNode)} scale={scale} />
            </Positioned>
          )}

          {/* the new node — replay (read-only) */}
          {mode === "replay" && newNode && !orphanSet.has(newNode) && (
            <Positioned box={boxes.get(newNode)!}>
              <PlainNode node={newNode} isNew />
            </Positioned>
          )}

          {/* the null terminator */}
          <Positioned box={nilBox}>
            <span className="flex size-full items-center justify-center rounded-full border-2 border-dashed border-border/60 font-mono text-base text-muted-foreground">
              {NIL}
            </span>
          </Positioned>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------- pieces --------------------------------- */

function Positioned({ box, children }: { box: Box; children: React.ReactNode }) {
  return (
    <div className="absolute" style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
      {children}
    </div>
  )
}

const CURRENT_TONE: Record<NodeTone, string> = {
  active: "border-lilac-strong bg-lilac-soft",
  correct: "border-success bg-success-soft",
  wrong: "border-danger bg-danger-soft",
}

/**
 * A node in walk mode. When `clickable` (the traverse beat) every node is a
 * selectable button: tapping it answers the question, and the chosen node + the
 * head→node path light up in `tone`. Otherwise it's a read-only chain node
 * (teach / predict / contrast) showing the walked-so-far cue.
 */
function ChainNode({
  node,
  visited,
  isCurrent,
  isNext,
  clickable,
  tone,
  isAnswer,
  onTap,
}: {
  node: string
  visited: boolean
  isCurrent: boolean
  isNext: boolean
  clickable: boolean
  tone: NodeTone
  isAnswer: boolean
  onTap?: () => void
}) {
  if (clickable) {
    return (
      <button
        type="button"
        aria-current={isCurrent ? "step" : undefined}
        aria-label={`node ${node}`}
        data-answer={isAnswer && import.meta.env.DEV ? "1" : undefined}
        onClick={onTap}
        className={cn(
          "flex size-full items-center justify-center rounded-full border-2 text-base font-bold text-foreground outline-none transition-colors",
          "cursor-pointer focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isCurrent ? CURRENT_TONE[tone] : "border-border bg-card hover:border-lilac-strong/50",
        )}
      >
        {node}
      </button>
    )
  }
  return (
    <button
      type="button"
      disabled
      aria-current={isCurrent ? "step" : undefined}
      className={cn(
        "flex size-full items-center justify-center rounded-full border-2 text-base font-bold text-foreground outline-none transition-colors",
        isCurrent && "border-lilac-strong bg-lilac-soft",
        !isCurrent && visited && "border-border bg-card",
        isNext && "border-lilac-strong/60 ring-4 ring-lilac-strong/15",
        !visited && !isNext && "border-dashed border-border bg-card/60 text-muted-foreground",
      )}
    >
      {node}
    </button>
  )
}

/** The order/target hint a node carries as the source of a graded write (dev/E2E only). */
function orderHintFor(
  rewires: RewirePair[] | undefined,
  node: string,
): { to: string; order: number } | null {
  if (!rewires) return null
  const idx = rewires.findIndex((rw) => rw.from === pointerId(node))
  return idx >= 0 ? { to: rewires[idx].to, order: idx + 1 } : null
}

/**
 * A rewire node: simultaneously the **grab handle for its own arrow** (drag/tap/
 * keyboard arms `p:node`) and a **drop target** (id `node`). Grab a node and drag
 * onto another to re-aim its `next` — no separate connector dots. Talks straight
 * to the shared <RewireSurface> context so drag, tap, and keyboard emit the same
 * `from → to` intent (and the E2E tracer hooks survive on the node itself).
 */
function RewireNode({
  node,
  isNew,
  orderHint,
  scale,
}: {
  node: string
  isNew?: boolean
  orderHint: { to: string; order: number } | null
  scale: number
}) {
  const { ref, armed, showLegal, hovered, rootProps } = useRewireNode({
    sourceId: pointerId(node),
    targetId: node,
    sourceLabel: `${node}'s next pointer`,
    targetLabel: `node ${node}`,
  })

  // The whole figure is scaled down to fit a phone, shrinking each node below the
  // 44px min tap target. Lay an invisible hit area over it sized so it reads >=44px
  // ON SCREEN once scaled (capped at the slot pitch so neighbours never overlap).
  // The visual circle stays scaled; drag drops still use the rim + DROP_TOLERANCE.
  const hitPx = Math.max(NODE_W, Math.min(Math.ceil(44 / (scale || 1)), NODE_W + GAP_X))

  return (
    <button
      ref={ref}
      type="button"
      {...rootProps}
      aria-label={
        armed
          ? `${node} arrow grabbed — choose a target`
          : showLegal
            ? `node ${node}, available target`
            : `node ${node}, drag its arrow to connect`
      }
      className={cn(
        "relative flex size-full touch-none select-none items-center justify-center rounded-full border-2 text-base font-bold text-foreground outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        armed
          ? "cursor-grabbing border-lilac-strong bg-lilac-soft ring-4 ring-lilac-strong/20"
          : showLegal
            ? "cursor-pointer border-dashed border-lilac-strong bg-lilac-soft"
            : "cursor-grab border-border bg-card hover:border-lilac-strong/45",
        hovered && "border-solid ring-4 ring-lilac-strong/25",
        isNew && !armed && !showLegal && "border-lilac-strong/70",
      )}
    >
      {isNew ? (
        <span className="flex flex-col items-center leading-none">
          <span className="text-base font-bold text-lilac-strong">{node}</span>
          <span className="text-[8px] font-semibold uppercase tracking-wide text-lilac-strong">new</span>
        </span>
      ) : (
        node
      )}
      {import.meta.env.DEV && orderHint && (
        <span
          className="sr-only"
          data-rewire-correct-target={orderHint.to}
          data-write-order={orderHint.order}
        />
      )}
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 touch-none"
        style={{ width: hitPx, height: hitPx }}
      />
    </button>
  )
}

/** A static, non-interactive node for the read-only replay reveals. */
function PlainNode({ node, isNew }: { node: string; isNew?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-full items-center justify-center rounded-full border-2 text-base font-bold text-foreground",
        isNew ? "border-lilac-strong bg-lilac-soft" : "border-border bg-card",
      )}
    >
      {isNew ? (
        <span className="flex flex-col items-center leading-none">
          <span className="text-base font-bold text-lilac-strong">{node}</span>
          <span className="text-[8px] font-semibold uppercase tracking-wide text-lilac-strong">new</span>
        </span>
      ) : (
        node
      )}
    </span>
  )
}

function NilNode({ box }: { box: Box }) {
  return (
    <span
      className="absolute flex items-center justify-center rounded-full border-2 border-dashed border-border/60 font-mono text-base text-muted-foreground"
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      aria-label="null terminator"
    >
      {NIL}
    </span>
  )
}

function Arrow({
  geom,
  className,
  style,
}: {
  geom: ReturnType<typeof arrowGeom>
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <g className={cn("text-muted-foreground", className)} style={style}>
      <path d={geom.d} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
      <g transform={`translate(${geom.tip.x} ${geom.tip.y}) rotate(${geom.angleDeg})`}>
        <path d={`M0 0 L${-HEAD_LEN} ${-HEAD_HALF} L${-HEAD_LEN} ${HEAD_HALF} Z`} fill="currentColor" />
      </g>
    </g>
  )
}

function LiveStretch({
  armedSource,
  boxes,
  cursor,
  hoveredTarget,
}: {
  armedSource: string | null
  boxes: Map<string, Box>
  cursor: Pt | null
  hoveredTarget: string | null
}) {
  if (!armedSource) return null
  const src = boxes.get(sourceNode(armedSource))
  if (!src) return null
  const c = center(src)
  const hovered = hoveredTarget && boxes.has(hoveredTarget) ? boxes.get(hoveredTarget)! : null
  const end = cursor ?? (hovered ? center(hovered) : null)

  // Armed but with no endpoint yet: the single frame right after a grab (cursor
  // not tracked yet), or a keyboard-arm before the learner cycles to a target.
  // Draw a short "lifted" stub off the source's top rim so the grabbed arrow
  // stays visible instead of vanishing. The pointer is in your hand.
  if (!end) {
    const start = { x: c.x, y: c.y - radius(src) }
    const tip = { x: start.x, y: start.y - STUB_LEN }
    return (
      <g data-testid="armed-arrow" className="text-lilac-strong">
        <path
          d={`M ${start.x} ${start.y} L ${tip.x} ${tip.y + 7}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeDasharray="1 7"
        />
        <g transform={`translate(${tip.x} ${tip.y}) rotate(-90)`}>
          <path d={`M0 0 L${-HEAD_LEN} ${-HEAD_HALF} L${-HEAD_LEN} ${HEAD_HALF} Z`} fill="currentColor" />
        </g>
      </g>
    )
  }

  const len = Math.hypot(end.x - c.x, end.y - c.y) || 1
  const dir = { x: (end.x - c.x) / len, y: (end.y - c.y) / len }
  const start = { x: c.x + dir.x * radius(src), y: c.y + dir.y * radius(src) }
  // When snapping to a hovered node (no live cursor), land on its rim, not center.
  const tip = !cursor && hovered ? { x: end.x - dir.x * radius(hovered), y: end.y - dir.y * radius(hovered) } : end
  const angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI
  return (
    <g data-testid="armed-arrow" className="text-lilac-strong">
      <path
        d={`M ${start.x} ${start.y} L ${tip.x - dir.x * 7} ${tip.y - dir.y * 7}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
      <g transform={`translate(${tip.x} ${tip.y}) rotate(${angle})`}>
        <path d={`M0 0 L${-HEAD_LEN} ${-HEAD_HALF} L${-HEAD_LEN} ${HEAD_HALF} Z`} fill="currentColor" />
      </g>
    </g>
  )
}

/**
 * An orphaned node: the tail the list just lost. It mounts at its in-row spot and
 * drifts down/away as it greys out, so the "lost tail" is a felt moment rather
 * than an instant swap (the bug: it used to mount already at the end-state). Under
 * reduced motion `initial={false}` snaps it straight to the drifted state.
 */
function OrphanNode({ node, box, reduced }: { node: string; box: Box; reduced: boolean }) {
  return (
    <motion.div
      data-reduced-motion={reduced ? "1" : undefined}
      className="absolute flex items-center justify-center rounded-full border-2 border-dashed border-faint bg-card/40 text-base font-bold text-faint"
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      initial={reduced ? false : { x: 0, y: 0, rotate: 0, opacity: 1 }}
      animate={{ x: 10, y: 28, rotate: -4, opacity: 0.6 }}
      transition={reduced ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
      aria-label={`${node}, orphaned`}
    >
      {node}
    </motion.div>
  )
}
