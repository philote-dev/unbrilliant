import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { RewireContext, type RewireContextValue } from "./RewireContext"
import { cycleTarget, resolveDropTarget, type TargetRect } from "./core"
import type { RewireSurfaceProps } from "./types"

interface SourceEntry {
  label: string
}
interface TargetEntry {
  label: string
  getRect: () => DOMRect | null
}

interface DragState {
  from: string
  pointerId: number
  startX: number
  startY: number
  active: boolean
  rects: TargetRect[]
  teardown: () => void
}

/** Px the pointer must travel before a press becomes a drag (vs. a tap). */
const DRAG_THRESHOLD = 6
/** Forgiving slop around a target so clumsy drops still land (story #2). */
const DROP_TOLERANCE = 14

/**
 * Presentation-only rewire surface. Wires its source/target slots to one shared
 * registry + gesture state, emits a single `from → to` intent on a valid drop,
 * and snaps back (emitting nothing) on a miss. It contains NO grading: the
 * consuming lesson's pure engine interprets the intent and computes `legalTargets`.
 */
export function RewireSurface({
  legalTargets,
  onRewire,
  children,
  label,
  className,
}: RewireSurfaceProps) {
  const sourcesRef = useRef<Map<string, SourceEntry>>(new Map())
  const targetsRef = useRef<Map<string, TargetEntry>>(new Map())

  // armedRef is the source of truth for logic (no stale closures / no work in a
  // state updater); armedSource mirrors it for rendering the armed affordance.
  const armedRef = useRef<string | null>(null)
  const [armedSource, setArmedState] = useState<string | null>(null)
  const [hoveredTarget, setHoveredTarget] = useState<string | null>(null)
  const hoveredRef = useRef<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  // The live drag-follow visual (which source is dragging + its offset from the
  // press origin). Presentation only: the source reads it to track the pointer.
  const [dragVisual, setDragVisual] = useState<
    { from: string; dx: number; dy: number } | null
  >(null)

  const setArmed = useCallback((id: string | null) => {
    armedRef.current = id
    setArmedState(id)
  }, [])

  // hoveredRef keeps the latest highlight readable synchronously (keyboard
  // confirm / drag-end) without waiting for a state flush.
  const setHovered = useCallback((id: string | null) => {
    hoveredRef.current = id
    setHoveredTarget(id)
  }, [])

  const registerSource = useCallback((id: string, srcLabel: string) => {
    sourcesRef.current.set(id, { label: srcLabel })
    return () => {
      sourcesRef.current.delete(id)
    }
  }, [])

  const registerTarget = useCallback(
    (id: string, tgtLabel: string, getRect: () => DOMRect | null) => {
      targetsRef.current.set(id, { label: tgtLabel, getRect })
      return () => {
        targetsRef.current.delete(id)
      }
    },
    [],
  )

  const isLegal = useCallback((id: string) => legalTargets.has(id), [legalTargets])

  const armSource = useCallback(
    (id: string) => {
      setArmed(id)
      setHovered(null)
      const srcLabel = sourcesRef.current.get(id)?.label ?? id
      const n = targetsRef.current.size
      setAnnouncement(
        `${srcLabel} selected. ${n} target${n === 1 ? "" : "s"} available. Choose a target.`,
      )
    },
    [setArmed, setHovered],
  )

  const chooseTarget = useCallback(
    (id: string) => {
      const from = armedRef.current
      if (from == null) return
      setHovered(null)
      setArmed(null)
      if (!targetsRef.current.has(id)) {
        setAnnouncement("Snapped back, no change.")
        return
      }
      onRewire(from, id)
      const srcLabel = sourcesRef.current.get(from)?.label ?? from
      const tgtLabel = targetsRef.current.get(id)?.label ?? id
      setAnnouncement(`Rewired ${srcLabel} to ${tgtLabel}.`)
    },
    [onRewire, setArmed, setHovered],
  )

  const cancel = useCallback(() => {
    if (armedRef.current == null) return
    setArmed(null)
    setHovered(null)
    setAnnouncement("Snapped back, no change.")
  }, [setArmed, setHovered])

  const orderedTargetIds = useCallback(() => [...targetsRef.current.keys()], [])

  const targetRects = useCallback((): TargetRect[] => {
    const rects: TargetRect[] = []
    for (const [id, entry] of targetsRef.current) {
      const r = entry.getRect()
      if (r) rects.push({ id, left: r.left, top: r.top, right: r.right, bottom: r.bottom })
    }
    return rects
  }, [])

  /* ------------------------------- pointer drag ------------------------------ */

  // Mirror the latest action closures so the window listeners (captured once at
  // drag start) always call the current versions without re-subscribing.
  const chooseTargetRef = useRef(chooseTarget)
  chooseTargetRef.current = chooseTarget
  const cancelRef = useRef(cancel)
  cancelRef.current = cancel
  const targetRectsRef = useRef(targetRects)
  targetRectsRef.current = targetRects

  const dragRef = useRef<DragState | null>(null)
  // A non-tap activation (a finished drag, or a keyboard confirm) leaves a
  // trailing synthetic `click` on the source that would re-arm it. We swallow
  // exactly that one click with a one-shot flag — set when such a gesture ends,
  // consumed by the next click, and cleared on any fresh pointerdown. A genuine
  // tap is always preceded by its own pointerdown (which clears the flag), so it
  // never gets suppressed; this is gesture-scoped, so it can't leak across beats
  // the way a time window does.
  const suppressClickRef = useRef(false)

  const beginSourceDrag = useCallback(
    (from: string, x: number, y: number, pointerId: number, el: HTMLElement | null) => {
      if (dragRef.current) return
      // A fresh pointer gesture: clear any stale suppression so a genuine tap
      // always arms (a synthetic activation-click has no preceding pointerdown).
      suppressClickRef.current = false

      const finish = () => {
        dragRef.current?.teardown()
        dragRef.current = null
      }

      const onMove = (e: PointerEvent) => {
        const d = dragRef.current
        if (!d || e.pointerId !== d.pointerId) return
        if (!d.active) {
          if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) {
            return
          }
          d.active = true
          d.rects = targetRectsRef.current()
          setArmed(from)
        }
        // Publish the live offset so the source can follow the pointer; the drop
        // target is still resolved purely from geometry below.
        setDragVisual({ from, dx: e.clientX - d.startX, dy: e.clientY - d.startY })
        setHovered(resolveDropTarget({ x: e.clientX, y: e.clientY }, d.rects, DROP_TOLERANCE))
      }

      const onUp = (e: PointerEvent) => {
        const d = dragRef.current
        if (!d || e.pointerId !== d.pointerId) return
        finish()
        setDragVisual(null) // release the follow; the source glides home
        if (!d.active) return // a press without travel — leave it to the tap path
        suppressClickRef.current = true // swallow the drag's trailing click
        const hit = resolveDropTarget({ x: e.clientX, y: e.clientY }, d.rects, DROP_TOLERANCE)
        if (hit) chooseTargetRef.current(hit)
        else cancelRef.current()
      }

      const onCancel = (e: PointerEvent) => {
        const d = dragRef.current
        if (!d || e.pointerId !== d.pointerId) return
        finish()
        setDragVisual(null) // release the follow; the source glides home
        if (d.active) {
          suppressClickRef.current = true // swallow the drag's trailing click
          cancelRef.current()
        }
      }

      const teardown = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
        window.removeEventListener("pointercancel", onCancel)
      }

      dragRef.current = { from, pointerId, startX: x, startY: y, active: false, rects: [], teardown }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
      window.addEventListener("pointercancel", onCancel)
      try {
        el?.setPointerCapture?.(pointerId)
      } catch {
        // jsdom / unsupported — window listeners already cover the gesture.
      }
    },
    [setArmed, setHovered],
  )

  const tapSource = useCallback(
    (id: string) => {
      // Swallow a single synthetic click trailing a drag-end / keyboard confirm.
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        return
      }
      armSource(id)
    },
    [armSource],
  )

  useEffect(() => () => dragRef.current?.teardown(), [])

  /* --------------------------------- keyboard -------------------------------- */

  const moveHover = useCallback(
    (dir: 1 | -1) => {
      const ids = [...targetsRef.current.keys()]
      const next = cycleTarget(hoveredRef.current, ids, dir)
      setHovered(next)
      if (next != null) {
        const tgtLabel = targetsRef.current.get(next)?.label ?? next
        setAnnouncement(`${tgtLabel}${legalTargets.has(next) ? ", available" : ""}.`)
      }
    },
    [legalTargets, setHovered],
  )

  const confirmKeyboard = useCallback(() => {
    const hovered = hoveredRef.current
    if (hovered == null) {
      setAnnouncement("Use the arrow keys to choose a target, then press Enter.")
      return
    }
    // Enter/Space on the source fires a trailing synthetic click — swallow it so
    // it doesn't re-arm the source after we commit.
    suppressClickRef.current = true
    chooseTarget(hovered)
  }, [chooseTarget])

  const value = useMemo<RewireContextValue>(
    () => ({
      registerSource,
      registerTarget,
      legalTargets,
      isLegal,
      armedSource,
      hoveredTarget,
      dragVisual,
      armSource,
      tapSource,
      beginSourceDrag,
      chooseTarget,
      setHovered,
      moveHover,
      confirmKeyboard,
      cancel,
      orderedTargetIds,
      targetRects,
    }),
    [
      registerSource,
      registerTarget,
      legalTargets,
      isLegal,
      armedSource,
      hoveredTarget,
      dragVisual,
      armSource,
      tapSource,
      beginSourceDrag,
      chooseTarget,
      setHovered,
      moveHover,
      confirmKeyboard,
      cancel,
      orderedTargetIds,
      targetRects,
    ],
  )

  return (
    <RewireContext value={value}>
      <div
        data-testid="rewire-surface"
        role="group"
        aria-label={label}
        className={cn("relative", className)}
        onClick={cancel}
      >
        {children}
        <div aria-live="polite" role="status" className="sr-only">
          {announcement}
        </div>
      </div>
    </RewireContext>
  )
}
