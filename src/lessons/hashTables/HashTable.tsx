import { useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { RewireTarget } from "@/components/rewire/RewireTarget"
import { bucketTargetId } from "@/features/lesson/hashTablesEngine"
import { BucketChain } from "./BucketChain"

type HashTableMode = "drag" | "tap" | "display"

/**
 * The geometry every bucket container shares, regardless of mode. Keeping the
 * padding / min-height / radius / border-width identical across drag, tap, and
 * display means a bucket that flips from a drop target to a static cell (on a
 * correct drop) never shifts the table; only the interactivity and border colour
 * change. (RewireTarget brings `px-4 py-3 min-h-11`; tailwind-merge lets this
 * win, so the drag bucket matches the others exactly.)
 */
const BUCKET_BOX =
  "flex min-h-12 flex-1 items-center justify-start rounded-2xl border-2 px-4 py-2"

/**
 * The bucket array. A vertical stack of `bucketCount` indexed buckets, each
 * holding its collision chain. Styled to the L2 `ArrayRow` indexed-strip tokens
 * (index ruler + bordered cell), but vertical and a *container* (which `ArrayRow`
 * is not). Three modes:
 * - `drag`: each bucket is a `RewireTarget` (key→bucket drop; highlight only).
 * - `tap`: each bucket is a button (locate by tapping); the pick highlights.
 * - `display`: static (collision predict shows the colliding bucket).
 */
export function HashTable({
  bucketCount,
  table,
  mode,
  selected,
  highlightBucket,
  collisionBuckets,
  masked,
  newestBucket,
  correctTarget,
  searchBucket,
  searchActiveIndex,
  foundIndex,
  appendingBucket,
  appendEnterOffset,
  reducedMotion,
  onTap,
  className,
}: {
  bucketCount: number
  table: Record<number, string[]>
  mode: HashTableMode
  /** The tapped bucket target id (tap mode). */
  selected?: string | null
  /** A bucket to emphasize (display mode: e.g. the colliding bucket). */
  highlightBucket?: number
  /** Buckets to tint as collisions (display mode: 2+ keys sharing a bin). */
  collisionBuckets?: ReadonlySet<number>
  /**
   * Seal the bins: occupied buckets show a masked placeholder instead of their
   * contents (and the key strings are never rendered), so a lookup cannot be
   * read off at idle. The learner must hash the key to pick the bin; the real
   * chains render once the beat reveals (post-commit).
   */
  masked?: boolean
  /** A bucket whose chain tail just grew (highlights the newest key). */
  newestBucket?: number
  /** DEV-only: the correct bucket target id, marked for the e2e tracer (tap mode). */
  correctTarget?: string
  /** The bucket a lookup trace walks (its chain gets active/found highlights). */
  searchBucket?: number
  /** The chain index the trace is currently checking, within `searchBucket`. */
  searchActiveIndex?: number
  /** The matched chain index on a hit, within `searchBucket`. */
  foundIndex?: number
  /** A bucket whose tail key should play the join (append) animation. */
  appendingBucket?: number
  /** Where the appending tail flies in FROM (the demo drops it down from the box). */
  appendEnterOffset?: { x?: number; y?: number }
  /** Force reduced motion (else falls back to the user's OS preference). */
  reducedMotion?: boolean
  onTap?: (bucketId: string) => void
  className?: string
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false

  return (
    <div
      data-reduced-motion={reduced ? "1" : undefined}
      className={cn("flex w-full max-w-[260px] flex-col gap-1.5 lg:max-w-[340px]", className)}
    >
      {Array.from({ length: bucketCount }).map((_, i) => {
        const chain = table[i] ?? []
        const targetId = bucketTargetId(i)
        const isSearch = searchBucket === i
        const inner =
          masked && chain.length > 0 ? (
            <SealedChip />
          ) : chain.length > 0 ? (
            <BucketChain
              chain={chain}
              highlightLast={newestBucket === i}
              activeIndex={isSearch ? searchActiveIndex : undefined}
              foundIndex={isSearch ? foundIndex : undefined}
              enterTail={appendingBucket === i}
              enterOffset={appendingBucket === i ? appendEnterOffset : undefined}
              reducedMotion={reduced}
            />
          ) : (
            <span className="text-xs text-faint">empty</span>
          )

        return (
          <div key={i} className="flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-lilac-soft font-mono text-[11px] font-extrabold text-lilac-strong">
              {i}
            </span>

            {mode === "drag" ? (
              <RewireTarget id={targetId} label={`bucket ${i}`} className={BUCKET_BOX}>
                {inner}
              </RewireTarget>
            ) : mode === "tap" ? (
              <button
                type="button"
                data-answer={
                  correctTarget === targetId && import.meta.env.DEV ? "1" : undefined
                }
                aria-label={`bin ${i}`}
                aria-pressed={selected === targetId}
                onClick={() => onTap?.(targetId)}
                className={cn(
                  BUCKET_BOX,
                  "text-left outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  selected === targetId
                    ? "border-lilac-strong bg-lilac-soft ring-4 ring-lilac-strong/15"
                    : "border-border bg-card hover:border-lilac-strong/45",
                )}
              >
                {inner}
              </button>
            ) : (
              <div
                className={cn(
                  BUCKET_BOX,
                  collisionBuckets?.has(i)
                    ? "border-warning bg-warning-soft"
                    : highlightBucket === i
                      ? "border-lilac-strong bg-lilac-soft"
                      : "border-border bg-card",
                )}
              >
                {inner}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * A sealed-bucket placeholder: a bin holds items, but neither the keys nor the
 * count are shown (every sealed bin reads the same), so a lookup must be hashed
 * rather than read off. The contents render once the beat reveals (post-commit).
 */
function SealedChip() {
  return (
    <span
      data-testid="sealed-bucket"
      aria-label="contents sealed until you choose"
      className="flex items-center gap-1 text-faint"
    >
      <span className="size-1.5 rounded-full bg-faint" aria-hidden />
      <span className="size-1.5 rounded-full bg-faint" aria-hidden />
      <span className="size-1.5 rounded-full bg-faint" aria-hidden />
    </span>
  )
}
