import { useEffect } from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { useRewireContext } from "./RewireContext"
import type { RewireSourceProps } from "./types"

/**
 * A draggable/focusable connector origin. Tapping it arms the gesture (then tap
 * a target); it's also the drag handle (slice 2) and keyboard entry (slice 3).
 * Always renders a stable `data-rewire-source` hook for the E2E tracer.
 *
 * While it is the source being dragged it physically follows the pointer (the
 * surface publishes the live offset as `dragVisual`): it tracks the finger 1:1,
 * scales up slightly, and rides above its siblings; on release or cancel the
 * offset clears and it springs back to its origin (the glide-back on a miss).
 * Reduced motion opts out of the transform entirely, leaving tap/keyboard as the
 * affordance. The drop geometry and emitted intent are unchanged either way.
 */
export function RewireSource({ id, label, children, className, bare }: RewireSourceProps) {
  const {
    registerSource,
    armedSource,
    armSource,
    tapSource,
    beginSourceDrag,
    moveHover,
    confirmKeyboard,
    cancel,
    dragVisual,
  } = useRewireContext()
  const reduce = useReducedMotion()

  useEffect(() => registerSource(id, label), [registerSource, id, label])

  const armed = armedSource === id
  // The live offset while THIS source is the one being dragged (else null). Under
  // reduced motion we never follow, so the keyboard/tap path stays the affordance.
  const dragOffset = !reduce && dragVisual && dragVisual.from === id ? dragVisual : null

  return (
    <motion.button
      type="button"
      data-rewire-source={id}
      data-rewire-armed={armed && import.meta.env.DEV ? "1" : undefined}
      aria-label={label}
      aria-pressed={armed}
      animate={
        reduce
          ? undefined
          : dragOffset
            ? { x: dragOffset.dx, y: dragOffset.dy, scale: 1.08 }
            : { x: 0, y: 0, scale: 1 }
      }
      transition={
        dragOffset
          ? // track the pointer 1:1 (no easing lag); pop the scale with a spring
            { default: { duration: 0 }, scale: { type: "spring", stiffness: 520, damping: 30 } }
          : // release: glide back to the origin (and settle the scale)
            { type: "spring", stiffness: 380, damping: 28 }
      }
      style={{ zIndex: dragOffset ? 50 : undefined }}
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
        "inline-flex min-h-11 touch-none select-none items-center justify-center outline-none transition-colors",
        !reduce && "cursor-grab active:cursor-grabbing",
        "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        bare
          ? armed && "ring-2 ring-lilac-strong/60"
          : cn(
              "gap-2 rounded-full border-2 px-4 py-2 text-sm font-semibold text-foreground",
              armed
                ? "border-lilac-strong bg-lilac-soft ring-4 ring-lilac-strong/15"
                : "border-border bg-card hover:border-lilac-strong/45",
            ),
        className,
      )}
    >
      {!bare && (
        <span
          aria-hidden
          className={cn("size-2.5 rounded-full", armed ? "bg-lilac-strong" : "bg-faint")}
        />
      )}
      {children ?? label}
    </motion.button>
  )
}
