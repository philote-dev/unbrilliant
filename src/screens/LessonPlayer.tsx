import { useEffect, useState } from "react"

import { useNavigation } from "@/lib/navigation"
import { useAuth } from "@/lib/auth"
import { LessonTopBar } from "@/components/willow/LessonTopBar"
import { SignInNudge } from "@/components/willow/SignInNudge"
import { comboToTier } from "@/components/willow/Flame"
import { useLessonRun } from "@/features/lesson/useLessonRun"

/** How far into a lesson (as a fraction of its beats) before the sign-in nudge appears. */
const NUDGE_AFTER_FRACTION = 1 / 3

/**
 * Lesson-agnostic chrome: the progress/flame top bar, the subtle sign-in nudge,
 * and the active lesson module's Stage. All lesson-specific rendering lives in
 * the module's Stage; this shell only drives the shared frame and completion nav.
 */
export function LessonPlayer({ lessonId }: { lessonId: string }) {
  const { navigate, back } = useNavigation()
  const { user } = useAuth()
  const { state, dispatch, module } = useLessonRun()
  const [nudgeDismissed, setNudgeDismissed] = useState(false)

  const completed = module.completed(state)
  useEffect(() => {
    if (completed) navigate({ name: "complete", lessonId })
  }, [completed, lessonId, navigate])

  // Each new lesson re-prompts: a dismissal only silences the nudge for the
  // current lesson, so a signed-out learner is asked again ~a third into the next.
  useEffect(() => {
    setNudgeDismissed(false)
  }, [lessonId])

  // Hold the sign-in nudge until the learner is invested, ~a third of the way
  // in, instead of firing on the first beat. Earlier it promised a "streak"
  // before one existed; by a third in there are real wins worth saving.
  const investedEnough =
    module.filledParts(state) >= module.totalParts * NUDGE_AFTER_FRACTION
  const showNudge = !user && !nudgeDismissed && investedEnough
  const Stage = module.Stage

  return (
    <div className="flex min-h-svh flex-col px-5 pb-6 pt-6 lg:mx-auto lg:min-h-0 lg:w-full lg:max-w-[var(--willow-lesson-max)] lg:flex-1">
      <LessonTopBar
        totalParts={module.totalParts}
        filledParts={module.filledParts(state)}
        tier={comboToTier(module.combo(state))}
        onClose={back}
      />

      {showNudge && (
        <SignInNudge
          onSignIn={() =>
            navigate({
              name: "signin",
              reason: "Sign in to save your progress.",
              intent: "save",
            })
          }
          onDismiss={() => setNudgeDismissed(true)}
        />
      )}

      <Stage state={state} dispatch={dispatch} />
    </div>
  )
}
