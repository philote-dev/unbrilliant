import { useState } from "react"
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react"
import { useReducedMotion } from "motion/react"

import { Button } from "@/components/ui/button"
import { droppedAlongPath, type TreeNode } from "@/features/lesson/treesEngine"
import { DisplayTree, type FigureVariant } from "./TreeFigure"
import { SortedChain } from "./SortedChain"

/**
 * The post-correct reveal replay for the BST-vs-sorted-list contrast: a manual
 * Back/Next/Replay stepper that runs both searches side by side so the learner
 * can SEE the branching pay off. At step k the sorted list has walked `k` hops
 * (read-only) while the tree has lit `k+1` nodes of its descend and greyed the
 * subtrees each comparison threw away. The graded walk-then-descend stays exactly
 * as-is above this; this is a separate, read-only "watch it race" view. No timers
 * (manual stepper); reduced motion starts at the end-state.
 */
export function ContrastRace({
  chain,
  chainTargetIndex,
  tree,
  path,
  reducedMotion,
  variant = "tree",
}: {
  chain: number[]
  chainTargetIndex: number
  tree: TreeNode
  path: string[]
  reducedMotion?: boolean
  /** Visual skin forwarded to the tree (arena uses "bracket"). */
  variant?: FigureVariant
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false
  const total = Math.max(chainTargetIndex, Math.max(0, path.length - 1))
  const [idx, setIdx] = useState(reduced ? total : 0)

  const cursor = Math.min(idx, chainTargetIndex)
  const litPath = path.slice(0, idx + 1)
  const dropped = [...droppedAlongPath(tree, litPath)]

  const comparisons = path.length
  const targetKey = chain[chainTargetIndex]
  const hop = cursor + 1
  const hopsTotal = chainTargetIndex + 1
  const srLabel = `Tree found ${targetKey} in ${comparisons} comparison${
    comparisons === 1 ? "" : "s"
  }; list at hop ${hop} of ${hopsTotal}.`

  return (
    <div
      data-testid="contrast-race"
      data-reduced-motion={reduced ? "1" : undefined}
      className="flex w-full flex-col items-center gap-5"
    >
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sorted list where every hop counts
        </span>
        <SortedChain keys={chain} cursor={cursor} targetIndex={chainTargetIndex} />
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Balanced tree where half drops each step
        </span>
        <DisplayTree tree={tree} highlightIds={litPath} droppedIds={dropped} variant={variant} />
      </div>

      <p className="sr-only" role="status">
        {srLabel}
      </p>

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="default"
            disabled={idx === 0}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          <span className="min-w-16 text-center text-xs tabular-nums text-muted-foreground">
            Step {idx} / {total}
          </span>
          <Button
            variant="secondary"
            size="default"
            disabled={idx === total}
            onClick={() => setIdx((i) => Math.min(total, i + 1))}
          >
            Next <ArrowRight className="size-4" />
          </Button>
          <Button variant="soft" size="default" onClick={() => setIdx(0)}>
            <RotateCcw className="size-4" /> Replay
          </Button>
        </div>
      )}
    </div>
  )
}
