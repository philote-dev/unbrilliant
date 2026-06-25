import { useState } from "react"

import { cn } from "@/lib/utils"
import { useIsDesktop } from "@/hooks/useMediaQuery"
import type { ProgressMetrics } from "@/features/progress/progressMetrics"
import { StreakTile } from "@/components/willow/progress/StreakTile"
import { WeeklyConsistencyTile } from "@/components/willow/progress/WeeklyConsistencyTile"
import { LessonsMasteredTile } from "@/components/willow/progress/LessonsMasteredTile"
import { ContributionCalendarTile } from "@/components/willow/progress/ContributionCalendarTile"
import { AccuracyTrendTile } from "@/components/willow/progress/AccuracyTrendTile"
import { AnswersPerDayTile } from "@/components/willow/progress/AnswersPerDayTile"

type ProgressTab = "overview" | "activity"

const TABS: { id: ProgressTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
]

/**
 * The personal-progression dashboard. On mobile the six tiles split across an
 * Overview tab (where you stand) and an Activity tab (what you've done over
 * time). At `lg`+ the tabs fall away and every tile lays out in one grid, with
 * the year calendar spanning the full width. Presentational: every number
 * arrives via the ProgressMetrics view-model.
 */
export function ProgressDashboard({ metrics }: { metrics: ProgressMetrics }) {
  const isDesktop = useIsDesktop()
  const [tab, setTab] = useState<ProgressTab>("overview")

  return (
    <div className="flex flex-1 flex-col px-5 pb-28 pt-6 lg:px-0 lg:pb-0 lg:pt-0">
      <h1 className="text-[28px] font-bold text-foreground lg:text-4xl">
        Your progress
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your streaks, consistency, and growth over time.
      </p>

      {isDesktop ? (
        <div className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <StreakTile {...metrics.streak} />
          <WeeklyConsistencyTile {...metrics.weeklyConsistency} />
          <LessonsMasteredTile {...metrics.lessonsMastered} />
          <div className="lg:col-span-2 xl:col-span-3">
            <ContributionCalendarTile {...metrics.contributions} />
          </div>
          <div className="xl:col-span-2">
            <AccuracyTrendTile {...metrics.accuracyTrend} />
          </div>
          <AnswersPerDayTile {...metrics.answersPerDay} />
        </div>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Progress views"
            className="mt-5 flex gap-1 rounded-2xl border border-border bg-muted/40 p-1"
          >
            {TABS.map((t) => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex-1 rounded-xl py-2 text-sm font-semibold transition-colors",
                    active
                      ? "bg-card text-lilac-strong shadow-card"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          <div className="mt-5 space-y-3">
            {tab === "overview" ? (
              <>
                <StreakTile {...metrics.streak} />
                <WeeklyConsistencyTile {...metrics.weeklyConsistency} />
                <LessonsMasteredTile {...metrics.lessonsMastered} />
              </>
            ) : (
              <>
                <ContributionCalendarTile {...metrics.contributions} />
                <AccuracyTrendTile {...metrics.accuracyTrend} />
                <AnswersPerDayTile {...metrics.answersPerDay} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
