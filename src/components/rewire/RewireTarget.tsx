import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"
import { useRewireContext } from "./RewireContext"
import type { RewireTargetProps } from "./types"

/**
 * A droppable connector destination. When a gesture is in progress, legal
 * targets light up (lilac + a non-color dashed/dot cue) and the hovered one
 * reads stronger. Choosing it emits the intent regardless of legality — a
 * registered-but-wrong target is the learner's real choice, not a miss.
 * Always renders a stable `data-rewire-target` hook for the E2E tracer.
 */
export function RewireTarget({ id, label, children, className, bare }: RewireTargetProps) {
  const { registerTarget, isLegal, armedSource, hoveredTarget, chooseTarget, setHovered } =
    useRewireContext()
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(
    () => registerTarget(id, label, () => ref.current?.getBoundingClientRect() ?? null),
    [registerTarget, id, label],
  )

  const legal = isLegal(id)
  const arming = armedSource != null
  const showLegal = arming && legal
  const hovered = hoveredTarget === id

  return (
    <button
      ref={ref}
      type="button"
      tabIndex={-1}
      data-rewire-target={id}
      data-rewire-legal={legal && import.meta.env.DEV ? "1" : undefined}
      aria-label={showLegal ? `${label} (available target)` : label}
      onClick={(e) => {
        e.stopPropagation()
        chooseTarget(id)
      }}
      onPointerEnter={() => {
        if (arming) setHovered(id)
      }}
      onPointerLeave={() => {
        if (hovered) setHovered(null)
      }}
      className={cn(
        "relative touch-none select-none outline-none transition-colors",
        bare
          ? "" // a transparent hit zone; the consumer draws its own affordance
          : cn(
              "inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl border-2 px-4 py-3 text-sm font-medium text-foreground",
              "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              showLegal ? "border-dashed border-lilac-strong bg-lilac-soft" : "border-border bg-card",
              hovered && "border-solid ring-4 ring-lilac-strong/25",
            ),
        className,
      )}
    >
      {!bare && showLegal && (
        <span
          aria-hidden
          className="absolute right-1.5 top-1.5 size-2 rounded-full bg-lilac-strong"
        />
      )}
      {/* a bare target is an invisible hit zone: its `label` is the accessible
          name only (via aria-label), never visible text. */}
      {bare ? children : (children ?? label)}
    </button>
  )
}
