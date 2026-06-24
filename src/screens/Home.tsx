import { ArrowRight } from "lucide-react"
import { motion } from "motion/react"

import { useNavigation } from "@/lib/navigation"
import { Button } from "@/components/ui/button"
import { WillowLogo, WillowMark } from "@/components/willow/Logo"
import { ProgressBar } from "@/components/willow/Progress"
import { Flame, comboToTier } from "@/components/willow/Flame"
import { useCourseProgress } from "@/features/progress/CourseProgressProvider"
import { homeMode } from "@/features/home/homeMode"
import { currentLessonId, getCourse, lessonName } from "@/lessons/catalog"

export function Home() {
  const { currentCourseId } = useCourseProgress()
  return homeMode({ currentCourseId }) === "vision" ? (
    <VisionHome />
  ) : (
    <DashboardHome courseId={currentCourseId!} />
  )
}

/* --------------------------- vision (first run) ---------------------------- */

/**
 * First-time arrival: a calm branded load-in (the mark settles in, "learn by
 * doing" + the line stagger up), then a single tactile call to pick a course.
 * No interactive panel here. That lives inside the first lesson now.
 */
function VisionHome() {
  const { navigate } = useNavigation()

  return (
    <div className="flex min-h-svh flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 170, damping: 15 }}
      >
        <WillowMark className="size-28" />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mt-6 text-sm font-semibold uppercase tracking-wide text-lilac-strong"
      >
        Learn by doing
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-2 text-[32px] font-bold leading-tight text-foreground"
      >
        Build real intuition for data structures.
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="mt-3 max-w-xs text-[15px] text-muted-foreground"
      >
        Tap, predict, and watch each rule unfold. One interactive lesson at a time.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-10 w-full max-w-xs"
      >
        <Button
          variant="tactile"
          size="lg"
          className="w-full"
          onClick={() => navigate({ name: "courses" })}
        >
          Choose a course
          <ArrowRight className="size-5" />
        </Button>
      </motion.div>
    </div>
  )
}

/* ------------------------- dashboard (returning) --------------------------- */

/**
 * Returning learners land on their active course: the next lesson + a single
 * Continue, with a quiet link to the full path. No marketing, no interactive
 * panel: just resume.
 */
function DashboardHome({ courseId }: { courseId: string }) {
  const { navigate } = useNavigation()
  const { progressByLesson, courseProgress, streak } = useCourseProgress()
  const course = getCourse(courseId) ?? getCourse("data-structures")!

  const pct = courseProgress(course.id)
  const resumeId = currentLessonId(progressByLesson)
  const resumeName = lessonName(resumeId)

  return (
    <div className="flex flex-1 flex-col px-5 pb-28 pt-6">
      <header className="flex items-center">
        <WillowLogo size="md" />
      </header>

      <div className="mt-8 animate-slide-up">
        <p className="text-sm font-medium text-lilac-strong">Welcome back</p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight text-foreground">
          Pick up where you left off.
        </h1>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Flame tier={comboToTier(streak.current)} size={26} />
        <span className="text-sm text-muted-foreground">
          {streak.longest > 0
            ? `Best streak: ${streak.longest} in a row`
            : "Stack correct answers to catch fire"}
        </span>
      </div>

      <div className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-faint">
            {course.title}
          </p>
          <span className="text-xs font-medium text-lilac-strong">{pct}%</span>
        </div>
        <ProgressBar value={pct} className="mt-2" />

        <p className="mt-5 text-xs font-medium uppercase tracking-wide text-faint">
          Up next
        </p>
        <h2 className="mt-0.5 text-xl font-bold text-foreground">{resumeName}</h2>

        <Button
          variant="tactile"
          size="lg"
          className="mt-4 w-full"
          onClick={() => navigate({ name: "lesson", lessonId: resumeId })}
        >
          Continue learning
          <ArrowRight className="size-5" />
        </Button>
      </div>

      <button
        type="button"
        onClick={() => navigate({ name: "course", courseId: course.id })}
        className="mt-4 self-center text-sm font-medium text-lilac-strong hover:underline"
      >
        View full path
      </button>
    </div>
  )
}
