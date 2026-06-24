import { cn } from "@/lib/utils"

const CELL = 12
const GAP = 3

/** Opacity of the lilac fill per bucket (index 0 is the muted empty cell). */
const BUCKET_OPACITY = [0, 0.28, 0.5, 0.74, 1]

/** Map a day's answer count into a 0..4 intensity bucket. */
function bucketOf(count: number): number {
  if (count <= 0) return 0
  if (count <= 1) return 1
  if (count <= 3) return 2
  if (count <= 5) return 3
  return 4
}

/**
 * A GitHub-style activity grid: one column per week, seven rows (days). Each
 * count buckets into a lilac intensity; an empty day is a muted square. Ragged
 * or short weeks are tolerated (missing days read as zero). Decorative.
 */
export function HeatmapGrid({ weeks }: { weeks: number[][] }) {
  return (
    <div className="flex" style={{ gap: GAP }} aria-hidden>
      {weeks.map((week, col) => (
        <div key={col} className="flex flex-col" style={{ gap: GAP }}>
          {Array.from({ length: 7 }).map((_, row) => {
            const bucket = bucketOf(week[row] ?? 0)
            return (
              <div
                key={row}
                className={cn("rounded-[3px]", bucket === 0 && "bg-muted")}
                style={{
                  width: CELL,
                  height: CELL,
                  ...(bucket > 0
                    ? {
                        backgroundColor: "var(--lilac-strong)",
                        opacity: BUCKET_OPACITY[bucket],
                      }
                    : null),
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
