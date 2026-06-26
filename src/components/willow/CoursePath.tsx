import { useEffect, useRef, useState } from "react"
import { Check, Lock } from "lucide-react"

import { cn } from "@/lib/utils"

export type PathNodeState = "completed" | "current" | "available" | "locked"

export interface PathNode {
  id: string
  name: string
  state: PathNodeState
  /** Set on a completed lesson whose retention has decayed into the rusty band. */
  needsReview?: boolean
}

/** Shared contract every course-path layout (generic or themed) conforms to. */
export interface PathLayoutProps {
  nodes: PathNode[]
  onSelect?: (node: PathNode) => void
  className?: string
}

const ROW_H = 96
const R = 21
const LABEL_GAP = 14 // gap between a node circle and its label
const EDGE_PAD = 12 // keep labels clear of the container walls

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Scrollable downward lesson path, and the generic fallback layout. Landmarks
 * strictly alternate left/right down the column, joined by a segmented dotted
 * orthogonal trail with rounded right-angle corners. Every landmark glows on
 * hover/focus so the learner can preview where a future lesson sits; locked
 * lessons are hoverable but not enterable.
 */
export function CoursePath({ nodes, onSelect, className }: PathLayoutProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(360)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // Two fixed lanes at ~26%/74% of the width, clamped so a circle never touches a
  // wall; the wide split keeps the alternation obvious and leaves room for labels.
  const edge = R + 8
  const leftX = clamp(width * 0.26, edge, width - edge)
  const rightX = clamp(width * 0.74, edge, width - edge)
  const cx = (i: number) => (i % 2 === 0 ? leftX : rightX)
  const cy = (i: number) => i * ROW_H + ROW_H / 2
  const height = nodes.length * ROW_H

  // Orthogonal trail: from each dot go straight down, jog horizontally to the next
  // lane at the row midpoint, then down into the next dot. The right-angle turns get
  // rounded corners (quadratics), so it reads like a tidy circuit trace.
  const CORNER = 12
  let d = ""
  nodes.forEach((_, i) => {
    const x = cx(i)
    const y = cy(i)
    if (i === 0) {
      d = `M ${x} ${y}`
      return
    }
    const px = cx(i - 1)
    const py = cy(i - 1)
    const my = (py + y) / 2
    if (x === px) {
      d += ` L ${x} ${y}`
      return
    }
    const s = Math.sign(x - px) * CORNER
    d += ` L ${px} ${my - CORNER}`
    d += ` Q ${px} ${my} ${px + s} ${my}`
    d += ` L ${x - s} ${my}`
    d += ` Q ${x} ${my} ${x} ${my + CORNER}`
    d += ` L ${x} ${y}`
  })

  return (
    <div ref={ref} className={cn("relative w-full", className)} style={{ height }}>
      <svg
        className="absolute inset-0"
        width={width}
        height={height}
        aria-hidden
      >
        <path
          d={d}
          fill="none"
          stroke="var(--lilac-strong)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1.5 8"
          opacity={0.6}
        />
      </svg>

      {nodes.map((node, i) => {
        const x = cx(i)
        const y = cy(i)
        const enterable = node.state !== "locked"
        const onLeft = i % 2 === 0

        // Label sits on the side facing center, width-capped so it never hits a wall.
        const labelStyle = onLeft
          ? {
              left: x + R + LABEL_GAP,
              top: ROW_H / 2,
              maxWidth: Math.max(0, width - (x + R + LABEL_GAP) - EDGE_PAD),
            }
          : {
              right: width - (x - R - LABEL_GAP),
              top: ROW_H / 2,
              maxWidth: Math.max(0, x - R - LABEL_GAP - EDGE_PAD),
              textAlign: "right" as const,
            }

        return (
          <div key={node.id} className="absolute inset-x-0" style={{ top: y - ROW_H / 2, height: ROW_H }}>
            {/* group wraps node + label so a hover/focus anywhere lights the landmark */}
            <div
              className="group absolute"
              style={{ left: x - R, top: ROW_H / 2 - R, width: R * 2, height: R * 2 }}
            >
              {/* glow. Shows where the learner is looking (hover / keyboard focus) */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
                style={{
                  width: R * 3.4,
                  height: R * 3.4,
                  background: "radial-gradient(circle, var(--lilac-strong) 0%, transparent 66%)",
                  filter: `blur(${Math.round(R * 0.5)}px)`,
                }}
              />

              <button
                type="button"
                disabled={!enterable}
                onClick={() => enterable && onSelect?.(node)}
                aria-label={enterable ? node.name : `${node.name} (locked)`}
                className={cn(
                  "relative flex size-full items-center justify-center rounded-full outline-none transition-transform duration-200",
                  "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  "group-hover:scale-110",
                  enterable ? "cursor-pointer" : "cursor-default",
                  node.state === "completed" && "bg-lilac-strong text-white",
                  node.state === "current" &&
                    "bg-lilac-strong text-white ring-4 ring-lilac-strong/20",
                  node.state === "available" && "border-2 border-lilac-strong/55 bg-card",
                  node.state === "locked" && "border border-border bg-muted",
                )}
              >
                {node.state === "completed" && (
                  <Check className="size-4 text-white" strokeWidth={3} />
                )}
                {node.state === "current" && (
                  <span className="size-2.5 rounded-full bg-white" />
                )}
                {node.state === "locked" && <Lock className="size-3.5 text-faint" />}
              </button>
            </div>

            <span
              className={cn(
                "pointer-events-none absolute -translate-y-1/2 truncate text-[15px]",
                node.state === "locked" ? "text-muted-foreground" : "font-semibold text-foreground",
              )}
              style={labelStyle}
            >
              {node.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}
