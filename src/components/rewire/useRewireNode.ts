import { useEffect, useRef } from "react"

import { useRewireContext } from "./RewireContext"

/**
 * Behaviour for a node that is BOTH a rewire source (its own outgoing pointer)
 * and a drop target — grab it and drag onto another node to re-aim its `next`.
 * Drag, tap, and keyboard all funnel through the shared <RewireSurface> context
 * so every modality emits the identical `from → to` intent. Rendering is left to
 * the caller (a circle node, a Spotify song row, …); this only wires behaviour.
 */
export interface RewireNodeApi {
  ref: React.RefObject<HTMLButtonElement | null>
  /** This source is the one currently grabbed. */
  armed: boolean
  /** Some source (possibly another) is armed — a gesture is in progress. */
  someArmed: boolean
  /** This node is a legal target for the current/whole gesture. */
  legal: boolean
  /** Show the legal-target affordance (arming, legal, and not the armed node). */
  showLegal: boolean
  /** This node is the hovered drop target. */
  hovered: boolean
  /** Spread onto the interactive element (a `<button>`). */
  rootProps: {
    "data-rewire-source": string
    "data-rewire-target": string
    "data-rewire-armed"?: string
    "data-rewire-legal"?: string
    "aria-pressed": boolean
    onPointerDown: (e: React.PointerEvent) => void
    onPointerEnter: () => void
    onPointerLeave: () => void
    onClick: (e: React.MouseEvent) => void
    onKeyDown: (e: React.KeyboardEvent) => void
  }
}

export function useRewireNode({
  sourceId,
  targetId,
  sourceLabel,
  targetLabel,
}: {
  sourceId: string
  targetId: string
  sourceLabel: string
  targetLabel: string
}): RewireNodeApi {
  const {
    registerSource,
    registerTarget,
    isLegal,
    armedSource,
    hoveredTarget,
    beginSourceDrag,
    tapSource,
    chooseTarget,
    cancel,
    setHovered,
    armSource,
    moveHover,
    confirmKeyboard,
  } = useRewireContext()
  const ref = useRef<HTMLButtonElement | null>(null)

  useEffect(() => registerSource(sourceId, sourceLabel), [registerSource, sourceId, sourceLabel])
  useEffect(
    () => registerTarget(targetId, targetLabel, () => ref.current?.getBoundingClientRect() ?? null),
    [registerTarget, targetId, targetLabel],
  )

  const armed = armedSource === sourceId
  const someArmed = armedSource != null
  const legal = isLegal(targetId)
  const showLegal = someArmed && legal && !armed
  const hovered = hoveredTarget === targetId && !armed

  return {
    ref,
    armed,
    someArmed,
    legal,
    showLegal,
    hovered,
    rootProps: {
      "data-rewire-source": sourceId,
      "data-rewire-target": targetId,
      "data-rewire-armed": armed && import.meta.env.DEV ? "1" : undefined,
      "data-rewire-legal": legal && import.meta.env.DEV ? "1" : undefined,
      "aria-pressed": armed,
      onPointerDown: (e) => {
        if (e.button !== 0) return
        beginSourceDrag(sourceId, e.clientX, e.clientY, e.pointerId, e.currentTarget as HTMLElement)
      },
      onPointerEnter: () => {
        if (someArmed && !armed) setHovered(targetId)
      },
      onPointerLeave: () => {
        if (hovered) setHovered(null)
      },
      onClick: (e) => {
        e.stopPropagation()
        if (armedSource == null) tapSource(sourceId)
        else if (armed) cancel()
        else chooseTarget(targetId)
      },
      onKeyDown: (e) => {
        if (!armed) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            armSource(sourceId)
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
      },
    },
  }
}
