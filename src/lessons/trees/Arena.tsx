import { useEffect, useState, type CSSProperties, type Dispatch, type ReactNode } from "react"
import { RotateCcw } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { StatusChip } from "@/components/willow/StatusChip"
import type { Feedback, LessonAction, QuestionCopy } from "@/features/lesson/engine"
import { inorderKeys, type TreeNode } from "@/features/lesson/treesEngine"
import { NODE_H, NODE_W, tidyLayout } from "./treeLayout"

/**
 * The tournament-bracket arena skin for Trees, themed after a college-basketball
 * championship bracket: a deep-navy header band with bold condensed athletic
 * type and a royal-blue / orange feather motif, set over a warm hardwood court
 * with faint court lines. It is a generic "Championship Bracket" mark, not any
 * trademarked logo or wordmark.
 *
 * It is a full-bleed, page-transforming arena (negative-margin bleed, themed
 * header, integrated prompt, themed footer dispatching the SAME actions, fills
 * the vertical space), like the Linked Lists Spotify immersion.
 *
 * Re-theming trick: the shell overrides the design-token CSS variables (`--card`,
 * `--foreground`, `--lilac-strong`, ...) for its whole subtree, so every
 * token-based child (the bracket figure, CostReadout, AnswerCard, SortedChain,
 * the meter) repaints to the arena palette automatically in both app themes,
 * while semantic success/danger tokens are untouched. The figure keeps its pure
 * logic + every `data-*` hook byte-for-byte; only the paint changes.
 */

const COURT_TOP = "#ddc596"
const COURT_BOTTOM = "#c8a76d"
const BAND_TOP = "#0b1f4d"
const BAND_BOTTOM = "#13286a"
const ROYAL = "#1d4ed8"
const ORANGE = "#f97316"

/** Shared arena ink colors for the (non-token) copy the Stage paints on court. */
export const ARENA_COLORS = {
  ink: "#0b1f4d",
  body: "#1f2937",
  muted: "#44403c",
  royal: ROYAL,
  orange: ORANGE,
}

/** Arena palette mapped onto the design tokens the figure already uses. */
const ARENA_VARS = {
  "--card": "#ffffff",
  "--foreground": "#0b1f4d",
  "--muted": "#e8dec8",
  "--muted-foreground": "#44403c",
  "--faint": "#a8a29e",
  "--border": "#cbd5e1",
  "--lilac": "#2563eb",
  "--lilac-foreground": "#ffffff",
  "--lilac-strong": ROYAL,
  "--lilac-soft": "#dbeafe",
} as CSSProperties

export interface ArenaQuota {
  label: string
  done: number
  total: number
}

/** The full-bleed arena page. `footer` pins to the bottom; `children` centers. */
export function ArenaShell({
  eyebrow,
  title,
  quota,
  children,
  footer,
  reducedMotion,
}: {
  eyebrow: string
  title: string
  quota?: ArenaQuota | null
  children: ReactNode
  footer: ReactNode
  reducedMotion?: boolean
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false
  return (
    <motion.div
      data-testid="bracket-arena"
      data-reduced-motion={reduced ? "1" : undefined}
      style={{
        ...ARENA_VARS,
        background: `linear-gradient(180deg, ${COURT_TOP} 0%, ${COURT_BOTTOM} 100%)`,
        color: ARENA_COLORS.ink,
      }}
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
      className="relative -mx-5 -mb-6 flex flex-1 flex-col overflow-hidden pb-6"
    >
      <CourtLines />
      <div className="relative z-10 flex flex-1 flex-col">
        <ArenaHeader eyebrow={eyebrow} title={title} quota={quota} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-4">
          {children}
        </div>
        <div className="px-5">{footer}</div>
      </div>
    </motion.div>
  )
}

/** Faint basketball-court markings under the bracket (decorative). */
function CourtLines() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 100 170"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      style={{ opacity: 0.16 }}
    >
      <g fill="none" stroke="#fffaf0" strokeWidth="0.7">
        <rect x="4" y="4" width="92" height="162" rx="3" />
        <line x1="4" y1="85" x2="96" y2="85" />
        <circle cx="50" cy="85" r="13" />
        <rect x="34" y="4" width="32" height="32" />
        <rect x="34" y="134" width="32" height="32" />
        <path d="M34 36 a16 16 0 0 0 32 0" />
        <path d="M34 134 a16 16 0 0 1 32 0" />
      </g>
    </svg>
  )
}

/** The royal-blue feather / comb motif with an orange dash (generic, not a logo). */
function FeatherMark() {
  return (
    <span className="flex flex-col gap-[2.5px]" aria-hidden>
      <span className="block h-[3px] w-4 rounded-full" style={{ backgroundColor: ORANGE }} />
      <span className="block h-[3px] w-2.5 rounded-full" style={{ backgroundColor: ROYAL }} />
      <span className="block h-[3px] w-5 rounded-full" style={{ backgroundColor: ROYAL }} />
    </span>
  )
}

