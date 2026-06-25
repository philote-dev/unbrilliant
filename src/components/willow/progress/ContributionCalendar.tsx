import type { ContributionDay } from "./types"

import { cn } from "@/lib/utils"

const DAY_MS = 86400000
const CELL = 12
const GAP = 3
const COL = CELL + GAP
const WEEKDAY_W = 26

/** Opacity of the lilac fill per bucket (index 0 is the muted empty cell). */
const BUCKET_OPACITY = [0, 0.28, 0.5, 0.74, 1]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Map a day's count into a 0..4 intensity bucket (mirrors HeatmapGrid). */
function bucketOf(count: number): number {
  if (count <= 0) return 0
  if (count <= 1) return 1
  if (count <= 3) return 2
  if (count <= 5) return 3
  return 4
}

const dayIndex = (ms: number) => Math.floor(ms / DAY_MS)

/**
 * A GitHub-style contribution calendar: seven weekday rows by N week columns,
 * with month labels across the top, Mon/Wed/Fri labels down the left, and a
 * Less..More legend. Lilac intensity (not GitHub green) keeps it on-brand and
 * theme-aware; it scrolls horizontally on narrow screens. Decorative.
 */
export function ContributionCalendar({ days }: { days: ContributionDay[] }) {
  if (days.length === 0) return null

  const sorted = [...days].sort((a, b) => a.date - b.date)
  const firstIdx = dayIndex(sorted[0].date)
  const lastIdx = dayIndex(sorted[sorted.length - 1].date)
  const firstDow = new Date(sorted[0].date).getUTCDay()
  const startIdx = firstIdx - firstDow // the Sunday on or before the first day

  const counts = new Map<number, number>()
  for (const d of sorted) counts.set(dayIndex(d.date), d.count)

  const numCols = Math.ceil((lastIdx - startIdx + 1) / 7)
  const cols = Array.from({ length: numCols })

  // Month label at each column where the month of that column's first day changes.
  const months: { col: number; name: string }[] = []
  let prevMonth = -1
  for (let c = 0; c < numCols; c++) {
    const month = new Date((startIdx + c * 7) * DAY_MS).getUTCMonth()
    if (month !== prevMonth) {
      months.push({ col: c, name: MONTHS[month] })
      prevMonth = month
    }
  }

  const gridWidth = numCols * COL

  return (
    <div aria-hidden>
      <div className="overflow-x-auto pb-1">
        <div className="inline-block">
          {/* month labels */}
          <div className="flex">
            <div className="sticky left-0 z-10 shrink-0 bg-card" style={{ width: WEEKDAY_W }} />
            <div className="relative" style={{ width: gridWidth, height: 14 }}>
              {months.map((m) => (
                <span
                  key={`${m.name}-${m.col}`}
                  className="absolute top-0 text-[10px] text-muted-foreground"
                  style={{ left: m.col * COL }}
                >
                  {m.name}
                </span>
              ))}
            </div>
          </div>

          {/* weekday labels + cells */}
          <div className="flex">
            <div
              className="sticky left-0 z-10 flex shrink-0 flex-col bg-card text-[9px] text-faint"
              style={{ width: WEEKDAY_W, gap: GAP }}
            >
              {Array.from({ length: 7 }).map((_, row) => (
                <div key={row} className="flex items-center" style={{ height: CELL }}>
                  {row === 1 ? "Mon" : row === 3 ? "Wed" : row === 5 ? "Fri" : ""}
                </div>
              ))}
            </div>

            <div className="flex" style={{ gap: GAP }}>
              {cols.map((_, col) => (
                <div key={col} className="flex flex-col" style={{ gap: GAP }}>
                  {Array.from({ length: 7 }).map((_, row) => {
                    const idx = startIdx + col * 7 + row
                    const inRange = idx >= firstIdx && idx <= lastIdx
                    const bucket = inRange ? bucketOf(counts.get(idx) ?? 0) : 0
                    return (
                      <div
                        key={row}
                        className={cn("rounded-[3px]", inRange && bucket === 0 && "bg-muted")}
                        style={{
                          width: CELL,
                          height: CELL,
                          ...(inRange && bucket > 0
                            ? { backgroundColor: "var(--lilac-strong)", opacity: BUCKET_OPACITY[bucket] }
                            : null),
                        }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend lives OUTSIDE the horizontal scroll and stays left-aligned, so the
          Less..More key is always visible without scrolling the year sideways. */}
      <div className="mt-2 flex items-center gap-1 text-[9px] text-faint">
        <span>Less</span>
        {BUCKET_OPACITY.map((o, i) => (
          <div
            key={i}
            className={cn("rounded-[3px]", i === 0 && "bg-muted")}
            style={{
              width: CELL,
              height: CELL,
              ...(i > 0 ? { backgroundColor: "var(--lilac-strong)", opacity: o } : null),
            }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
