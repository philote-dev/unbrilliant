import { useState } from "react"

import { useNavigation } from "@/lib/navigation"
import { WillowLogo } from "@/components/willow/Logo"
import { CourseCard } from "@/components/willow/CourseCard"
import { COURSES } from "@/lessons/catalog"
import { useCourseProgress } from "@/features/progress/CourseProgressProvider"
import { courseIcon } from "@/lessons/icons"

export function ChooseCourse() {
  const { navigate } = useNavigation()
  const { courseProgress } = useCourseProgress()
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="flex flex-1 flex-col px-5 pb-28 pt-6 lg:px-0 lg:pb-0 lg:pt-0">
      <div className="flex justify-center lg:hidden">
        <WillowLogo size="md" />
      </div>

      <h1 className="mt-6 text-[28px] font-bold text-foreground lg:mt-0 lg:text-4xl">
        Choose a course
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Learn to think in algorithms, by doing. Start with data structures and
        grow from there.
      </p>

      {notice && (
        <p className="mt-3 rounded-xl border border-border bg-muted/60 px-4 py-2 text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      <div className="mt-5 space-y-4 lg:mt-8 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
        {COURSES.map((course) => (
          <CourseCard
            key={course.id}
            title={course.title}
            subtitle={course.subtitle}
            Icon={courseIcon(course.icon)}
            state={course.state}
            progress={courseProgress(course.id)}
            onClick={() =>
              course.state === "available"
                ? navigate({ name: "course", courseId: course.id })
                : setNotice(`${course.title} is coming soon.`)
            }
          />
        ))}
      </div>
    </div>
  )
}