function ArenaHeader({
  eyebrow,
  title,
  quota,
}: {
  eyebrow: string
  title: string
  quota?: ArenaQuota | null
}) {
  return (
    <div
      className="relative px-5 pb-4 pt-5 text-white"
      style={{ background: `linear-gradient(180deg, ${BAND_TOP} 0%, ${BAND_BOTTOM} 100%)` }}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <FeatherMark />
          <span
            className="text-[11px] font-black uppercase italic tracking-[0.2em]"
            style={{ color: ORANGE, fontStretch: "condensed" }}
          >
            {eyebrow}
          </span>
        </span>
        {quota && (
          <span className="text-[11px] font-bold uppercase tracking-wide text-white/70">
            {quota.label} {quota.done}/{quota.total}
          </span>
        )}
      </div>
      <h2
        className="mx-auto mt-1.5 max-w-sm text-balance text-center text-lg font-extrabold leading-tight text-white"
        style={{ fontStretch: "condensed" }}
      >
        {title}
      </h2>
      <span
        className="absolute inset-x-0 bottom-0 block h-[3px]"
        style={{ backgroundColor: ORANGE }}
        aria-hidden
      />
    </div>
  )
}

/* --------------------------------- buttons -------------------------------- */

export function ArenaButton({
  children,
  onClick,
  disabled,
  tone = "primary",
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: "primary" | "ghost"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full rounded-full py-3.5 text-center text-[15px] font-black uppercase tracking-wide outline-none transition-transform",
        "focus-visible:ring-2 focus-visible:ring-[#0b1f4d] focus-visible:ring-offset-2 active:scale-[0.99] disabled:opacity-40",
        tone === "primary" ? "text-[#0b1f4d]" : "border-2 text-white",
      )}
      style={
        tone === "primary"
          ? { backgroundColor: ORANGE }
          : { borderColor: "rgba(255,255,255,0.3)", backgroundColor: "transparent" }
      }
    >
      {children}
    </button>
  )
}

/** A Continue footer for the ungraded beats (demo + teach). */
export function ArenaContinue({
  onClick,
  label = "Continue",
  hint,
}: {
  onClick: () => void
  label?: string
  hint?: string
}) {
  return (
    <div className="mt-auto pt-2">
      {hint && (
        <p className="mb-3 text-center text-sm font-medium" style={{ color: ARENA_COLORS.body }}>
          {hint}
        </p>
      )}
      <ArenaButton onClick={onClick}>{label}</ArenaButton>
    </div>
  )
}

/**
 * The graded footer: same verdict machine as the shared FeedbackFooter (idle ->
 * Check, nudge -> Check, correct -> Continue/next, fail -> Why/Reattempt), so the
 * tracer's button names and dispatched actions are unchanged. Feedback is shown
 * via the shared StatusChip (icon + text, never color alone) plus an SR status.
 */
