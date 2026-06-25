import type { Dispatch } from "react"
import { ArrowDown, ArrowUp, PartyPopper, Sparkles } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import type { LessonAction } from "@/features/lesson/engine"
import {
  correctNextStep,
  cursorNode,
  isTerminalTrees,
  nodeById,
  subtreeKeyRange,
  tappableChildren,
  type Side,
  type TreesState,
} from "@/features/lesson/treesEngine"

/**
 * The "guess my number" game-show skin for the real-world Locate beat. It is the
 * higher/lower number game made literal: the host has a secret in [treeMin,
 * treeMax]; a horizontal RANGE BAR shows the live candidate band (the cursor
 * subtree's key range, `subtreeKeyRange`), which collapses by ~half each guess.
 * THIS band is the work-meter for the beat (no Big-O). The two children of the
 * cursor are rendered as "Guess lower (4)" / "Guess higher (12)" buttons that
 * dispatch `select(childId)` exactly as a node tap would; the correct one keeps
 * the dev-only `data-answer="1"` so the e2e tracer is unchanged.
 *
 * PRESENTATIONAL + deterministic: the band, the verdict chip, the log, and the
 * marker all derive from pure selectors (`descendPath` via `correctNextStep`,
 * `cursorNode`, `subtreeKeyRange`); the skin only ever dispatches `select` and
 * reads state. It never dispatches `check` and never sets feedback, so it cannot
 * disagree with the engine verdict. Reduced motion snaps the band/marker/log and
 * the win celebration; the celebration only fires once `feedback === "correct"`.
 */

const DEV = import.meta.env.DEV

type Verdict = "lower" | "higher" | "got-it"

/** The host's reply to a guess: pure compare of the guess key against the secret. */
function verdictOf(guess: number, target: number): Verdict {
  if (guess === target) return "got-it"
  return target < guess ? "lower" : "higher"
}

const VERDICT: Record<
  Verdict,
  { text: string; sr: string; Icon: typeof ArrowDown; chip: string; badge: string }
> = {
  lower: {
    text: "Lower!",
    sr: "lower",
    Icon: ArrowDown,
    chip: "border-lilac-strong/40 bg-lilac-soft text-lilac-strong",
    badge: "bg-lilac text-lilac-foreground",
  },
  higher: {
    text: "Higher!",
    sr: "higher",
    Icon: ArrowUp,
    chip: "border-lilac-strong/40 bg-lilac-soft text-lilac-strong",
    badge: "bg-lilac text-lilac-foreground",
  },
  "got-it": {
    text: "Got it!",
    sr: "got it",
    Icon: PartyPopper,
    chip: "border-success/40 bg-success-soft text-success-foreground",
    badge: "bg-success text-white",
  },
}

