import { Fragment } from "react"
import { ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A read-only sorted linked list, walked **tap-to-advance** (the T5 contrast).
 * This is the L3 "walk, no jump" felt in the hands: the cursor starts at the head
 * and the only legal move is the next node. Each tap is one hop, and the hop
 * count is the cost (`scales`). It is deliberately the same picture as the
 * degenerate stick. NOT the rewire infra. Imports nothing from
 * `@/components/rewire/*`; it only ever advances a cursor.
 */
const DEV = import.meta.env.DEV

export function SortedChain({
  keys,
  cursor,
  targetIndex,
  onAdvance,
}: {
  keys: number[]
  /** How far the walk has reached (index of the last examined node). */
  cursor: number
  /** The index being searched for: the walk ends here. */
  targetIndex: number
  onAdvance?: () => void
}) {
  const done = cursor >= targetIndex
  const nextIndex = cursor + 1
  // Read-only (no `onAdvance`, e.g. the post-correct race): no live walk button,
  // the cursor alone shows progress, and no stray DEV `data-answer` hook.
  const interactive = onAdvance != null

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-1">
        {keys.map((k, i) => {
          const walked = i <= cursor
          const isNext = i === nextIndex && !done && interactive
          const isTarget = i === targetIndex
          return (
            <Fragment key={k}>
              {isNext ? (
                <button
                  type="button"
                  data-answer={DEV ? "1" : undefined}
                  aria-label={`walk to ${k}`}
                  onClick={onAdvance}
                  className={cn(
                    "flex h-11 min-w-11 items-center justify-center rounded-full border-2 border-dashed border-lilac-strong/70 bg-card px-2 text-sm font-bold text-foreground outline-none",
                    "cursor-pointer ring-4 ring-lilac-strong/15 hover:bg-lilac-soft",
                    "focus-visible:ring-2 focus-visible:ring-lilac-strong/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                >
                  {k}
                </button>
              ) : (
                <span
                  aria-label={`node ${k}${walked ? ", walked" : ""}`}
                  className={cn(
                    "flex h-11 min-w-11 items-center justify-center rounded-full border-2 px-2 text-sm font-bold transition-colors",
                    isTarget && done
                      ? "border-success bg-success-soft text-foreground"
                      : walked
                        ? "border-lilac-strong bg-lilac-soft text-foreground"
                        : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {k}
                </span>
              )}
              {i < keys.length - 1 && (
                <ArrowRight
                  className={cn("size-3.5 shrink-0", i < cursor ? "text-lilac-strong" : "text-faint")}
                  strokeWidth={2.4}
                  aria-hidden
                />
              )}
            </Fragment>
          )
        })}
      </div>
      <p className="sr-only" role="status">
        Walked {cursor + 1} of {keys.length} nodes{done ? ". Reached the value." : "."}
      </p>
    </div>
  )
}
