import { Check, UtensilsCrossed, X } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import type { AnswerState } from "@/components/willow/AnswerCard"
import type { Cell } from "@/features/lesson/stacksQueuesEngine"
import { carFor, type DriveThruCar } from "./driveThruCars"

/**
 * The drive-thru / toll-lane skin for the queue real-world predict, the PRIMARY
 * queue real-world skin (PrinterShowpiece stays as the fallback behind the
 * Stage's REALWORLD_QUEUE_SKIN switch). A street with a service window at the
 * FRONT (left); cars roll IN from the BACK (right) and the front car is served
 * first. This is FIFO made literal: the car that arrived first is at the window,
 * so it leaves first.
 *
 * The car at the window is the queue verdict, so the dev-only data-answer hook
 * sits on the front car and grading is unchanged. Choreography is presentational
 * and driven by `popping` (the Stage flips it a beat AFTER the correct/why
 * verdict, never with it): the front car pulls away past the window, the rest
 * roll forward (Framer `layout`), and the served car appears in the Served slot.
 * Reduced motion snaps to the end-state with no transitions.
 */
export function DriveThruLane({
  cells,
  arrival,
  selectable,
  cellState,
  onSelectCell,
  answerId,
  popping = false,
  reducedMotion,
  className,
}: {
  cells: Cell[] // container order: index 0 = the front (at the window)
  arrival: string[] // arrival order, for the car catalogue identity
  selectable?: boolean
  cellState?: (id: string) => AnswerState
  onSelectCell?: (id: string) => void
  answerId?: string
  popping?: boolean
  reducedMotion?: boolean
  className?: string
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false

  const leaving = popping && answerId ? cells.find((c) => c.id === answerId) : undefined
  const laneCells = leaving ? cells.filter((c) => c.id !== leaving.id) : cells
  const served = leaving ? [leaving] : []

  const spring = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 340, damping: 30 }

  return (
    <div
      data-testid="drivethru-lane"
      data-reduced-motion={reduced ? "1" : undefined}
      className={cn("flex w-full max-w-[330px] flex-col items-center gap-2", className)}
    >
      <div className="inline-flex items-center gap-1.5 rounded-full bg-lilac-soft px-3 py-1 text-xs font-semibold text-lilac-strong">
        <UtensilsCrossed className="size-3.5" strokeWidth={2.5} aria-hidden />
        Drive-thru
      </div>

      <div className="flex w-full items-stretch gap-1.5">
        {/* Service window at the FRONT (left). */}
        <div className="flex shrink-0 flex-col items-center justify-end">
          <ServiceWindow />
          <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-faint">
            Window
          </span>
        </div>

        {/* The lane (road) running front (left) to back (right). */}
        <div className="flex flex-1 flex-col">
          <div className="relative flex min-h-[88px] flex-1 items-center overflow-hidden rounded-xl border-y-2 border-border bg-muted/40 px-2">
            {/* dashed centre line */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-2 top-1/2 h-0 -translate-y-1/2 border-t-2 border-dashed border-border/70"
            />
            <div className="relative flex items-center gap-1">
              <AnimatePresence initial={false} mode="popLayout">
                {laneCells.map((c, i) => (
                  <CarChip
                    key={c.id}
                    cell={c}
                    car={carFor(c.id, arrival)}
                    atWindow={i === 0}
                    state={cellState?.(c.id) ?? "default"}
                    selectable={selectable}
                    onSelect={() => onSelectCell?.(c.id)}
                    isAnswer={answerId === c.id}
                    reduced={reduced}
                    spring={spring}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
          <span className="mt-1 self-end pr-1 text-[10px] font-medium text-faint">
            cars join at the back
          </span>
        </div>
      </div>

      {/* Served: the car the window just handed off. */}
      <div className="flex min-h-7 items-center gap-2 self-start pl-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-faint">Served</span>
        <div data-testid="drivethru-served">
          <AnimatePresence initial={false}>
            {served.map((c) => (
              <motion.div
                key={c.id}
                data-cell={c.id}
                initial={reduced ? false : { opacity: 0, x: -16, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={reduced ? undefined : { opacity: 0, scale: 0.9 }}
                transition={spring}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-2 py-1"
              >
                <CarGlyph car={carFor(c.id, arrival)} className="h-3.5 w-6" />
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {carFor(c.id, arrival).name}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

const BODY_RING: Record<AnswerState, string> = {
  default: "ring-2 ring-transparent",
  selected: "ring-2 ring-lilac-strong",
  correct: "ring-2 ring-success",
  nudge: "ring-2 ring-warning",
  fail: "ring-2 ring-danger",
}

function CarChip({
  cell,
  car,
  atWindow,
  state,
  selectable,
  onSelect,
  isAnswer,
  reduced,
  spring,
}: {
  cell: Cell
  car: DriveThruCar
  atWindow: boolean
  state: AnswerState
  selectable?: boolean
  onSelect?: () => void
  isAnswer?: boolean
  reduced: boolean
  spring: object
}) {
  return (
    <motion.button
      type="button"
      layout={reduced ? false : "position"}
      data-cell={cell.id}
      data-answer={isAnswer && import.meta.env.DEV ? "1" : undefined}
      disabled={!selectable}
      onClick={selectable ? onSelect : undefined}
      aria-pressed={state === "selected"}
      aria-label={
        `${car.name} car, ${car.order}` + (atWindow ? ", at the window" : "")
      }
      initial={reduced ? false : { opacity: 0, x: 44, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, x: -96, scale: 0.85 }}
      transition={spring}
      whileTap={selectable ? { scale: 0.97 } : undefined}
      className={cn(
        "relative flex min-h-11 w-12 flex-col items-center justify-center rounded-lg p-1 outline-none",
        "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selectable && "cursor-pointer",
        atWindow && "drop-shadow-[0_0_10px_var(--lilac-soft)]",
      )}
    >
      <span
        className={cn(
          "flex w-full items-center justify-center rounded-md px-1.5 py-1.5",
          BODY_RING[state],
        )}
        style={{ backgroundImage: `linear-gradient(135deg, ${car.accent[0]}, ${car.accent[1]})` }}
      >
        <span className="text-[11px] font-bold leading-none text-white drop-shadow">
          {car.name}
        </span>
      </span>
      {/* wheels */}
      <span aria-hidden className="mt-0.5 flex w-full justify-between px-1">
        <span className="size-1.5 rounded-full bg-foreground/70" />
        <span className="size-1.5 rounded-full bg-foreground/70" />
      </span>

      {state === "correct" && (
        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-success text-white">
          <Check className="size-2.5" strokeWidth={3} />
        </span>
      )}
      {state === "fail" && (
        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-danger text-white">
          <X className="size-2.5" strokeWidth={3} />
        </span>
      )}
    </motion.button>
  )
}

/** A tiny side-on car glyph for the Served chip (purely decorative). */
function CarGlyph({ car, className }: { car: DriveThruCar; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block rounded-sm", className)}
      style={{ backgroundImage: `linear-gradient(135deg, ${car.accent[0]}, ${car.accent[1]})` }}
    />
  )
}

function ServiceWindow() {
  return (
    <div aria-hidden className="flex flex-col items-center">
      {/* awning */}
      <div className="h-2 w-12 rounded-t-md bg-lilac-strong/80" />
      <div className="flex h-[72px] w-12 flex-col items-center justify-center rounded-b-md border-2 border-t-0 border-border bg-card">
        <div className="flex size-7 items-center justify-center rounded-sm bg-muted">
          <UtensilsCrossed className="size-4 text-lilac-strong" strokeWidth={2.5} />
        </div>
        <div className="mt-1 h-1.5 w-7 rounded-full bg-border" />
      </div>
    </div>
  )
}
