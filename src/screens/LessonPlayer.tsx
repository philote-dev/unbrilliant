import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"
import { useNavigation } from "@/lib/navigation"
import { useAuth } from "@/lib/auth"
import { LessonTopBar } from "@/components/willow/LessonTopBar"
import { SignInNudge } from "@/components/willow/SignInNudge"
import { comboToTier, isOnStreak } from "@/components/willow/Flame"
import { useNavChrome } from "@/components/willow/NavChromeProvider"
import { useIsDesktop } from "@/hooks/useMediaQuery"
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
  const { immersive, menuOpen } = useNavChrome()
  const isDesktop = useIsDesktop()
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

  // On phones during a lesson the tab bar condenses to a corner cell. Open, the
  // whole column lifts so the centered tab bar can rest across the bottom (like
  // every other screen); closed, only the primary CTA gives up a right gutter for
  // the cell (the `.lesson-cta`/`-tuck` classes drive that in index.css), so the
  // centered lesson body never shifts. The vertical lift lives here; the
  // horizontal tuck is on the CTA itself.
  const mobileImmersive = !isDesktop && immersive
  const immersivePad =
    mobileImmersive && menuOpen
      ? "pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+5.5rem))]"
      : "pb-6"

  return (
    <div
      className={cn(
        "lesson-cta flex min-h-svh flex-col px-5 pt-6 transition-[padding] duration-300 ease-out motion-reduce:transition-none lg:mx-auto lg:min-h-0 lg:w-full lg:max-w-[var(--willow-lesson-max)] lg:flex-1",
        mobileImmersive && !menuOpen && "lesson-cta-tuck",
        immersivePad,
      )}
    >
      <LessonTopBar
        totalParts={module.totalParts}
        filledParts={module.filledParts(state)}
        tier={comboToTier(module.combo(state))}
        onClose={back}
      />

      {showNudge && (
        <SignInNudge
          onStreak={isOnStreak(module.combo(state))}
          onSignIn={() =>
            navigate({
              name: "signin",
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