export function GuessNumber({
  state,
  dispatch,
  reducedMotion,
}: {
  state: TreesState
  dispatch: Dispatch<LessonAction>
  /** Override the reduced-motion media query (tests; otherwise the hook decides). */
  reducedMotion?: boolean
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false

  const q = state.question
  if (!q || q.target == null) return null
  const target = q.target
  const tree = q.tree

  const [treeMin, treeMax] = subtreeKeyRange(tree) ?? [target, target]
  const span = Math.max(1, treeMax - treeMin)
  const pct = (v: number) => clamp(((v - treeMin) / span) * 100, 0, 100)

  const cur = cursorNode(state)
  const [lo, hi] = subtreeKeyRange(cur) ?? [treeMin, treeMax]
  const guessKey = cur?.key ?? target
  const verdict = verdictOf(guessKey, target)
  const won = state.feedback === "correct"
  const celebrate = won && !reduced

  const log = state.tappedPath.map((id) => {
    const key = nodeById(tree, id)?.key ?? 0
    return { id, key, verdict: verdictOf(key, target) }
  })

  const tc = tappableChildren(state)
  const next = DEV ? correctNextStep(state) : null
  const atTarget = guessKey === target
  const showGuesses = !isTerminalTrees(state) && state.tappedSlot == null && cur != null && !atTarget

  const transition = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 260, damping: 28 }

  const bandLeft = pct(lo)
  const bandWidth = Math.max(pct(hi) - pct(lo), 0)

  const guessButton = (side: Side) => {
    if (!cur) return null
    const child = side === "left" ? cur.left : cur.right
    const isGhost = !child && tc.ghostSides.includes(side)
    if (!child && !isGhost) return null
    const dir = side === "left" ? "lower" : "higher"
    const Icon = side === "left" ? ArrowDown : ArrowUp
    const letter = child ? child.id : side === "left" ? "ghost:left" : "ghost:right"
    const isAnswer = child
      ? next?.kind === "node" && next.id === child.id
      : next?.kind === "ghost" && next.side === side
    return (
      <button
        key={side}
        type="button"
        data-guess-side={side}
        data-answer={isAnswer ? "1" : undefined}
        aria-label={
          child ? `Guess ${dir}: ${child.key}` : `Guess ${dir}: the number is not here`
        }
        onClick={() => dispatch({ type: "select", letter })}
        className={cn(
          "flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3 text-base font-bold outline-none transition-colors",
          "cursor-pointer border-lilac-strong/50 bg-card text-foreground ring-4 ring-lilac-strong/10 hover:bg-lilac-soft",
          "focus-visible:ring-2 focus-visible:ring-lilac-strong/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <Icon className="size-4 shrink-0 text-lilac-strong" strokeWidth={2.6} aria-hidden />
        <span className="flex flex-col items-center leading-tight">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-lilac-strong">
            {dir}
          </span>
          <span className="tabular-nums">{child ? child.key : "off chart"}</span>
        </span>
      </button>
    )
  }

  const V = VERDICT[verdict]

  return (
    <div
      data-testid="guess-number"
      data-reduced-motion={reduced ? "1" : undefined}
      className="w-full overflow-hidden rounded-3xl border border-lilac-strong/30 bg-gradient-to-b from-lilac-soft/70 to-card"
    >
      {/* host header */}
      <div className="flex items-center gap-3 border-b border-lilac-strong/20 bg-lilac-strong/10 px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-lilac text-lilac-foreground">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-lilac-strong">
            Game show
          </span>
          <span className="text-sm font-bold text-foreground">Guess My Number</span>
        </span>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* range bar: the work-meter (the live candidate band, halving each guess) */}
        <div>
          <div className="relative h-3 w-full rounded-full bg-muted" aria-hidden>
            <motion.div
              data-testid="guess-band"
              className={cn("absolute inset-y-0 rounded-full", won ? "bg-success" : "bg-lilac-strong/40")}
              initial={false}
              animate={{ left: `${bandLeft}%`, width: `${bandWidth}%` }}
              transition={transition}
            />
            <motion.div
              className="absolute top-0 h-full"
              initial={false}
              animate={{ left: `${pct(guessKey)}%` }}
              transition={transition}
            >
              <span
                className={cn(
                  "absolute top-1/2 -translate-x-1/2 -translate-y-1/2",
                  "flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-background px-1.5 text-xs font-bold tabular-nums shadow-soft",
                  won ? "bg-success text-white" : "bg-lilac text-lilac-foreground",
                )}
              >
                {guessKey}
              </span>
            </motion.div>
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] font-semibold tabular-nums text-muted-foreground">
            <span>{treeMin}</span>
            <span data-testid="guess-band-label" className="text-lilac-strong">
              {won ? `It's ${target}` : `between ${lo} and ${hi}`}
            </span>
            <span>{treeMax}</span>
          </div>
        </div>

        {/* verdict chip: icon + text (never color alone) */}
        <div className="flex justify-center">
          <motion.span
            data-testid="guess-verdict"
            data-verdict={verdict}
            data-celebrate={celebrate ? "1" : undefined}
            initial={false}
            animate={celebrate ? { scale: [1, 1.18, 1] } : { scale: 1 }}
            transition={celebrate ? { duration: 0.5, ease: "easeOut" } : { duration: 0 }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-sm font-bold",
              V.chip,
            )}
          >
            <span className={cn("inline-flex size-5 items-center justify-center rounded-full", V.badge)}>
              <V.Icon className="size-3" strokeWidth={3} aria-hidden />
            </span>
            {V.text}
            {celebrate && (
              <Sparkles className="size-3.5 text-success-foreground" strokeWidth={2.6} aria-hidden />
            )}
          </motion.span>
        </div>

        {/* guess buttons: the cursor's two children (or a fall at a dead end) */}
        {showGuesses && (
          <div className="flex items-stretch gap-3">
            {guessButton("left")}
            {guessButton("right")}
          </div>
        )}

        {/* guess log: every comparison so far, with the host's reply */}
        {log.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Guesses
            </span>
            <ol className="flex flex-wrap gap-1.5">
              {log.map((entry, i) => {
                const E = VERDICT[entry.verdict]
                const latest = i === log.length - 1
                return (
                  <li
                    key={entry.id}
                    data-testid="guess-log-entry"
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums",
                      latest ? E.chip : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    <span>{entry.key}</span>
                    <E.Icon className="size-3" strokeWidth={2.8} aria-hidden />
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </div>

      <p className="sr-only" role="status">
        {guessStatus(guessKey, verdict, lo, hi, log.length, target, won)}
      </p>
    </div>
  )
}

function guessStatus(
  guess: number,
  verdict: Verdict,
  lo: number,
  hi: number,
  guesses: number,
  target: number,
  won: boolean,
): string {
  if (verdict === "got-it") {
    return won
      ? `You guessed ${target}. Got it in ${guesses} guess${guesses === 1 ? "" : "es"}.`
      : `You guessed ${target}. Got it. Lock in your answer.`
  }
  const reply = verdict === "lower" ? "Lower" : "Higher"
  return `You guessed ${guess}. ${reply}. The secret is between ${lo} and ${hi}.`
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max)
