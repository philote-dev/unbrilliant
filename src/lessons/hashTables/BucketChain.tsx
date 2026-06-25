import { Fragment } from "react"
import { ArrowRight, Check } from "lucide-react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

/**
 * A bucket's collision chain rendered as a mini linked list: boxes joined by a
 * `next` arrow, the L3 node vocabulary reused at small scale. Display-only: in
 * Hash Tables the *bucket* is the drop target, not the chain nodes. The newest
 * key (the tail) can be highlighted so an append reads at a glance.
 *
 * The optional props drive the lookup/append illustrations without changing the
 * default render: `activeIndex` rings the node a trace is currently checking
 * (and marks it `aria-current="step"`), `foundIndex` flags the matched node with
 * an icon + screen-reader affordance, and `enterTail` plays a join animation on
 * the last node (snapped when `reducedMotion`). `enterOffset` overrides where the
 * tail flies in FROM (the demo launches it down from the hash box). The row is a
 * single non-wrapping line that scrolls rather than wrapping, so a deep chain
 * never shoves the buckets below it; `layout` keeps reflow smooth. With no extra
 * props the markup is byte-identical to before.
 */
export function BucketChain({
  chain,
  highlightLast,
  activeIndex,
  foundIndex,
  enterTail,
  enterOffset,
  reducedMotion,
  className,
}: {
  chain: string[]
  highlightLast?: boolean
  /** A trace's current node: gets `aria-current="step"` + a lilac ring. */
  activeIndex?: number
  /** The matched node on a hit: gets a check icon + SR-only "found" label. */
  foundIndex?: number
  /** Animate the tail joining the chain (an append), unless reduced motion. */
  enterTail?: boolean
  /** Where the entering tail flies in from (the demo drops it from the box). */
  enterOffset?: { x?: number; y?: number }
  reducedMotion?: boolean
  className?: string
}) {
  if (chain.length === 0) {
    return <span className="text-xs text-faint">empty</span>
  }
  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto", className)}>
      {chain.map((node, i) => {
        const newest = highlightLast && i === chain.length - 1
        const active = activeIndex === i
        const found = foundIndex === i
        const isTail = i === chain.length - 1
        const animateTail = Boolean(enterTail) && isTail && !reducedMotion
        const variant = found
          ? "border-success bg-success-soft"
          : active
            ? "border-lilac-strong bg-lilac-soft ring-2 ring-lilac-strong/30"
            : newest
              ? "border-lilac-strong bg-lilac-soft"
              : "border-border bg-card"
        return (
          <Fragment key={`${i}-${node}`}>
            <motion.span
              layout
              initial={
                animateTail
                  ? {
                      opacity: 0,
                      scale: enterOffset ? 0.85 : 0.6,
                      x: enterOffset?.x ?? -8,
                      y: enterOffset?.y ?? 0,
                    }
                  : false
              }
              animate={animateTail ? { opacity: 1, scale: 1, x: 0, y: 0 } : undefined}
              transition={
                animateTail
                  ? enterOffset
                    ? { type: "spring", stiffness: 220, damping: 24 }
                    : { type: "spring", stiffness: 320, damping: 22 }
                  : undefined
              }
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg border-2 px-2 text-sm font-bold text-foreground",
                found && "gap-1",
                variant,
              )}
            >
              {found && (
                <Check className="size-3 text-success" strokeWidth={3} aria-hidden />
              )}
              {node}
              {found && <span className="sr-only"> found</span>}
            </motion.span>
            {i < chain.length - 1 && (
              <ArrowRight className="size-3 shrink-0 text-faint" aria-hidden />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
