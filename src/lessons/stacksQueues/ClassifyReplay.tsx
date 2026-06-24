import { useEffect, useState } from "react"
import { ArrowDown, Ban, Equal, Repeat } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

/**
 * The compare CLASSIFY resolving motion, the sibling of ContrastReplay (which
 * races a stack vs a queue for the contrast beat). The learner sees an input
 * order and an output order and decides which discipline produced it. On the
 * verdict, this replays the transform: the OUT chips start mirroring the input,
 * then reorder into the output, so the learner SEES the rule. A stack reverses
 * (chips cross), a queue preserves (chips stay put, marked "kept"), and neither
 * scatters. Reduced motion snaps to the output with the verdict shown, no motion.
 *
 * Presentational only: driven solely by `replay` (set by the Stage on
 * feedback === "correct" || (fail && showWhy)); the verdict it shows is the
 * engine's, never computed here, and nothing leaks before the verdict.
 */
const RESOLVE_MS = 460

type Verdict = "stack" | "queue" | "neither"

const VERDICT: Record<Verdict, { icon: typeof Repeat; word: string; label: string }> = {
  stack: { icon: Repeat, word: "Reversed", label: "A stack" },
  queue: { icon: Equal, word: "Same order", label: "A queue" },
  neither: { icon: Ban, word: "Neither", label: "No single structure" },
}

export function ClassifyReplay({
  inOrder,
  outOrder,
  verdict,
  replay = false,
  reducedMotion,
  srLabel,
  className,
}: {
  inOrder: string[]
  outOrder: string[]
  verdict: Verdict
  /** Trigger the in -> out transform (set on a correct verdict / fail + Why). */
  replay?: boolean
  reducedMotion?: boolean
  srLabel?: string
  className?: string
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false
  const v = VERDICT[verdict]
  const Icon = v.icon

  return (
    <div
      data-testid="classify-replay"
      data-reduced-motion={reduced ? "1" : undefined}
      className={cn("flex flex-col items-center gap-2", className)}
    >
      <ChipRow label="In" ids={inOrder} />

      <span
        className={cn(
          "flex items-center gap-1.5 text-xs font-semibold",
          replay ? "text-lilac-strong" : "text-faint",
        )}
      >
        <ArrowDown className="size-3.5" strokeWidth={2.5} aria-hidden />
        {replay && <span>{v.word}</span>}
      </span>

      {replay ? (
        <MorphRow
          key="play"
          inOrder={inOrder}
          outOrder={outOrder}
          verdict={verdict}
          reduced={reduced}
        />
      ) : (
        <ChipRow label="Out" ids={outOrder} />
      )}

      {replay && (
        <div
          data-testid="classify-verdict"
          data-classify-verdict={import.meta.env.DEV ? verdict : undefined}
          className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-sm font-semibold text-success"
        >
          <Icon className="size-4" strokeWidth={2.5} aria-hidden />
          <span>{v.label}</span>
        </div>
      )}

      {replay && srLabel && (
        <p className="sr-only" role="status">
          {srLabel}
        </p>
      )}
    </div>
  )
}

/** The out row that, on mount, mirrors the input then reorders to the output. */
function MorphRow({
  inOrder,
  outOrder,
  verdict,
  reduced,
}: {
  inOrder: string[]
  outOrder: string[]
  verdict: Verdict
  reduced: boolean
}) {
  const [resolved, setResolved] = useState(reduced)
  useEffect(() => {
    if (reduced) {
      setResolved(true)
      return
    }
    setResolved(false)
    const id = setTimeout(() => setResolved(true), RESOLVE_MS)
    return () => clearTimeout(id)
  }, [reduced])

  const order = resolved ? outOrder : inOrder
  // A queue keeps order, so there is no crossing to watch: a gentle pulse marks
  // "kept" once resolved, so the (correct) lack of movement still reads.
  const queuePulse = verdict === "queue" && resolved && !reduced

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-faint">Out</span>
      <div className="flex gap-1.5">
        {order.map((c, i) => (
          <motion.span
            key={c}
            layout={!reduced}
            initial={false}
            animate={queuePulse ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={
              reduced
                ? { duration: 0 }
                : { type: "spring", stiffness: 340, damping: 26, delay: queuePulse ? i * 0.06 : 0 }
            }
            className="flex size-8 items-center justify-center rounded-md border border-success bg-success-soft text-sm font-bold text-foreground"
          >
            {c}
          </motion.span>
        ))}
      </div>
    </div>
  )
}

function ChipRow({ label, ids }: { label: string; ids: string[] }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-faint">{label}</span>
      <div className="flex gap-1.5">
        {ids.map((c, i) => (
          <span
            key={`${c}-${i}`}
            className="flex size-8 items-center justify-center rounded-md border border-border bg-card text-sm font-bold text-foreground"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  )
}
