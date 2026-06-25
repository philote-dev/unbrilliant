import type { ReactNode } from "react"
import { Check, Lock } from "lucide-react"

import { cn } from "@/lib/utils"
import type { PathNode } from "../CoursePath"

/**
 * Shared building blocks for every course-path layout, so a node looks and
 * behaves identically (states, hover glow, focus ring, locking) whether it's a
 * circle on a trail, a cell in an array, or an item in a queue.
 */

/** Per-state surface classes; works for round or square silhouettes. */
export function nodeSurface(state: PathNode["state"]): string {
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

/** The default inner mark for a node (check / current dot / lock). */
export function NodeMark({ state }: { state: PathNode["state"] }) {
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
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
        style={{
          width: size * 1.7,
          height: size * 1.7,
          background: "radial-gradient(circle, var(--lilac-strong) 0%, transparent 66%)",
          filter: `blur(${Math.round(size * 0.28)}px)`,
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
          nodeSurface(node.state),
          className,
        )}
      >
        {children ?? <NodeMark state={node.state} />}
      </button>
    </div>
  )
}
