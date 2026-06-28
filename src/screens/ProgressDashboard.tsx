import type { ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react"

import { useIsDesktop } from "@/hooks/useMediaQuery"
import type { ProgressMetrics } from "@/features/progress/progressMetrics"
import { MasteryWillow } from "@/components/willow/MasteryWillow"
import { StreakTile } from "@/components/willow/progress/StreakTile"
import { WeeklyConsistencyTile } from "@/components/willow/progress/WeeklyConsistencyTile"
import { ContributionCalendarTile } from "@/components/willow/progress/ContributionCalendarTile"
import { AccuracyTrendTile } from "@/components/willow/progress/AccuracyTrendTile"
import { AnswersPerDayTile } from "@/components/willow/progress/AnswersPerDayTile"

const clamp01 = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0))

/* Entrance motion. The willow and the stats share one staggered reveal, but each
   layout enters from its own direction so the mobile (stacked) and widescreen
   (dashboard) arrangements read as distinctly different shapes assembling. */
const orchestrate: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}
const cellIn: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 30 } },
}
const treeIn = (fromTop: boolean): Variants => ({
  hidden: { opacity: 0, scale: 0.94, y: fromTop ? -14 : 8 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 210, damping: 26 } },
})

/** The tree's own metrics, shown directly under it: how far it has grown (lessons
 *  mastered) and how fresh that knowledge is (memory), which is what the canopy's
 *  health encodes. Memory is hidden until something has been mastered. */
function TreeMetrics({
  completed,
  total,
  retention,
}: {
  completed: number
  total: number
  retention: number
}) {
  const memory = Math.round(clamp01(retention) * 100)
  return (
    <div className="flex items-center justify-center gap-6 text-center">
      <div className="flex flex-col items-center">
        <span className="text-2xl font-bold tabular-nums leading-none text-foreground">
          {completed}
          <span className="text-muted-foreground">/{total}</span>
        </span>
        <span className="mt-1 text-xs font-medium text-muted-foreground">Lessons mastered</span>
      </div>
      {completed > 0 ? (
        <>
          <div className="h-9 w-px bg-border" />
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold tabular-nums leading-none text-foreground">
              {memory}%
            </span>
            <span className="mt-1 text-xs font-medium text-muted-foreground">Memory</span>
          </div>
        </>
      ) : null}
    </div>
  )
}

/**
 * The personal-progression dashboard. The willow is the hero either way: on mobile
 * it sits on top with the stats stacked beneath it; at `lg`+ it is sectioned off as
 * a large, sticky panel on the right (with its mastered/memory metrics under it)
 * while the stats become a compact dashboard of right-sized cells on the left. The
 * two arrangements animate in from different directions so the shift reads clearly.
 * Presentational: every number arrives via the ProgressMetrics view-model.
 */
export function ProgressDashboard({ metrics }: { metrics: ProgressMetrics }) {
  const isDesktop = useIsDesktop()
  const reduce = useReducedMotion()
  const initial = reduce ? "show" : "hidden"
  const { completed, total } = metrics.lessonsMastered

  // Built once; only the matching layout below renders, so the elements are reused.
  const cells: { key: string; node: ReactNode; wide?: boolean }[] = [
    { key: "streak", node: <StreakTile {...metrics.streak} /> },
    { key: "week", node: <WeeklyConsistencyTile {...metrics.weeklyConsistency} /> },
    { key: "accuracy", node: <AccuracyTrendTile {...metrics.accuracyTrend} /> },
    { key: "answers", node: <AnswersPerDayTile {...metrics.answersPerDay} /> },
    { key: "calendar", node: <ContributionCalendarTile {...metrics.contributions} />, wide: true },
  ]

  const treeMetrics = (
    <TreeMetrics completed={completed} total={total} retention={metrics.overallRetention} />
  )

  return (
    <div className="flex flex-1 flex-col px-5 pb-28 pt-6 lg:px-0 lg:pb-0 lg:pt-0">
      <h1 className="text-[28px] font-bold text-foreground lg:text-4xl">Your progress</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your streaks, consistency, and growth over time.
      </p>

      <AnimatePresence mode="wait">
        {isDesktop ? (
          <motion.div
            key="desktop"
            variants={orchestrate}
            initial={initial}
            animate="show"
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="mt-8 grid grid-cols-[minmax(0,1fr)_minmax(400px,42%)] items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(460px,44%)]"
          >
            {/* left: the stats as a compact, right-sized dashboard */}
            <motion.div variants={orchestrate} className="grid grid-cols-2 gap-3">
              {cells.map((c) => (
                <motion.div key={c.key} variants={cellIn} className={c.wide ? "col-span-2" : undefined}>
                  {c.node}
                </motion.div>
              ))}
            </motion.div>

            {/* right: the willow as a large hero, sectioned off and kept in view */}
            <motion.aside
              variants={treeIn(false)}
              className="sticky top-6 flex flex-col items-center gap-4"
            >
              <MasteryWillow
                lessonsDone={completed}
                totalLessons={total}
                retention={metrics.overallRetention}
                width="100%"
              />
              {treeMetrics}
            </motion.aside>
          </motion.div>
        ) : (
          <motion.div
            key="mobile"
            variants={orchestrate}
            initial={initial}
            animate="show"
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="mt-6 flex flex-col gap-3"
          >
            <motion.div variants={treeIn(true)} className="flex flex-col items-center gap-4 pb-2">
              <MasteryWillow
                lessonsDone={completed}
                totalLessons={total}
                retention={metrics.overallRetention}
                width={280}
              />
              {treeMetrics}
            </motion.div>
            {cells.map((c) => (
              <motion.div key={c.key} variants={cellIn}>
                {c.node}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
