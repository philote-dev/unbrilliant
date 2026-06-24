import { useEffect } from "react"
import { ArrowRight, ChevronLeft } from "lucide-react"

import { useNavigation } from "@/lib/navigation"
import { Button } from "@/components/ui/button"
import { WillowMark } from "@/components/willow/Logo"
import { ProgressBar } from "@/components/willow/Progress"
import { CoursePath, type PathNode } from "@/components/willow/CoursePath"
import { PinnedAction } from "@/components/willow/AppShell"
import { useCourseProgress } from "@/features/progress/CourseProgressProvider"
import { currentLessonId, derivePathNodes, getCourse } from "@/lessons/catalog"

export function CourseDetail({ courseId }: { courseId: string }) {
  const { navigate, back } = useNavigation()
  const { progressByLesson, courseProgress, enterCourse } = useCourseProgress()
  const course = getCourse(courseId)

  // Entering a course is the "has committed to learning" signal that flips Home
  // from the vision hero to the dashboard.
  useEffect(() => {
    enterCourse(courseId)
  }, [courseId, enterCourse])

  const nodes = derivePathNodes(progressByLesson)
  const pct = courseProgress(courseId)
  const startId = currentLessonId(progressByLesson)
  const started = Object.values(progressByLesson).some((p) => p != null)

  const startLesson = () =>
    navigate({ name: "lesson", lessonId: startId })

  const onSelectNode = (node: PathNode) => {
    if (node.state === "locked") return
    navigate({ name: "lesson", lessonId: node.id })
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

          <WillowMark className="size-9" />
          <h1 className="mt-2 text-2xl font-bold text-foreground">
            {course?.title ?? "Course"}
          </h1>
          <ProgressBar value={pct} className="mt-3 w-44" />
        </div>

        <div className="relative mx-auto mt-8 w-full max-w-[320px]">
          <CoursePath nodes={nodes} onSelect={onSelectNode} />
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
