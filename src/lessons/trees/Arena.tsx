import { useEffect, useState, type CSSProperties, type Dispatch, type ReactNode } from "react"
import { RotateCcw, Trophy } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { StatusChip } from "@/components/willow/StatusChip"
import type { Feedback, LessonAction, QuestionCopy } from "@/features/lesson/engine"
import { inorderKeys, type TreeNode } from "@/features/lesson/treesEngine"
import { NODE_H, NODE_W, tidyLayout } from "./treeLayout"

/**
 * The tournament-bracket ("March Madness") skin for Trees: a full-bleed, page
 * transforming arena that the interactive beats render inside, mirroring the
 * Linked Lists Spotify immersion (negative-margin bleed, themed header band,
 * integrated prompt, themed footer dispatching the SAME actions, fills the
 * vertical space).
 *
 * Re-theming trick: instead of hardcoding colors into the figure, the shell
 * overrides the design-token CSS variables (`--card`, `--foreground`,
 * `--lilac-strong`, ...) for its whole subtree. Every token-based child
 * (TreeFigure, CostReadout, AnswerCard, SortedChain, the meter) re-skins to the
 * arena palette automatically, in both app themes, while semantic success/danger
 * tokens are left untouched. So the bracket figure keeps its logic + e2e
 * `data-*` hooks byte-for-byte; only the paint changes.
 */

const ARENA_SHEET = "#eef2f7"
const ARENA_INK = "#102a43"
const ARENA_BAND = "#0f2a4a"
const ARENA_ACCENT = "#f59e0b"
const ARENA_HINT = "#475569"

/** Arena palette mapped onto the design tokens the figure already uses. */
const ARENA_VARS = {
  "--card": "#ffffff",
  "--foreground": ARENA_INK,
  "--muted": "#e2e8f0",
  "--muted-foreground": "#64748b",
  "--faint": "#94a3b8",
  "--border": "#cbd5e1",
  "--lilac": ARENA_ACCENT,
  "--lilac-foreground": "#1f2937",
  "--lilac-strong": "#d97706",
  "--lilac-soft": "#fef3c7",
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
      style={{ ...ARENA_VARS, backgroundColor: ARENA_SHEET, color: ARENA_INK }}
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
      className="-mx-5 -mb-6 flex flex-1 flex-col pb-6"
    >
      <ArenaHeader eyebrow={eyebrow} title={title} quota={quota} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-4">
        {children}
      </div>
      <div className="px-5">{footer}</div>
    </motion.div>
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
    <div className="px-5 pb-4 pt-5 text-white" style={{ backgroundColor: ARENA_BAND }}>
      <div className="flex items-center justify-between">
        <span
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{ color: ARENA_ACCENT }}
        >
          <Trophy className="size-3.5" aria-hidden />
          {eyebrow}
        </span>
        {quota && (
          <span className="text-[11px] font-semibold text-white/70">
            {quota.label} {quota.done}/{quota.total}
          </span>
        )}
      </div>
      <h2 className="mx-auto mt-1.5 max-w-sm text-balance text-center text-lg font-extrabold leading-tight">
        {title}
      </h2>
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
        "w-full rounded-full py-3.5 text-center text-[15px] font-bold outline-none transition-transform",
        "focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.99] disabled:opacity-40",
        tone === "primary" ? "text-[#1f2937]" : "border-2 text-white",
      )}
      style={
        tone === "primary"
          ? { backgroundColor: ARENA_ACCENT }
          : { borderColor: "rgba(255,255,255,0.25)", backgroundColor: "transparent" }
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
      {hint && <p className="mb-3 text-center text-sm" style={{ color: ARENA_HINT }}>{hint}</p>}
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
          <p className="mb-3 text-center text-sm" style={{ color: ARENA_HINT }}>
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
            <p className="text-sm" style={{ color: ARENA_HINT }}>
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
            <p className="text-sm" style={{ color: ARENA_HINT }}>
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
              className={showWhy ? "text-sm" : "sr-only"}
              style={showWhy ? { color: ARENA_HINT } : undefined}
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
              className="flex-1 rounded-full border-2 py-3.5 font-semibold text-white outline-none transition-colors disabled:opacity-40"
              style={{ borderColor: "rgba(15,42,74,0.25)", color: ARENA_BAND }}
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
  // Position every seed (by key) in both layouts so the cards can glide between.
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
        <BracketLines tree={stick} byKey={stickByKey} on={!isBalanced} reduced={reduced} />
        <BracketLines tree={balanced} byKey={balByKey} on={isBalanced} reduced={reduced} />
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
              className="absolute flex items-center justify-center rounded-lg border-2 text-sm font-bold"
              style={{
                width: NODE_W,
                height: NODE_H,
                backgroundColor: "#ffffff",
                borderColor: "#cbd5e1",
                color: ARENA_INK,
              }}
            >
              {k}
            </motion.div>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold" style={{ color: ARENA_HINT }}>
          {isBalanced ? "Rebalanced: every seed within reach" : "Lopsided: a bracket gone stringy"}
        </span>
        <button
          type="button"
          onClick={() => {
            setIsBalanced(false)
            if (!reduced) setTimeout(() => setIsBalanced(true), 120)
            else setIsBalanced(true)
          }}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-white"
          style={{ backgroundColor: ARENA_BAND }}
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
  reduced,
}: {
  tree: TreeNode
  byKey: Map<number, { x: number; y: number }>
  on: boolean
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
          stroke="#94a3b8"
          strokeWidth={2.2}
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
