import { ArrowDown } from "lucide-react"
import { motion } from "motion/react"

import { FrameSequence } from "@/components/willow/lesson/FrameSequence"
import { placementFrames } from "@/features/lesson/hashTablesEngine"
import { HashTable } from "./HashTable"

/**
 * The lesson's signature replay: a key flies into its bin and (on a collision)
 * appends to the bin's chain, played over time through the shared `FrameSequence`.
 * It walks the engine's pure `placementFrames` (in-flight, then landed), so the
 * motion is deterministic and reduced-motion snaps straight to the appended state.
 * View-only: the frame index never touches grading.
 */
export function HashFlyReplay({
  keyName,
  table,
  bucketCount,
  reduced,
  caption,
}: {
  /** The key being placed. */
  keyName: string
  /** The bin contents before the key lands. */
  table: Record<number, string[]>
  bucketCount: number
  reduced: boolean
  /** Optional caption builder; defaults to a hash / append sentence. */
  caption?: (landed: boolean, bucket: number) => string
}) {
  const frames = placementFrames(keyName, table, bucketCount)
  const describe =
    caption ??
    ((landed: boolean, bucket: number) =>
      landed
        ? `${keyName} lands in bin ${bucket}.`
        : `${keyName} hashes to bin ${bucket}.`)

  return (
    <FrameSequence
      frames={frames}
      autoPlayMs={(i) => (i === 0 ? 950 : 800)}
      controls
      reduced={reduced}
    >
      {(frame) => (
        <div className="flex flex-col items-center gap-3">
          {/* The in-flight key hovers above the bins before it lands. */}
          <div className="flex h-9 items-center justify-center">
            {!frame.landed && (
              <motion.span
                initial={reduced ? false : { y: -4 }}
                animate={reduced ? undefined : { y: [-4, 2, -4] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                className="flex items-center gap-1.5"
              >
                <span className="flex h-8 min-w-8 items-center justify-center rounded-lg border-2 border-lilac-strong bg-lilac-soft px-2 text-sm font-bold text-foreground">
                  {frame.key}
                </span>
                <ArrowDown className="size-4 text-lilac-strong" aria-hidden />
                <span className="text-xs font-semibold text-lilac-strong">
                  bin {frame.bucket}
                </span>
              </motion.span>
            )}
          </div>

          <HashTable
            bucketCount={bucketCount}
            table={frame.table}
            mode="display"
            highlightBucket={frame.bucket}
            newestBucket={frame.landed ? frame.bucket : undefined}
            appendingBucket={frame.landed ? frame.bucket : undefined}
            appendEnterOffset={frame.landed ? { y: -28 } : undefined}
            reducedMotion={reduced}
          />

          <p className="max-w-xs text-center text-xs text-muted-foreground">
            {describe(frame.landed, frame.bucket)}
          </p>
        </div>
      )}
    </FrameSequence>
  )
}
