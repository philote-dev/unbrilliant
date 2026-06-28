import { Fragment } from "react"
import { ArrowDown } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { appendRun, type AppendStep } from "@/features/lesson/arraysEngine"
import { Block } from "./CapacityFrame"
import { SUMMARY_REVEAL } from "./summaryReveal"

/**
 * The average-cost summary figure (beat 11). Each tactic grows its block twice, so
 * the contrast is felt: doubling jumps 4 -> 8 -> 16 (big, roomy blocks, so copies
 * are rare) while grow-by-one creeps 4 -> 5 -> 6 (always full, so it copies every
 * time). Beneath each, a ledger of all 8 appends whose copy counts sum to the total
 * (7 vs 28), so the numbers are earned by a visible run. The reveal is one slow,
 * causal sequence (see `summaryReveal`): the full block lands with chip #1, the
 * first resize copies in with chip #2, the second resize with chip #3, then the rest
 * of the ledger, the total, and finally the explanation. Numbers come from the pure
 * `appendRun` helper (deterministic, unit-tested). Reduced motion holds it at rest.
 * Pure and view-only (no Big-O, no "amortization" wording).
 */
const APPENDS = 8
const SUMMARY_SLOT = 28 // roomy cells (with dots); the doubled 16-block stacks into 2 rows of 8
const SUMMARY_COLS = 8 // wrap each block at 8 per row, so the 16-block reads as 2 rows of 8
const SLOW_STAGGER = 0.24 // a slow copy, so each dot lands one at a time

/** A block in a column's resize chain: capacity, how many copied items it holds, and
 *  whether the gold new item lands in it. */
interface ChainBlock {
  size: number
  lilac: number
  gold: boolean
}

const DOUBLE_CHAIN: ChainBlock[] = [
  { size: 4, lilac: 4, gold: false },
  { size: 8, lilac: 4, gold: true },
  { size: 16, lilac: 8, gold: true },
]
const PLUSONE_CHAIN: ChainBlock[] = [
  { size: 4, lilac: 4, gold: false },
  { size: 5, lilac: 4, gold: true },
  { size: 6, lilac: 5, gold: true },
]

// Block i copies in at one of the three pinned moments (full, copy, copy2); its
// empty frame is allocated ~1s earlier so the learner sees the empty block first.
const CONTENT_AT = [SUMMARY_REVEAL.full, SUMMARY_REVEAL.copy, SUMMARY_REVEAL.copy2]
const frameAt = (i: number) => (i === 0 ? SUMMARY_REVEAL.full : CONTENT_AT[i] - 1.0)

/** When each ledger chip lands: #1/#2/#3 with the three blocks, then the rest. */
function chipDelay(i: number): number {
  if (i < 3) return CONTENT_AT[i]
  return SUMMARY_REVEAL.restStart + (i - 3) * SUMMARY_REVEAL.restStagger
}

export function GrowSummary({ reduced }: { reduced?: boolean }) {
  const prefersReduced = useReducedMotion()
  const isReduced = reduced || (prefersReduced ?? false)
  const doubling = appendRun(APPENDS, "double")
  const plusOne = appendRun(APPENDS, "plusOne")

  return (
    <div className="flex w-full items-end justify-center gap-6" data-testid="grow-summary">
      <SummaryColumn
        title="Double the block"
        chain={DOUBLE_CHAIN}
        resizeLabel="×2"
        steps={doubling.steps}
        reduced={isReduced}
        total={doubling.totalCopied}
        blurb="copies stay rare"
        tone="good"
      />
      <SummaryColumn
        title="Grow by one"
        chain={PLUSONE_CHAIN}
        resizeLabel="+1"
        steps={plusOne.steps}
        reduced={isReduced}
        total={plusOne.totalCopied}
        blurb="copies pile up"
        tone="bad"
      />
    </div>
  )
}

function SummaryColumn({
  title,
  chain,
  resizeLabel,
  steps,
  reduced,
  total,
  blurb,
  tone,
}: {
  title: string
  chain: ChainBlock[]
  resizeLabel: string
  steps: AppendStep[]
  reduced: boolean
  total: number
  blurb: string
  tone: "good" | "bad"
}) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <motion.span
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : { delay: SUMMARY_REVEAL.colLabel }}
      >
        {title}
      </motion.span>

      <div className="flex flex-col items-center gap-1">
        {chain.map((blk, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <motion.div
                className="flex items-center gap-1 text-lilac-strong"
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={reduced ? { duration: 0 } : { delay: frameAt(i) - 0.2 }}
                aria-hidden
              >
                <ArrowDown className="size-3.5" />
                <span className="text-[10px] font-bold">{resizeLabel}</span>
              </motion.div>
            )}
            <Block
              dot
              cols={SUMMARY_COLS}
              slots={blk.size}
              fill={Array(blk.lilac).fill("")}
              newAt={blk.gold ? blk.lilac : undefined}
              copying
              reduced={reduced}
              slot={SUMMARY_SLOT}
              baseDelay={CONTENT_AT[i]}
              frameDelay={frameAt(i)}
              stagger={SLOW_STAGGER}
            />
          </Fragment>
        ))}
      </div>

      <CopyLedger steps={steps} tone={tone} reduced={reduced} />

      <motion.div
        className={cn(
          "flex flex-col items-center gap-0.5 rounded-xl border-2 px-4 py-2",
          tone === "good"
            ? "border-success/40 bg-success-soft/40"
            : "border-danger/40 bg-danger-soft/40",
        )}
        initial={reduced ? false : { opacity: 0, y: 8, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reduced ? { duration: 0 } : { delay: SUMMARY_REVEAL.total, type: "spring", stiffness: 320, damping: 20 }}
      >
        <span
          className={cn(
            "text-2xl font-bold tabular-nums",
            tone === "good" ? "text-success" : "text-danger",
          )}
        >
          {total} copies
        </span>
        <span className="text-xs text-muted-foreground">{blurb}</span>
      </motion.div>
    </div>
  )
}

/**
 * The copy ledger: one chip per append, showing how many old items that append had
 * to copy. Copies are tinted (so doubling reads as a few tinted chips, grow-by-one
 * as a wall of them); a plain "0" means the item just landed. The chips sum to the
 * total beneath. Chips #1/#2/#3 are pinned to the three resize blocks; the rest
 * stagger in after.
 */
function CopyLedger({
  steps,
  tone,
  reduced,
}: {
  steps: AppendStep[]
  tone: "good" | "bad"
  reduced: boolean
}) {
  return (
    <div className="grid grid-cols-4 gap-1" aria-label="copies on each of 8 appends">
      {steps.map((step, i) => {
        const copied = step.copied > 0
        return (
          <motion.div
            key={step.n}
            className={cn(
              "flex size-8 flex-col items-center justify-center rounded-lg border leading-none tabular-nums",
              copied
                ? tone === "good"
                  ? "border-success/50 bg-success-soft/70 text-success"
                  : "border-danger/50 bg-danger-soft/70 text-danger"
                : "border-border/60 bg-card/50 text-muted-foreground",
            )}
            initial={reduced ? false : { opacity: 0, y: 6, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={
              reduced
                ? { duration: 0 }
                : { delay: chipDelay(i), type: "spring", stiffness: 420, damping: 24 }
            }
            title={`Append ${step.n}: copied ${step.copied}`}
          >
            <span className="text-[8px] font-semibold opacity-60">#{step.n}</span>
            <span className="text-[13px] font-bold">{step.copied}</span>
          </motion.div>
        )
      })}
    </div>
  )
}
