import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowRight } from "lucide-react"
import { motion } from "motion/react"

import { useNavigation } from "@/lib/navigation"
import { Button } from "@/components/ui/button"
import { WillowLogo, WillowMark } from "@/components/willow/Logo"
import { Splash } from "@/components/willow/Splash"
import { ProgressBar } from "@/components/willow/Progress"
import { Flame, comboToTier } from "@/components/willow/Flame"
import type { PathNode } from "@/components/willow/CoursePath"
import { pathLayoutFor } from "@/components/willow/coursePath/registry"
import { StreakTile } from "@/components/willow/progress/StreakTile"
import { WeeklyConsistencyTile } from "@/components/willow/progress/WeeklyConsistencyTile"
import { LessonsMasteredTile } from "@/components/willow/progress/LessonsMasteredTile"
import { ContributionCalendarTile } from "@/components/willow/progress/ContributionCalendarTile"
import { useIsDesktop } from "@/hooks/useMediaQuery"
import { useCourseProgress } from "@/features/progress/CourseProgressProvider"
import { useProgressMetrics } from "@/features/progress/progressMetrics"
import { homeMode } from "@/features/home/homeMode"
import { markSplashShown, shouldShowSplash } from "@/features/home/splash"
import {
  currentLessonId,
  derivePathNodes,
  getCourse,
  lessonName,
  lessonStructure,
} from "@/lessons/catalog"

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
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [showSplash, setShowSplash] = useState(() =>
    shouldShowSplash(sessionStorage),
  )
  const splashRan = useRef(showSplash)

  const handleSplashDone = useCallback(() => {
    markSplashShown(sessionStorage)
    setShowSplash(false)
  }, [])

  // After a splash handoff, move focus to the heading so keyboard and screen
  // reader users land on the landing, not back at the top of the document.
  useEffect(() => {
    if (!showSplash && splashRan.current) {
      splashRan.current = false
      headingRef.current?.focus()
    }
  }, [showSplash])

  if (showSplash) return <Splash onDone={handleSplashDone} />

  return (
    <div className="flex min-h-svh flex-1 flex-col items-center justify-center px-6 pb-24 text-center lg:min-h-0 lg:pb-0">
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
        ref={headingRef}
        tabIndex={-1}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-2 text-[32px] font-bold leading-tight text-foreground outline-none"
      >
        Build real intuition for algorithmic thinking.
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="mt-3 max-w-xs text-[15px] text-muted-foreground"
      >
        Tap, predict, and watch each idea click into place. We start with data
        structures, one interactive lesson at a time.
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

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="mt-6 text-xs font-medium text-faint"
      >
        <span className="text-lilac-strong">Data Structures</span> · Algorithms ·
        Probability
      </motion.p>
    </div>
  )
}

/* ------------------------- dashboard (returning) --------------------------- */

/**
 * Returning learners land on their active course. On mobile: the next lesson +
 * a single Continue, with a quiet link to the full path. On desktop: a rich
 * landing dashboard (resume + real progress tiles + a course-path preview).
 */
function DashboardHome({ courseId }: { courseId: string }) {
  const isDesktop = useIsDesktop()
  if (isDesktop) return <DashboardHomeDesktop courseId={courseId} />
  return <DashboardHomeMobile courseId={courseId} />
}

function DashboardHomeMobile({ courseId }: { courseId: string }) {
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

function DashboardHomeDesktop({ courseId }: { courseId: string }) {
  const { navigate } = useNavigation()
  const { progressByLesson, courseProgress, streak } = useCourseProgress()
  const metrics = useProgressMetrics()
  const course = getCourse(courseId) ?? getCourse("data-structures")!

  const pct = courseProgress(course.id)
  const resumeId = currentLessonId(progressByLesson)
  const resumeName = lessonName(resumeId)
  const nodes = derivePathNodes(progressByLesson)
  const Layout = pathLayoutFor(lessonStructure(resumeId))

  const onSelectNode = (node: PathNode) => {
    if (node.state === "locked") return
    navigate({ name: "lesson", lessonId: node.id })
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-lilac-strong">Welcome back</p>
          <h1 className="mt-1 text-4xl font-bold leading-tight text-foreground">
            Pick up where you left off.
          </h1>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Flame tier={comboToTier(streak.current)} size={26} />
          <span className="text-sm text-muted-foreground">
            {streak.longest > 0
              ? `Best streak: ${streak.longest} in a row`
              : "Stack correct answers to catch fire"}
          </span>
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-5">
          <div className="rounded-3xl border border-border bg-card p-7 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-faint">
                {course.title}
              </p>
              <span className="text-sm font-medium text-lilac-strong">
                {pct}%
              </span>
            </div>
            <ProgressBar value={pct} className="mt-3" />

            <p className="mt-7 text-xs font-medium uppercase tracking-wide text-faint">
              Up next
            </p>
            <h2 className="mt-1 text-3xl font-bold text-foreground">
              {resumeName}
            </h2>

            <Button
              variant="tactile"
              size="lg"
              className="mt-6 w-full max-w-sm"
              onClick={() => navigate({ name: "lesson", lessonId: resumeId })}
            >
              Continue learning
              <ArrowRight className="size-5" />
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StreakTile {...metrics.streak} />
            <WeeklyConsistencyTile {...metrics.weeklyConsistency} />
            <LessonsMasteredTile {...metrics.lessonsMastered} />
          </div>

          <ContributionCalendarTile {...metrics.contributions} />
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Your path</p>
            <button
              type="button"
              onClick={() => navigate({ name: "course", courseId: course.id })}
              className="text-xs font-medium text-lilac-strong hover:underline"
            >
              Full course
            </button>
          </div>
          <div className="mx-auto mt-4 w-full max-w-[300px]">
            <Layout nodes={nodes} onSelect={onSelectNode} />
          </div>
        </div>
      </div>
    </div>
  )
}
