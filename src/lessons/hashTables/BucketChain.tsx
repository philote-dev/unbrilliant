import { Fragment } from "react"
import { ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A bucket's collision chain rendered as a mini linked list — boxes joined by a
 * `next` arrow, the L3 node vocabulary reused at small scale. Display-only: in
 * Hash Tables the *bucket* is the drop target, not the chain nodes. The newest
 * key (the tail) can be highlighted so an append reads at a glance.
 */
export function BucketChain({
  chain,
  highlightLast,
  className,
}: {
  chain: string[]
  highlightLast?: boolean
  className?: string
}) {
  if (chain.length === 0) {
    return <span className="text-xs text-faint">empty</span>
  }
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {chain.map((node, i) => {
        const newest = highlightLast && i === chain.length - 1
        return (
          <Fragment key={`${i}-${node}`}>
            <span
              className={cn(
                "flex h-8 min-w-8 items-center justify-center rounded-lg border-2 px-2 text-sm font-bold text-foreground",
                newest ? "border-lilac-strong bg-lilac-soft" : "border-border bg-card",
              )}
            >
              {node}
            </span>
            {i < chain.length - 1 && (
              <ArrowRight className="size-3 shrink-0 text-faint" aria-hidden />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
