import { cn } from "@/lib/utils"
import { RewireTarget } from "@/components/rewire/RewireTarget"
import { bucketTargetId } from "@/features/lesson/hashTablesEngine"
import { BucketChain } from "./BucketChain"

type HashTableMode = "drag" | "tap" | "display"

/**
 * The bucket array — a vertical stack of `bucketCount` indexed buckets, each
 * holding its collision chain. Styled to the L2 `ArrayRow` indexed-strip tokens
 * (index ruler + bordered cell), but vertical and a *container* (which `ArrayRow`
 * is not). Three modes:
 * - `drag`  — each bucket is a `RewireTarget` (key→bucket drop; highlight only).
 * - `tap`   — each bucket is a button (locate by tapping); the pick highlights.
 * - `display` — static (collision predict shows the colliding bucket).
 */
export function HashTable({
  bucketCount,
  table,
  mode,
  selected,
  highlightBucket,
  newestBucket,
  correctTarget,
  contacts,
  onTap,
  className,
}: {
  bucketCount: number
  table: Record<number, string[]>
  mode: HashTableMode
  /** The tapped bucket target id (tap mode). */
  selected?: string | null
  /** A bucket to emphasize (display mode — e.g. the colliding bucket). */
  highlightBucket?: number
  /** A bucket whose chain tail just grew (highlights the newest key). */
  newestBucket?: number
  /** DEV-only: the correct bucket target id, marked for the e2e tracer (tap mode). */
  correctTarget?: string
  /** Label buckets as "slot" (contacts skin) instead of "bucket". */
  contacts?: boolean
  onTap?: (bucketId: string) => void
  className?: string
}) {
  const noun = contacts ? "slot" : "bucket"

  return (
    <div className={cn("flex w-full max-w-[260px] flex-col gap-1.5", className)}>
      {Array.from({ length: bucketCount }).map((_, i) => {
        const chain = table[i] ?? []
        const targetId = bucketTargetId(i)
        const inner =
          chain.length > 0 ? (
            <BucketChain chain={chain} highlightLast={newestBucket === i} />
          ) : (
            <span className="text-xs text-faint">empty</span>
          )

        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-right text-[11px] font-semibold text-faint">
              {i}
            </span>

            {mode === "drag" ? (
              <RewireTarget
                id={targetId}
                label={`${noun} ${i}`}
                className="min-h-12 flex-1 justify-start"
              >
                {inner}
              </RewireTarget>
            ) : mode === "tap" ? (
              <button
                type="button"
                data-answer={
                  correctTarget === targetId && import.meta.env.DEV ? "1" : undefined
                }
                aria-pressed={selected === targetId}
                onClick={() => onTap?.(targetId)}
                className={cn(
                  "flex min-h-12 flex-1 items-center justify-start rounded-2xl border-2 px-4 py-2 text-left outline-none transition-colors",
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
                  "flex min-h-12 flex-1 items-center justify-start rounded-2xl border-2 px-4 py-2",
                  highlightBucket === i
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
