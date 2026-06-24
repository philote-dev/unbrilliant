import { Check, ChevronLeft, ChevronRight, Lock, RotateCw, X } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import type { AnswerState } from "@/components/willow/AnswerCard"
import type { Cell } from "@/features/lesson/stacksQueuesEngine"
import { pageFor, type BrowserPage } from "./browserHistory"

/**
 * The Browser Back skin for the stack real-world predict, rendered as a real
 * browser window: a tab strip, an address bar with Back / Forward, and a
 * vertical history list with the newest page on TOP. The history IS a stack:
 * pages push onto the top, and Back lifts the top page (the page you are on) off
 * and slides it into the Forward / redo stack. The page that leaves the top is
 * the stack verdict, so the dev-only data-answer hook sits on the top row and
 * the grading is unchanged.
 *
 * Choreography is presentational and driven by `popping` (the Stage flips it a
 * beat AFTER the correct/why verdict, never with it, so the green "correct"
 * state is seen first and the leave reads cleanly): the top row exits upward,
 * the rest of the history reflows up (Framer `layout`), and the popped page
 * appears in Forward. Reduced motion snaps: no transitions, the end-state is
 * shown at once.
 */
export function BrowserShowpiece({
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
  cells: Cell[] // container order: index 0 = the current page (top of history)
  arrival: string[] // arrival order, for the page catalogue identity
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

  // While popping, the top page (the answer) leaves the history and lands in the
  // Forward stack. The address bar follows the page you'd land on after Back.
  const leaving = popping && answerId ? cells.find((c) => c.id === answerId) : undefined
  const historyCells = leaving ? cells.filter((c) => c.id !== leaving.id) : cells
  const forward = leaving ? [leaving] : []
  const currentCell = historyCells[0]
  const currentPage = currentCell ? pageFor(currentCell.id, arrival) : null

  const spring = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 360, damping: 30 }

  return (
    <div
      data-testid="browser-showpiece"
      data-reduced-motion={reduced ? "1" : undefined}
      className={cn(
        "flex w-full max-w-[320px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft",
        className,
      )}
    >
      {/* Tab strip */}
      <div className="flex items-end gap-1 bg-muted/60 px-2 pt-2">
        <div className="flex min-w-0 max-w-[180px] items-center gap-1.5 rounded-t-lg bg-card px-2.5 py-1.5 shadow-[0_-1px_2px_rgba(0,0,0,0.04)]">
          <Favicon page={currentPage} className="size-3.5" />
          <span className="truncate text-xs font-medium text-foreground">
            {currentPage?.title ?? "New tab"}
          </span>
          <X className="size-3 shrink-0 text-faint" strokeWidth={2.5} aria-hidden />
        </div>
        <span className="px-1 pb-1 text-sm font-medium text-faint" aria-hidden>
          +
        </span>
      </div>

      {/* Toolbar: Back / Forward / Reload + address bar. Inert (the learner answers
          by picking the page that leaves, not by pressing Back). */}
      <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
        <div className="flex items-center gap-0.5 text-muted-foreground" aria-hidden>
          <motion.span
            data-testid="browser-back-btn"
            className="flex size-7 items-center justify-center rounded-full text-lilac-strong"
            animate={popping && !reduced ? { scale: [1, 0.82, 1] } : { scale: 1 }}
            transition={{ duration: 0.32 }}
          >
            <ChevronLeft className="size-5" strokeWidth={2.5} />
          </motion.span>
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full",
              forward.length > 0 ? "text-lilac-strong" : "text-faint/50",
            )}
          >
            <ChevronRight className="size-5" strokeWidth={2.5} />
          </span>
          <span className="flex size-7 items-center justify-center rounded-full text-faint">
            <RotateCw className="size-4" strokeWidth={2.5} />
          </span>
        </div>
        <div
          data-testid="browser-address"
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1.5"
        >
          <Lock className="size-3 shrink-0 text-faint" strokeWidth={2.5} aria-hidden />
          <span className="truncate text-[11px] font-medium text-muted-foreground">
            {currentPage?.url ?? "about:newtab"}
          </span>
        </div>
      </div>

      {/* History list: newest on top. */}
      <div className="flex flex-col gap-2 p-2.5">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-faint">
            History
          </span>
          <span className="text-[10px] font-medium text-faint">newest on top</span>
        </div>

        <div data-testid="browser-history" className="flex flex-col gap-1.5">
          <AnimatePresence initial={false} mode="popLayout">
            {historyCells.map((c, i) => (
              <PageRow
                key={c.id}
                cell={c}
                page={pageFor(c.id, arrival)}
                isTop={i === 0}
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

        {/* Forward / redo: the page Back just lifted off the top. */}
        <div className="flex items-center gap-2 px-0.5 pt-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-faint">
            Forward
          </span>
          <div data-testid="browser-forward" className="min-h-7 flex-1">
            <AnimatePresence initial={false}>
              {forward.map((c) => (
                <motion.div
                  key={c.id}
                  data-cell={c.id}
                  initial={reduced ? false : { opacity: 0, y: -10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduced ? undefined : { opacity: 0, scale: 0.9 }}
                  transition={spring}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-2 py-1"
                >
                  <Favicon page={pageFor(c.id, arrival)} className="size-3" />
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {pageFor(c.id, arrival).title}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

const ROW_SURFACE: Record<AnswerState, string> = {
  default: "border-border bg-card",
  selected: "border-lilac-strong bg-lilac-soft ring-2 ring-lilac-strong/20",
  correct: "border-success bg-success-soft",
  nudge: "border-warning bg-warning-soft",
  fail: "border-danger bg-danger-soft",
}

function PageRow({
  cell,
  page,
  isTop,
  state,
  selectable,
  onSelect,
  isAnswer,
  reduced,
  spring,
}: {
  cell: Cell
  page: BrowserPage
  isTop: boolean
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
        selectable
          ? `${page.title}, ${page.url}${isTop ? ", the page you are on now" : ""}`
          : `${page.title}, ${page.url}`
      }
      initial={reduced ? false : { opacity: 0, y: -10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -26, scale: 0.92 }}
      transition={spring}
      whileTap={selectable ? { scale: 0.99 } : undefined}
      className={cn(
        "relative flex min-h-11 w-full items-center gap-2.5 rounded-xl border-2 px-2.5 py-1.5 text-left outline-none",
        "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        ROW_SURFACE[state],
        selectable && "cursor-pointer hover:border-lilac-strong/45",
      )}
    >
      <Favicon page={page} className="size-7 shrink-0 rounded-md" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">
          {page.title}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">{page.url}</span>
      </span>
      {state === "correct" && (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-white">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
      {state === "fail" && (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-danger text-white">
          <X className="size-3" strokeWidth={3} />
        </span>
      )}
    </motion.button>
  )
}

function Favicon({ page, className }: { page: BrowserPage | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 rounded-sm", className)}
      style={
        page
          ? { backgroundImage: `linear-gradient(135deg, ${page.accent[0]}, ${page.accent[1]})` }
          : { background: "var(--muted)" }
      }
    />
  )
}
