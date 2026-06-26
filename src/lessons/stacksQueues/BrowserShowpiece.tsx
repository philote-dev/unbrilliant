import type { Dispatch } from "react"
import { Check, ChevronLeft, ChevronRight, Lock, Plus, RotateCw, X } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import type { AnswerState } from "@/components/willow/AnswerCard"
import type { Feedback, LessonAction, QuestionCopy } from "@/features/lesson/engine"
import type { Cell } from "@/features/lesson/stacksQueuesEngine"
import { pageFor, type BrowserPage } from "./browserHistory"
import { RealWorldFooter } from "./RealWorldFooter"

/**
 * The Browser Back skin for the stack real-world predict. A full-bleed scene that
 * turns the whole page into a browser app: realistic chrome (tab strip + address
 * bar with Back / Forward) pinned at the top, and a History page filling the view
 * with the newest page on TOP. The history IS a stack: pages push onto the top,
 * and Back lifts the top page (the page you are on) off and slides it into the
 * Forward / redo stack. The page that leaves the top is the stack verdict, so the
 * dev-only data-answer hook sits on the top row and grading is unchanged.
 *
 * The chrome uses a fixed light palette (a deliberate "you are in a browser now"
 * takeover, like the Spotify skin's fixed dark) so it reads as a real browser in
 * either app theme. Choreography is presentational and driven by `popping` (the
 * Stage flips it a beat AFTER the verdict): the top row exits upward, the rest
 * reflow up (Framer `layout`), and the popped page appears in Forward. Reduced
 * motion snaps. The themed footer (rendered when `dispatch` is given) dispatches
 * the same actions as the shared FeedbackFooter.
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
  prompt,
  feedback,
  showWhy,
  canCheck,
  copy,
  dispatch,
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
  /** Integrated prompt, shown as the History page instruction. */
  prompt?: string
  /** Themed footer state (rendered only when dispatch is provided). */
  feedback?: Feedback
  showWhy?: boolean
  canCheck?: boolean
  copy?: QuestionCopy
  dispatch?: Dispatch<LessonAction>
  className?: string
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false

  const leaving = popping && answerId ? cells.find((c) => c.id === answerId) : undefined
  const historyCells = leaving ? cells.filter((c) => c.id !== leaving.id) : cells
  const forward = leaving ? [leaving] : []
  const currentCell = historyCells[0]
  const currentPage = currentCell ? pageFor(currentCell.id, arrival) : null

  const spring = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 360, damping: 30 }

  return (
    <motion.div
      data-testid="browser-showpiece"
      data-reduced-motion={reduced ? "1" : undefined}
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
      className={cn("-mx-5 -mb-6 flex flex-1 flex-col bg-[#dee1e6]", className)}
    >
      {/* Tab strip */}
      <div className="flex items-end gap-1 px-2 pt-2">
        <div className="flex min-w-0 max-w-[200px] flex-1 items-center gap-1.5 rounded-t-lg bg-white px-3 py-2">
          <Favicon page={currentPage} className="size-3.5" />
          <span className="truncate text-xs font-medium text-neutral-800">
            {currentPage?.title ?? "New tab"}
          </span>
          <X className="size-3 shrink-0 text-neutral-400" strokeWidth={2.5} aria-hidden />
        </div>
        <span
          className="flex size-6 items-center justify-center rounded-md text-neutral-500"
          aria-hidden
        >
          <Plus className="size-4" strokeWidth={2.5} />
        </span>
      </div>

      {/* Toolbar: Back / Forward / Reload + address bar. Inert (the learner answers
          by picking the page that leaves, not by pressing Back). */}
      <div className="flex items-center gap-2 bg-white px-3 py-2">
        <div className="flex items-center gap-1 text-neutral-600" aria-hidden>
          <motion.span
            data-testid="browser-back-btn"
            className="flex size-7 items-center justify-center rounded-full text-[#1a73e8]"
            animate={popping && !reduced ? { scale: [1, 0.8, 1] } : { scale: 1 }}
            transition={{ duration: 0.32 }}
          >
            <ChevronLeft className="size-5" strokeWidth={2.5} />
          </motion.span>
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full",
              forward.length > 0 ? "text-[#1a73e8]" : "text-neutral-300",
            )}
          >
            <ChevronRight className="size-5" strokeWidth={2.5} />
          </span>
          <span className="flex size-7 items-center justify-center rounded-full text-neutral-400">
            <RotateCw className="size-4" strokeWidth={2.5} />
          </span>
        </div>
        <div
          data-testid="browser-address"
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-[#f1f3f4] px-3 py-1.5"
        >
          <Lock className="size-3 shrink-0 text-neutral-500" strokeWidth={2.5} aria-hidden />
          <span className="truncate text-[12px] font-medium text-neutral-600">
            {currentPage?.url ?? "about:newtab"}
          </span>
        </div>
      </div>

      {/* The page: a History view, newest on top. */}
      <div className="flex flex-1 flex-col overflow-y-auto bg-white px-4 pt-3">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-bold text-neutral-900">History</h1>
          <span className="text-[11px] font-medium text-neutral-400">newest on top</span>
        </div>
        {prompt && (
          <div className="mt-2 rounded-xl bg-[#e8f0fe] px-3.5 py-2.5 ring-1 ring-inset ring-[#1a73e8]/30">
            <p className="text-[15px] font-semibold leading-snug text-neutral-900">{prompt}</p>
          </div>
        )}

        <div data-testid="browser-history" className="mt-3 flex flex-col gap-1.5">
          <AnimatePresence initial={false} mode="popLayout">
            {historyCells.map((c, i) => (
              <PageRow
                key={c.id}
                cell={c}
                page={pageFor(c.id, arrival)}
                isTop={i === 0}
                time={visitTimeLabel(c.id, arrival)}
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
        <div className="mt-3 flex items-center gap-2 border-t border-neutral-100 pt-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
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
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1"
                >
                  <Favicon page={pageFor(c.id, arrival)} className="size-3" />
                  <span className="text-[11px] font-semibold text-neutral-600">
                    {pageFor(c.id, arrival).title}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {dispatch && copy && feedback !== undefined && (
        <RealWorldFooter
          variant="browser"
          feedback={feedback}
          showWhy={!!showWhy}
          canCheck={!!canCheck}
          copy={copy}
          dispatch={dispatch}
        />
      )}
    </motion.div>
  )
}

const ROW: Record<AnswerState, string> = {
  default: "border-neutral-200 bg-white",
  selected: "border-[#1a73e8] bg-[#e8f0fe] ring-2 ring-[#1a73e8]/20",
  correct: "border-emerald-500 bg-emerald-50",
  nudge: "border-amber-500 bg-amber-50",
  fail: "border-red-500 bg-red-50",
}

// History rows show when each page was visited. The most-recently visited page
// sits on top (the stack), so times descend down the list. Deterministic (no
// clock): the time is derived from the page's recency in the visit/arrival order.
const VISIT_BASE_MIN = 16 * 60 + 21 // 4:21 PM
const VISIT_MINS_AGO = [0, 3, 7, 12, 18, 25, 33, 42] // by recency rank (0 = newest)

function visitTimeLabel(id: string, arrival: string[]): string {
  const j = arrival.indexOf(id)
  const rank = j < 0 ? 0 : arrival.length - 1 - j
  const t = VISIT_BASE_MIN - VISIT_MINS_AGO[Math.min(rank, VISIT_MINS_AGO.length - 1)]
  const h24 = Math.floor(t / 60)
  const m = ((t % 60) + 60) % 60
  const h12 = ((h24 + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`
}

function PageRow({
  cell,
  page,
  isTop,
  time,
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
  time?: string
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
        "focus-visible:ring-2 focus-visible:ring-[#1a73e8]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        ROW[state],
        selectable && "cursor-pointer hover:border-[#1a73e8]/50",
      )}
    >
      <Favicon page={page} className="size-7 shrink-0 rounded-md" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-neutral-900">{page.title}</span>
        <span className="block truncate text-[11px] text-neutral-500">{page.url}</span>
      </span>
      {time && (
        <span aria-hidden className="shrink-0 text-[11px] tabular-nums text-neutral-400">
          {time}
        </span>
      )}
      {state === "correct" && (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
      {state === "fail" && (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
          <X className="size-3" strokeWidth={3} />
        </span>
      )}
    </motion.button>
  )
}

function Favicon({ page, className }: { page: BrowserPage | null; className?: string }) {
  if (page?.icon) {
    const Icon = page.icon
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white",
          className,
        )}
      >
        <Icon className="size-full" />
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 rounded-sm", className)}
      style={
        page
          ? { backgroundImage: `linear-gradient(135deg, ${page.accent[0]}, ${page.accent[1]})` }
          : { background: "#e5e7eb" }
      }
    />
  )
}
