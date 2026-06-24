import { useEffect } from "react"

import { cn } from "@/lib/utils"
import { useRewireContext } from "./RewireContext"
import type { RewireSourceProps } from "./types"

/**
 * A draggable/focusable connector origin. Tapping it arms the gesture (then tap
 * a target); it's also the drag handle (slice 2) and keyboard entry (slice 3).
 * Always renders a stable `data-rewire-source` hook for the E2E tracer.
 */
export function RewireSource({ id, label, children, className }: RewireSourceProps) {
  const {
    registerSource,
    armedSource,
    armSource,
    tapSource,
    beginSourceDrag,
    moveHover,
    confirmKeyboard,
    cancel,
  } = useRewireContext()

  useEffect(() => registerSource(id, label), [registerSource, id, label])

  const armed = armedSource === id

  return (
    <button
      type="button"
      data-rewire-source={id}
      data-rewire-armed={armed && import.meta.env.DEV ? "1" : undefined}
      aria-label={label}
      aria-pressed={armed}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        beginSourceDrag(id, e.clientX, e.clientY, e.pointerId, e.currentTarget)
      }}
      onKeyDown={(e) => {
        if (!armed) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            armSource(id)
          }
          return
        }
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault()
          moveHover(1)
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault()
          moveHover(-1)
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          confirmKeyboard()
        } else if (e.key === "Escape") {
          e.preventDefault()
          cancel()
        }
      }}
      onClick={(e) => {
        e.stopPropagation()
        tapSource(id)
      }}
      className={cn(
        "inline-flex min-h-11 touch-none select-none items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-semibold text-foreground outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        armed
          ? "border-lilac-strong bg-lilac-soft ring-4 ring-lilac-strong/15"
          : "border-border bg-card hover:border-lilac-strong/45",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2.5 rounded-full",
          armed ? "bg-lilac-strong" : "bg-faint",
        )}
      />
      {children ?? label}
    </button>
  )
}
