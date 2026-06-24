import { Check, Lock } from "lucide-react"

import { cn } from "@/lib/utils"
import { ProgressBar } from "@/components/willow/Progress"
import { useCourseProgress } from "@/features/progress/CourseProgressProvider"
import { lessonStats, type LessonStats } from "@/features/progress/analytics"
import { derivePathNodes } from "@/lessons/catalog"
import type { PathNode } from "@/components/willow/CoursePath"

/**
 * The deep drill-down: per-lesson mastery and accuracy derived from real
 * progress: the detail to the dashboard's summary and distinct from the
 * course path (no node map here, just the breakdown).
 */
export function Progress() {
  const { progressByLesson } = useCourseProgress()
  const nodes = derivePathNodes(progressByLesson)

  return (
    <div className="flex flex-1 flex-col px-5 pb-28 pt-6">
      <h1 className="text-[28px] font-bold text-foreground">Your progress</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        How you&apos;re doing, lesson by lesson.
      </p>

      <div className="mt-5 space-y-3">
        {nodes.map((node) => (
          <LessonStatCard
            key={node.id}
            node={node}
            stats={lessonStats(node.id, progressByLesson[node.id])}
          />
        ))}
      </div>
    </div>
  )
}

type CardStatus = "completed" | "in_progress" | "not_started" | "locked"

const STATUS_META: Record<CardStatus, { label: string; className: string }> = {
  completed: { label: "Mastered", className: "bg-lilac text-lilac-foreground" },
  in_progress: { label: "In progress", className: "bg-lilac-soft text-lilac-strong" },
  not_started: { label: "Not started", className: "bg-muted text-muted-foreground" },
  locked: { label: "Locked", className: "bg-muted text-muted-foreground" },
}

function LessonStatCard({
  node,
  stats,
}: {
  node: PathNode
  stats: LessonStats
}) {
  const locked = node.state === "locked"
  // "Started" only counts once there's a correct answer (or completion). Entering
  // a lesson without answering yet still reads "Not started", so the chip and the
  // body never contradict.
  const engaged = stats.completed || stats.correct > 0
  const status: CardStatus = locked
    ? "locked"
    : stats.completed
      ? "completed"
      : engaged
        ? "in_progress"
        : "not_started"
  const meta = STATUS_META[status]

  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-card p-5 shadow-card",
        locked && "opacity-70",
      )}
    >
      <div className="flex items-center justify-between">
        <h2
          className={cn(
            "text-base font-semibold",
            locked ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {node.name}
        </h2>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
            meta.className,
          )}
        >
          {status === "completed" && <Check className="size-3" strokeWidth={3} />}
          {status === "locked" && <Lock className="size-3" />}
          {meta.label}
        </span>
      </div>

      {locked ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Complete the previous lesson to unlock this one.
        </p>
      ) : engaged ? (
        <>
          <div className="mt-3 flex items-baseline justify-between text-xs">
            <span className="font-medium text-lilac-strong">
              {Math.round(stats.mastery * 100)}% mastered
            </span>
            <span className="text-muted-foreground">
              {Math.round(stats.accuracy * 100)}% accuracy · {stats.correct}/
              {stats.attempted} answers
            </span>
          </div>
          <ProgressBar value={Math.round(stats.mastery * 100)} className="mt-2" />
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Not started yet. Give it a go.
        </p>
      )}
    </div>
  )
}
