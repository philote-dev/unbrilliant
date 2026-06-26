import { createContext, useContext } from "react"

import type { TargetRect } from "./core"

/**
 * The seam every rewire source/target talks to. The surface owns the registry
 * (insertion-ordered, so keyboard cycling + the tracer are deterministic), the
 * transient gesture state (which source is armed, which target is hovered), and
 * the modality-agnostic actions. Pointer drag, tap, and keyboard all funnel
 * through `armSource` / `setHovered` / `chooseTarget` / `cancel`, so the three
 * inputs are guaranteed to produce the identical intent.
 */
export interface RewireContextValue {
  registerSource: (id: string, label: string) => () => void
  registerTarget: (
    id: string,
    label: string,
    getRect: () => DOMRect | null,
  ) => () => void

  legalTargets: Set<string>
  isLegal: (id: string) => boolean

  armedSource: string | null
  hoveredTarget: string | null
  /**
   * The source currently being dragged with its live pointer offset from the
   * press origin (`dx`/`dy`), or `null` when no drag is in flight. Drives the
   * source's pointer-follow transform only; the drop geometry and the emitted
   * intent are computed independently, so this never affects grading.
   */
  dragVisual: { from: string; dx: number; dy: number } | null

  armSource: (id: string) => void
  /** Tap entry for a source — arms it, unless a drag just ended (ignores the trailing click). */
  tapSource: (id: string) => void
  /** Begin a pointer drag from a source; the surface tracks move/up on the window. */
  beginSourceDrag: (
    from: string,
    x: number,
    y: number,
    pointerId: number,
    el: HTMLElement | null,
  ) => void
  /** Commit if a source is armed and `id` is registered; otherwise snap back. */
  chooseTarget: (id: string) => void
  setHovered: (id: string | null) => void
  /** Keyboard: step the highlighted target forward (+1) / backward (-1). */
  moveHover: (dir: 1 | -1) => void
  /** Keyboard: commit the currently highlighted target (if any). */
  confirmKeyboard: () => void
  cancel: () => void

  /** Registered target ids in registration order (for keyboard cycling). */
  orderedTargetIds: () => string[]
  /** Current target boxes for geometry hit-testing (drag). */
  targetRects: () => TargetRect[]
}

export const RewireContext = createContext<RewireContextValue | null>(null)

export function useRewireContext(): RewireContextValue {
  const ctx = useContext(RewireContext)
  if (!ctx) {
    throw new Error("Rewire components must be used within <RewireSurface>")
  }
  return ctx
}
