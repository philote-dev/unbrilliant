import { useEffect } from "react"
import { ArrowRight, ChevronLeft } from "lucide-react"

import { useNavigation } from "@/lib/navigation"
import { Button } from "@/components/ui/button"
import { WillowMark } from "@/components/willow/Logo"
import { ProgressBar } from "@/components/willow/Progress"
import type { PathNode } from "@/components/willow/CoursePath"
import { pathLayoutFor } from "@/components/willow/coursePath/registry"
import { PinnedAction } from "@/components/willow/AppShell"
import { useIsDesktop } from "@/hooks/useMediaQuery"
import { useCourseProgress } from "@/features/progress/CourseProgressProvider"
import { useLessonRetention } from "@/features/progress/useRetention"
import {
  currentLessonId,
  derivePathNodes,
  getCourse,
  lessonStructure,
} from "@/lessons/catalog"
import { courseArt } from "@/lessons/icons"

export function CourseDetail({ courseId }: { courseId: string }) {
  const { navigate, back } = useNavigation()
  const isDesktop = useIsDesktop()
  const { progressByLesson, courseProgress, enterCourse } = useCourseProgress()
  const lessonRetention = useLessonRetention()
  const course = getCourse(courseId)
  const art = course ? courseArt(course.icon) : null

  // Entering a course is the "has committed to learning" signal that flips Home
  // from the vision hero to the dashboard.
  useEffect(() => {
    enterCourse(courseId)
  }, [courseId, enterCourse])

  const nodes = derivePathNodes(progressByLesson, (id) => lessonRetention(id))
  const pct = courseProgress(courseId)
  const startId = currentLessonId(progressByLesson)
  const started = Object.values(progressByLesson).some((p) => p != null)

  // The course path renders via the layout chosen by the current lesson's data
  // structure, falling back to the generic CoursePath when none is registered.
  const Layout = pathLayoutFor(lessonStructure(startId))

  const startLesson = () => navigate({ name: "lesson", lessonId: startId })

  const onSelectNode = (node: PathNode) => {
    if (node.state === "locked") return
    navigate({ name: "lesson", lessonId: node.id })
  }

  if (isDesktop) {
    return (
      <div className="flex flex-1 flex-col">
        <button
          type="button"
          onClick={back}
          className="flex items-center gap-1 self-start rounded-full py-1 pr-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
          Back
        </button>

        <div className="mx-auto mt-6 grid w-full max-w-6xl gap-12 lg:grid-cols-[minmax(360px,440px)_minmax(480px,600px)] lg:items-start lg:justify-center">
          <div className="flex flex-col items-center text-center lg:sticky lg:top-8">
            {art ? (
              <img src={art} alt="" className="h-48 w-auto max-w-full object-contain" />
            ) : (
              <WillowMark className="size-16" />
            )}
            <h1 className="mt-4 text-5xl font-bold tracking-tight text-foreground">
              {course?.title ?? "Course"}
            </h1>
            {course?.subtitle && (
              <p className="mt-2 text-lg text-muted-foreground">
                {course.subtitle}
              </p>
            )}
            <div className="mt-6 flex items-center gap-3">
              <ProgressBar value={pct} className="w-56" />
              <span className="text-sm font-medium text-lilac-strong">
                {pct}%
              </span>
            </div>
            <Button
              variant="tactile"
              size="lg"
              className="mt-7 w-full max-w-sm"
              onClick={startLesson}
            >
              {started ? "Continue" : "Start"}
              <ArrowRight className="size-5" />
            </Button>
          </div>

          <div className="w-full max-w-[600px]">
            <Layout nodes={nodes} onSelect={onSelectNode} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-1 flex-col px-5 pb-48 pt-6">
        <div className="relative flex flex-col items-center">
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className="absolute left-0 top-0 flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-5" />
          </button>

          {art ? (
            <img src={art} alt="" className="h-28 w-auto" />
          ) : (
            <WillowMark className="size-9" />
          )}
          <h1 className="mt-2 text-2xl font-bold text-foreground">
            {course?.title ?? "Course"}
          </h1>
          <ProgressBar value={pct} className="mt-3 w-44" />
        </div>

        <div className="relative mx-auto mt-8 w-full max-w-[320px]">
          <Layout nodes={nodes} onSelect={onSelectNode} />
        </div>
      </div>

      <PinnedAction>
        <Button
          variant="tactile"
          size="lg"
          className="w-full"
          onClick={startLesson}
        >
          {started ? "Continue" : "Start"}
          <ArrowRight className="size-5" />
        </Button>
      </PinnedAction>
    </>
  )
}
