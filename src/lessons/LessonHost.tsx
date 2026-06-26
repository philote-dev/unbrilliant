import { Suspense, useReducer, useRef } from "react"

import { LIVE_LESSON_ID, isLessonPlayable, lessonName } from "@/lessons/catalog"
import { FUTURE_LESSONS } from "@/lessons/registry"
import { LessonPlayer } from "@/screens/LessonPlayer"
import { WillowMark } from "@/components/willow/Logo"
import { useAuth } from "@/lib/auth"
import { useConceptReviews } from "@/features/progress/ConceptReviewProvider"
import { useCourseProgress } from "@/features/progress/CourseProgressProvider"
import { RetrievalDrill } from "@/features/retrieval/RetrievalDrill"
import {
  lessonOfConcept,
  seedFromUid,
  selectDueDrill,
  type DueDrill,
} from "@/features/retrieval/selectDrill"

/**
 * Routes a lessonId to its player, gating a due spaced-repetition warm-up first.
 * Any playable lesson renders eagerly via the shared LessonPlayer; not-yet-built
 * lessons resolve from the lazy registry (separate chunks, on demand).
 */

// One drill per concept per app session (a refresh clears it). Module-level so it
// survives LessonHost remounts as the learner navigates between lessons.
const shownThisSession = new Set<string>()

export function LessonHost({ lessonId }: { lessonId: string }) {
  const { user } = useAuth()
  const { reviews } = useConceptReviews()
  const { progressByLesson } = useCourseProgress()
  // Latch the chosen drill so answering it (which reschedules the concept and
  // mutates `reviews`) can't unmount it mid-flow; cleared only when it finishes.
  const latched = useRef<DueDrill | null>(null)
  const finished = useRef(false)
  const [, bump] = useReducer((n: number) => n + 1, 0)

  if (!finished.current && !latched.current && user) {
    const completedLessonIds = new Set(
      Object.entries(progressByLesson)
        .filter(([, p]) => p?.completed)
        .map(([id]) => id),
    )
    const due = selectDueDrill([...reviews.values()], {
      completedLessonIds,
      now: Date.now(),
      userSeed: seedFromUid(user.uid),
    })
    if (due && !shownThisSession.has(due.conceptId)) latched.current = due
  }

  const drill = finished.current ? null : latched.current
  if (drill) {
    return (
      <RetrievalDrill
        items={drill.items}
        lessonName={lessonName(lessonOfConcept(drill.conceptId))}
        onDone={() => {
          shownThisSession.add(drill.conceptId)
          finished.current = true
          latched.current = null
          bump()
        }}
      />
    )
  }

  if (isLessonPlayable(lessonId)) {
    return <LessonPlayer lessonId={lessonId} />
  }

  const Lazy = FUTURE_LESSONS[lessonId]
  if (!Lazy) return <LessonPlayer lessonId={LIVE_LESSON_ID} />

  return (
    <Suspense fallback={<LessonLoading />}>
      <Lazy />
    </Suspense>
  )
}

function LessonLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <WillowMark className="size-10 animate-pulse" />
    </div>
  )
}
