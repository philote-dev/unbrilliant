import { Suspense } from "react"

import { LIVE_LESSON_ID, isLessonPlayable } from "@/lessons/catalog"
import { FUTURE_LESSONS } from "@/lessons/registry"
import { LessonPlayer } from "@/screens/LessonPlayer"
import { WillowMark } from "@/components/willow/Logo"

/**
 * Routes a lessonId to its player. Any playable lesson (Stacks & Queues, Arrays)
 * renders eagerly via the shared LessonPlayer; not-yet-built lessons resolve
 * from the lazy registry. Separate chunks, loaded on demand.
 */
export function LessonHost({ lessonId }: { lessonId: string }) {
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
