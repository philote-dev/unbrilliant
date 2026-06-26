import type { ReactNode } from "react"
import { Check, Lock, RotateCcw } from "lucide-react"

import { cn } from "@/lib/utils"
import type { PathNode } from "../CoursePath"

/**
 * Shared building blocks for every course-path layout, so a node looks and
 * behaves identically (states, hover glow, focus ring, locking) whether it's a
 * circle on a trail, a cell in an array, or an item in a queue.
 */

/**
 * Per-state surface classes; works for round or square silhouettes. A completed
 * lesson that has gone rusty (`needsReview`) takes the pastel-yellow warning fill
 * so the review track stands out without relocking anything.
 */
export function nodeSurface(state: PathNode["state"], needsReview = false): string {
  if (state === "completed" && needsReview) return "bg-warning text-warning-foreground"
  switch (state) {
    case "completed":
    case "current":
      return "bg-lilac-strong text-white"
    case "available":
      return "border-2 border-lilac-strong/55 bg-card text-foreground"
    case "locked":
      return "border border-border bg-muted text-faint"
  }
}

/** The default inner mark for a node (check / review / current dot / lock). */
export function NodeMark({
  state,
  needsReview = false,
}: {
  state: PathNode["state"]
  needsReview?: boolean
}) {
  if (state === "completed" && needsReview)
    return <RotateCcw className="size-4 text-warning-foreground" strokeWidth={2.75} />
  if (state === "completed") return <Check className="size-4 text-white" strokeWidth={3} />
  if (state === "current") return <span className="size-2.5 rounded-full bg-white" />
  if (state === "locked") return <Lock className="size-3.5 text-faint" />
  return null
}

/** Text colour for a label next to a node, matching its state. */
export function labelClass(state: PathNode["state"]): string {
  return state === "locked" ? "text-muted-foreground" : "font-semibold text-foreground"
}

/**
 * A tappable path node with hover/focus glow. `shape` picks the silhouette and
 * `children` overrides the inner mark (e.g. an array index). Locked nodes are
 * focusable for preview but not enterable.
 */
export function PathNodeButton({
  node,
  onSelect,
  size = 44,
  shape = "round",
  className,
  children,
}: {
  node: PathNode
  onSelect?: (node: PathNode) => void
  size?: number
  shape?: "round" | "square"
  className?: string
  children?: ReactNode
}) {
  const enterable = node.state !== "locked"
  return (
    <div className="group relative shrink-0" style={{ width: size, height: size }}>
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-90 rounded-full opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100"
        style={{
          width: size * 2.3,
          height: size * 2.3,
          background:
            "radial-gradient(circle, var(--lilac-strong) 0%, var(--lilac-strong) 30%, transparent 72%)",
          filter: `blur(${Math.round(size * 0.26)}px)`,
        }}
      />
      <button
        type="button"
        disabled={!enterable}
        onClick={() => enterable && onSelect?.(node)}
        aria-label={enterable ? node.name : `${node.name} (locked)`}
        className={cn(
          "relative flex size-full items-center justify-center text-sm font-bold outline-none transition-transform duration-200",
          "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "group-hover:scale-110",
          shape === "round" ? "rounded-full" : "rounded-xl",
          node.state === "current" && "ring-4 ring-lilac-strong/20",
          enterable ? "cursor-pointer" : "cursor-default",
          nodeSurface(node.state, node.needsReview),
          className,
        )}
      >
        {children ?? <NodeMark state={node.state} needsReview={node.needsReview} />}
      </button>
    </div>
  )
}
