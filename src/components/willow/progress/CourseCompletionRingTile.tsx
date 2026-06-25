import { MetricCard } from "./MetricCard"
import { Ring } from "./Ring"

const clamp = (n: number, lo: number, hi: number) =>
  Number.isNaN(n) ? lo : Math.min(hi, Math.max(lo, n))

/**
 * Compact completion ring for a single course: the percentage centered in the
 * ring, the course title beneath. `completion` is 0..100 and clamped. A course
 * at zero reads as an empty ring with a muted "Not started" caption.
 */
export function CourseCompletionRingTile({
  title,
  completion,
}: {
  title: string
  completion: number
}) {
  const value = clamp(completion, 0, 100)
  const started = value > 0

  return (
    <MetricCard>
      <div className="flex flex-col items-center gap-3">
        <Ring value={value} max={100} size={84}>
          <span className="text-lg font-bold tabular-nums text-foreground">
            {Math.round(value)}%
          </span>
        </Ring>
        <div className="flex max-w-full flex-col items-center gap-0.5">
          <span className="max-w-full truncate text-sm font-medium text-foreground">
            {title}
          </span>
          {started ? null : (
            <span className="text-xs text-faint">Not started</span>
          )}
        </div>
      </div>
    </MetricCard>
  )
}
