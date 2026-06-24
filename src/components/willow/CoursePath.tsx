import { useEffect, useRef, useState } from "react"
import { Check, Lock } from "lucide-react"

import { cn } from "@/lib/utils"

export type PathNodeState = "completed" | "current" | "available" | "locked"

export interface PathNode {
  id: string
  name: string
  state: PathNodeState
}

const ROW_H = 96
const R = 21

/**
 * Scrollable downward lesson path whose landmarks meander side-to-side, joined by
 * a faint dotted connector. Every landmark glows on hover/focus so the learner can
 * preview where a future lesson sits; locked lessons are hoverable but not enterable.
 */
export function CoursePath({
  nodes,
  onSelect,
  className,
}: {
  nodes: PathNode[]
  onSelect?: (node: PathNode) => void
  className?: string
}) {
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

  // Pronounced meander, clamped so labels never run off the edges.
  const amp = Math.min(82, Math.max(28, (width - 180) / 2))
  const mid = width / 2
  const cx = (i: number) => mid + amp * Math.sin(i * 0.85)
  const cy = (i: number) => i * ROW_H + ROW_H / 2
  const height = nodes.length * ROW_H

  let d = ""
  nodes.forEach((_, i) => {
    const x = cx(i)
    const y = cy(i)
    if (i === 0) {
      d += `M ${x} ${y}`
    } else {
      const my = (cy(i - 1) + y) / 2
      d += ` C ${cx(i - 1)} ${my}, ${x} ${my}, ${x} ${y}`
    }
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
          strokeWidth={2.5}
          strokeDasharray="0.5 9"
          strokeLinecap="round"
          opacity={0.45}
        />
      </svg>

      {nodes.map((node, i) => {
        const x = cx(i)
        const y = cy(i)
        const enterable = node.state !== "locked"
        const labelRight = x <= mid

        return (
          <div key={node.id} className="absolute inset-x-0" style={{ top: y - ROW_H / 2, height: ROW_H }}>
            {/* group wraps node + label so a hover/focus anywhere lights the landmark */}
            <div
              className="group absolute"
              style={{ left: x - R, top: ROW_H / 2 - R, width: R * 2, height: R * 2 }}
            >
              {/* glow — shows where the learner is looking (hover / keyboard focus) */}
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
                "pointer-events-none absolute -translate-y-1/2 whitespace-nowrap text-[15px]",
                node.state === "locked" ? "text-muted-foreground" : "font-semibold text-foreground",
              )}
              style={
                labelRight
                  ? { left: x + R + 14, top: ROW_H / 2 }
                  : { right: width - (x - R - 14), top: ROW_H / 2, textAlign: "right" }
              }
            >
              {node.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}
