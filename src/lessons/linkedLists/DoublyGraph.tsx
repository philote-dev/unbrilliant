import { useLayoutEffect, useRef, useState } from "react"
import { useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { nextPtr, prevPtr, type DoublyWrite } from "@/features/lesson/linkedListsEngine"

/**
 * The doubly-linked figure: a horizontal chain where every neighbour pair is
 * joined by TWO arrows, a forward `next` (above the row) and a backward `prev`
 * (below it), so "you can walk either direction" is drawn, not implied. Two uses:
 *
 *  - **DoublyChain**: the demo sandbox and the backward forced-walk. A lit range
 *    plus a direction highlights the path walked so far; in the walk only the
 *    frontier (the next legal hop) is tappable.
 *  - **DoublySplice**: X sits below the row between A and B; each of the four
 *    save-first writes draws its arrow (to/from X) as the learner performs it, so
 *    the splice assembles both ways. Reduced motion just renders the final arrows.
 *
 * Geometry is fixed-px and scaled to fit the container (jsdom zeroes rects, so the
 * math stays deterministic and unit-testable).
 */

const NODE = 48
const GAP = 34
const ROW_Y = 70
const MARGIN = 16
const LOOSE_DROP = 92
const HEAD = 8

interface Pt {
  x: number
  y: number
}

function useFit(width: number): { ref: React.RefObject<HTMLDivElement | null>; scale: number } {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
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
  return { ref, scale }
}

function rowX(i: number): number {
  return MARGIN + i * (NODE + GAP)
}
function center(i: number): Pt {
  return { x: rowX(i) + NODE / 2, y: ROW_Y + NODE / 2 }
}

/** A curved arrow between two points, bowed by `bend` (negative = up), with a head. */
function CurvedArrow({
  from,
  to,
  bend,
  className,
}: {
  from: Pt
  to: Pt
  bend: number
  className?: string
}) {
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2 + bend
  // Approximate the tangent at the end for the arrowhead angle.
  const dx = to.x - mx
  const dy = to.y - my
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI
  return (
    <g className={className}>
      <path
        d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <g transform={`translate(${to.x} ${to.y}) rotate(${ang})`}>
        <path d={`M0 0 L${-HEAD} ${-5} L${-HEAD} 5 Z`} fill="currentColor" />
      </g>
    </g>
  )
}

type NodeTone = "active" | "correct" | "wrong"
const TONE: Record<NodeTone, string> = {
  active: "border-lilac-strong bg-lilac-soft",
  correct: "border-success bg-success-soft",
  wrong: "border-danger bg-danger-soft",
}

/* ------------------------------- DoublyChain ------------------------------- */

export function DoublyChain({
  nodes,
  cursor = -1,
  litFrom,
  litTo,
  litDir = null,
  frontier,
  tone = "active",
  onTapNode,
}: {
  nodes: string[]
  /** The currently-emphasised node (the walk position). */
  cursor?: number
  /** Inclusive lit range [litFrom, litTo] (the path walked so far). */
  litFrom?: number
  litTo?: number
  /** Which arrow set to light along the lit range. */
  litDir?: "next" | "prev" | null
  /** Forced walk: the ONLY tappable node index (the next hop), or undefined for free. */
  frontier?: number
  tone?: NodeTone
  onTapNode?: (index: number) => void
}) {
  const n = nodes.length
  const width = MARGIN * 2 + n * NODE + Math.max(0, n - 1) * GAP
  const height = ROW_Y + NODE + 28
  const { ref, scale } = useFit(width)

  const inLit = (i: number) =>
    litFrom != null && litTo != null && i >= Math.min(litFrom, litTo) && i <= Math.max(litFrom, litTo)
  const segLit = (i: number) => inLit(i) && inLit(i + 1)

  return (
    <div ref={ref} className="w-full overflow-hidden">
      <div className="relative mx-auto" style={{ width: width * scale, height: height * scale }}>
        <div
          data-testid="doubly-graph"
          className="absolute left-0 top-0"
          style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden>
            {nodes.slice(0, -1).map((node, i) => {
              const a = center(i)
              const b = center(i + 1)
              const nextLit = litDir === "next" && segLit(i)
              const prevLit = litDir === "prev" && segLit(i)
              return (
                <g key={node}>
                  <CurvedArrow
                    from={{ x: a.x + NODE / 2 - 4, y: a.y - 6 }}
                    to={{ x: b.x - NODE / 2 + 4, y: b.y - 6 }}
                    bend={-16}
                    className={cn("transition-colors", nextLit ? "text-lilac-strong" : "text-faint")}
                  />
                  <CurvedArrow
                    from={{ x: b.x - NODE / 2 + 4, y: b.y + 6 }}
                    to={{ x: a.x + NODE / 2 - 4, y: a.y + 6 }}
                    bend={16}
                    className={cn("transition-colors", prevLit ? "text-lilac-strong" : "text-faint")}
                  />
                </g>
              )
            })}
          </svg>

          {nodes.map((node, i) => {
            const gated = onTapNode != null && (frontier == null || i === frontier)
            const lit = i === cursor || inLit(i)
            return (
              <div
                key={node}
                className="absolute"
                style={{ left: rowX(i), top: ROW_Y, width: NODE, height: NODE }}
              >
                <button
                  type="button"
                  disabled={!gated}
                  aria-current={i === cursor ? "step" : undefined}
                  aria-label={`node ${node}`}
                  onClick={gated ? () => onTapNode!(i) : undefined}
                  className={cn(
                    "flex size-full items-center justify-center rounded-full border-2 text-base font-bold text-foreground outline-none transition-colors",
                    gated
                      ? "cursor-pointer border-lilac-strong/70 ring-4 ring-lilac-strong/15 hover:bg-lilac-soft"
                      : lit
                        ? TONE[tone]
                        : "border-border bg-card",
                  )}
                >
                  {node}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ DoublySplice ------------------------------ */

export function DoublySplice({
  nodes,
  newNode,
  prev,
  at,
  performed,
}: {
  nodes: string[]
  newNode: string
  prev: string
  at: string
  /** The writes performed so far (drives which X-arrows are drawn bright). */
  performed: DoublyWrite[]
}) {
  const prefersReduced = useReducedMotion()
  const reduced = prefersReduced ?? false
  const n = nodes.length
  const width = MARGIN * 2 + n * NODE + Math.max(0, n - 1) * GAP
  const height = ROW_Y + NODE + LOOSE_DROP
  const { ref, scale } = useFit(width)

  const prevIdx = nodes.indexOf(prev)
  const atIdx = nodes.indexOf(at)
  const looseX = (center(prevIdx).x + center(atIdx).x) / 2
  const looseCenter: Pt = { x: looseX, y: ROW_Y + NODE + LOOSE_DROP - NODE / 2 }

  const done = (from: string, to: string) =>
    performed.some((w) => w.from === from && w.to === to)
  const xNext = done(nextPtr(newNode), at)
  const xPrev = done(prevPtr(newNode), prev)
  const aNext = done(nextPtr(prev), newNode)
  const bPrev = done(prevPtr(at), newNode)
  const spliced = aNext && bPrev

  const a = center(prevIdx)
  const b = center(atIdx)
  const xRimTop: Pt = { x: looseCenter.x, y: looseCenter.y - NODE / 2 }

  return (
    <div ref={ref} className="w-full overflow-hidden">
      <div className="relative mx-auto" style={{ width: width * scale, height: height * scale }}>
        <div
          data-testid="doubly-graph"
          data-reduced-motion={reduced ? "1" : undefined}
          className="absolute left-0 top-0"
          style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden>
            {/* base chain double-arrows (faded once X is spliced between A and B) */}
            {nodes.slice(0, -1).map((node, i) => {
              const ca = center(i)
              const cb = center(i + 1)
              const isAB = i === prevIdx && i + 1 === atIdx
              const faded = isAB && spliced
              return (
                <g key={node} className={faded ? "text-faint/40" : "text-faint"}>
                  <CurvedArrow
                    from={{ x: ca.x + NODE / 2 - 4, y: ca.y - 6 }}
                    to={{ x: cb.x - NODE / 2 + 4, y: cb.y - 6 }}
                    bend={-16}
                  />
                  <CurvedArrow
                    from={{ x: cb.x - NODE / 2 + 4, y: cb.y + 6 }}
                    to={{ x: ca.x + NODE / 2 - 4, y: ca.y + 6 }}
                    bend={16}
                  />
                </g>
              )
            })}

            {/* the four save-first writes to/from X, drawn as they are performed */}
            {xNext && (
              <CurvedArrow from={{ x: xRimTop.x + 8, y: xRimTop.y }} to={{ x: b.x - 10, y: b.y + NODE / 2 - 4 }} bend={10} className="text-lilac-strong" />
            )}
            {xPrev && (
              <CurvedArrow from={{ x: xRimTop.x - 8, y: xRimTop.y }} to={{ x: a.x + 10, y: a.y + NODE / 2 - 4 }} bend={-10} className="text-lilac-strong" />
            )}
            {aNext && (
              <CurvedArrow from={{ x: a.x - 6, y: a.y + NODE / 2 - 2 }} to={{ x: xRimTop.x - 12, y: xRimTop.y - 2 }} bend={14} className="text-success" />
            )}
            {bPrev && (
              <CurvedArrow from={{ x: b.x + 6, y: b.y + NODE / 2 - 2 }} to={{ x: xRimTop.x + 12, y: xRimTop.y - 2 }} bend={-14} className="text-success" />
            )}
          </svg>

          {nodes.map((node, i) => {
            const c = center(i)
            const isAnchor = node === prev || node === at
            return (
              <div
                key={node}
                className="absolute"
                style={{ left: c.x - NODE / 2, top: ROW_Y, width: NODE, height: NODE }}
              >
                <span
                  className={cn(
                    "flex size-full items-center justify-center rounded-full border-2 text-base font-bold text-foreground",
                    isAnchor ? "border-lilac-strong/70 bg-card" : "border-border bg-card",
                  )}
                >
                  {node}
                </span>
              </div>
            )
          })}

          {/* the loose new node X */}
          <div
            className="absolute"
            style={{ left: looseCenter.x - NODE / 2, top: looseCenter.y - NODE / 2, width: NODE, height: NODE }}
          >
            <span
              className={cn(
                "flex size-full flex-col items-center justify-center rounded-full border-2 leading-none transition-colors",
                spliced ? "border-success bg-success-soft" : "border-lilac-strong bg-lilac-soft",
              )}
            >
              <span className="text-base font-bold text-lilac-strong">{newNode}</span>
              <span className="text-[8px] font-semibold uppercase tracking-wide text-lilac-strong">new</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
