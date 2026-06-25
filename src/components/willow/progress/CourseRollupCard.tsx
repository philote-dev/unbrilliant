import type { CourseRollupVM } from "./types"

import { ProgressBar } from "@/components/willow/Progress"
import { courseIcon } from "@/lessons/icons"
import { MetricCard } from "./MetricCard"

const clamp = (n: number, lo: number, hi: number) =>
  Number.isNaN(n) ? lo : Math.min(hi, Math.max(lo, n))

/** 0..1 fraction to a clamped, finite whole-percent (NaN/Infinity safe). */
const toPct = (frac: number) => Math.round(clamp(frac, 0, 1) * 100)

/**
 * Active-courses rollup: one compact card per course passed in. Renders exactly
 * the `courses` given and never fabricates extras; an empty list shows a single
 * muted panel instead of any course card.
 */
export function CourseRollupCard({
  courses,
  onContinue,
}: {
  courses: CourseRollupVM[]
  onContinue?: (courseId: string) => void
}) {
  if (courses.length === 0) {
    return (
      <MetricCard>
        <p className="text-sm font-medium text-muted-foreground">
          No active courses yet.
        </p>
      </MetricCard>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {courses.map((c) => {
        const Icon = courseIcon(c.icon)
        return (
          <MetricCard key={c.courseId}>
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-lilac-soft text-lilac-strong">
                <Icon className="size-5" strokeWidth={1.8} />
              </span>
              <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                {c.title}
              </h3>
            </div>

            <ProgressBar value={clamp(c.completion, 0, 100)} className="mt-3" />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium tabular-nums text-muted-foreground">
                {toPct(c.mastery)}% mastery · {toPct(c.accuracy)}% accuracy
              </p>
              <button
                type="button"
                onClick={() => onContinue?.(c.courseId)}
                className="shrink-0 rounded-full bg-lilac-strong px-4 py-1.5 text-sm font-semibold text-lilac-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-lilac-strong/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Continue
              </button>
            </div>
          </MetricCard>
        )
      })}
    </div>
  )
}
