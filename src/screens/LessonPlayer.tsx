import { useEffect, useState } from "react"

import { useNavigation } from "@/lib/navigation"
import { useAuth } from "@/lib/auth"
import { LessonTopBar } from "@/components/willow/LessonTopBar"
import { SignInNudge } from "@/components/willow/SignInNudge"
import { comboToTier } from "@/components/willow/Flame"
import { useLessonRun } from "@/features/lesson/useLessonRun"

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

  const showNudge = !user && !nudgeDismissed && module.hasProgress(state)
  const Stage = module.Stage

  return (
    <div className="flex min-h-svh flex-col px-5 pb-6 pt-6">
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