export function ArenaFooter({
  feedback,
  showWhy,
  canCheck,
  copy,
  dispatch,
}: {
  feedback: Feedback
  showWhy: boolean
  canCheck: boolean
  copy: QuestionCopy
  dispatch: Dispatch<LessonAction>
}) {
  return (
    <div className="mt-auto min-h-[132px] pt-2">
      {feedback === "idle" && (
        <>
          <p className="mb-3 text-center text-sm font-medium" style={{ color: ARENA_COLORS.body }}>
            {copy.hint}
          </p>
          <ArenaButton disabled={!canCheck} onClick={() => dispatch({ type: "check" })}>
            Check
          </ArenaButton>
        </>
      )}

      {feedback === "nudge" && (
        <>
          <div className="mb-3 flex flex-col items-center gap-2 text-center">
            <StatusChip status="hint" />
            <p className="text-sm font-medium" style={{ color: ARENA_COLORS.body }}>
              {copy.nudge}
            </p>
          </div>
          <ArenaButton disabled={!canCheck} onClick={() => dispatch({ type: "check" })}>
            Check
          </ArenaButton>
        </>
      )}

      {feedback === "correct" && (
        <>
          <div className="mb-3 flex flex-col items-center gap-2 text-center">
            <StatusChip status="correct" />
            <p className="text-sm font-medium" style={{ color: ARENA_COLORS.body }}>
              {copy.correct}
            </p>
          </div>
          <ArenaButton onClick={() => dispatch({ type: "next" })}>Continue</ArenaButton>
        </>
      )}

      {feedback === "fail" && (
        <>
          <div className="mb-3 flex flex-col items-center gap-2 text-center">
            <StatusChip status="fail" />
            <p
              className={showWhy ? "text-sm font-medium" : "sr-only"}
              style={showWhy ? { color: ARENA_COLORS.body } : undefined}
              role="status"
            >
              {showWhy ? copy.why : "Try again. Tap Why for the answer, or reattempt."}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={showWhy}
              onClick={() => dispatch({ type: "reveal" })}
              className="flex-1 rounded-full border-2 py-3.5 font-bold uppercase tracking-wide outline-none transition-colors disabled:opacity-40"
              style={{ borderColor: "rgba(11,31,77,0.3)", color: ARENA_COLORS.ink }}
            >
              Why?
            </button>
            <div className="flex-1">
              <ArenaButton onClick={() => dispatch({ type: "reattempt" })}>Reattempt</ArenaButton>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ----------------------------- rebalance flourish ------------------------- */

/**
 * The compare-shape teaching flourish: a lopsided "stick" bracket visibly
 * straightening into a fair, balanced one (same seeds). Presentational only, no
 * verdict: it sets up "a BST that degrades into a line is just a slow linked
 * list." Reduced motion starts already balanced; a Replay button re-runs it.
 */
export function RebalanceBracket({
  balanced,
  stick,
  reducedMotion,
}: {
  balanced: TreeNode
  stick: TreeNode
  reducedMotion?: boolean
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false
  const [isBalanced, setIsBalanced] = useState(reduced)

  useEffect(() => {
    if (reduced) {
      setIsBalanced(true)
      return
    }
    setIsBalanced(false)
    const id = setTimeout(() => setIsBalanced(true), 450)
    return () => clearTimeout(id)
  }, [reduced])

  const balLayout = tidyLayout(balanced)
  const stickLayout = tidyLayout(stick)
  const balByKey = positionsByKey(balanced, balLayout)
  const stickByKey = positionsByKey(stick, stickLayout)
  const keys = inorderKeys(balanced)
  const figW = Math.max(balLayout.width, stickLayout.width)
  const figH = Math.max(balLayout.height, stickLayout.height)

  const transition = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 150, damping: 20 }

  return (
    <div data-testid="rebalance-bracket" className="flex w-full flex-col items-center gap-2">
      <div className="relative" style={{ width: figW, height: figH }}>
        <BracketLines tree={stick} byKey={stickByKey} on={!isBalanced} color="#a8a29e" reduced={reduced} />
        <BracketLines tree={balanced} byKey={balByKey} on={isBalanced} color={ROYAL} reduced={reduced} />
        {keys.map((k) => {
          const from = stickByKey.get(k)!
          const to = balByKey.get(k)!
          const target = isBalanced ? to : from
          return (
            <motion.div
              key={k}
              initial={false}
              animate={{ left: target.x - NODE_W / 2, top: target.y - NODE_H / 2 }}
              transition={transition}
              className="absolute flex items-center justify-center rounded-xl border-2 text-sm font-bold"
              style={{
                width: NODE_W,
                height: NODE_H,
                backgroundColor: "#ffffff",
                borderColor: isBalanced ? ROYAL : "#cbd5e1",
                color: ARENA_COLORS.ink,
              }}
            >
              {k}
            </motion.div>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold" style={{ color: ARENA_COLORS.muted }}>
          {isBalanced ? "Rebalanced: every seed within reach" : "Lopsided: a bracket gone stringy"}
        </span>
        <button
          type="button"
          onClick={() => {
            setIsBalanced(false)
            if (!reduced) setTimeout(() => setIsBalanced(true), 120)
            else setIsBalanced(true)
          }}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold uppercase tracking-wide text-white"
          style={{ backgroundColor: ARENA_COLORS.ink }}
        >
          <RotateCcw className="size-3" aria-hidden /> Replay
        </button>
      </div>
    </div>
  )
}

function BracketLines({
  tree,
  byKey,
  on,
  color,
  reduced,
}: {
  tree: TreeNode
  byKey: Map<number, { x: number; y: number }>
  on: boolean
  color: string
  reduced: boolean
}) {
  const segs: { a: { x: number; y: number }; b: { x: number; y: number } }[] = []
  const walk = (n: TreeNode | null) => {
    if (!n) return
    const p = byKey.get(n.key)
    for (const c of [n.left, n.right]) {
      if (!c || !p) continue
      const cp = byKey.get(c.key)
      if (cp) segs.push({ a: p, b: cp })
    }
    walk(n.left)
    walk(n.right)
  }
  walk(tree)
  return (
    <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
      {segs.map((s, i) => (
        <motion.line
          key={i}
          initial={false}
          animate={{ opacity: on ? 1 : 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.3 }}
          x1={s.a.x}
          y1={s.a.y}
          x2={s.b.x}
          y2={s.b.y}
          stroke={color}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

function positionsByKey(
  tree: TreeNode,
  layout: { pos: Map<string, { x: number; y: number }> },
): Map<number, { x: number; y: number }> {
  const out = new Map<number, { x: number; y: number }>()
  const walk = (n: TreeNode | null) => {
    if (!n) return
    const p = layout.pos.get(n.id)
    if (p) out.set(n.key, p)
    walk(n.left)
    walk(n.right)
  }
  walk(tree)
  return out
}
