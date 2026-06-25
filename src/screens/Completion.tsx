import { useEffect, useState } from "react"
import { ArrowRight, Sparkles } from "lucide-react"
import { motion } from "motion/react"

import { useNavigation } from "@/lib/navigation"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { WillowLogo, WillowMark } from "@/components/willow/Logo"
import { Flame } from "@/components/willow/Flame"
import { CompletionChecks } from "@/components/willow/CompletionChecks"
import { SignInPrompt } from "@/components/willow/SignInPrompt"
import { useCourseProgress } from "@/features/progress/CourseProgressProvider"
import { derivePathNodes, lessonName } from "@/lessons/catalog"

/** Per-lesson mastery checks shown on the completion screen. */
const COMPLETION_CHECKS: Record<string, string[]> = {
  "stacks-and-queues": ["Stacks", "Queues", "Compare"],
  arrays: ["Shifting", "Counting", "Resizing"],
}

export function Completion({ lessonId }: { lessonId: string }) {
  const { navigate } = useNavigation()
  const { user } = useAuth()
  const { progressByLesson, refresh } = useCourseProgress()
  const [promptDismissed, setPromptDismissed] = useState(false)
  const [promptReady, setPromptReady] = useState(false)

  // Re-read persisted progress on mount so the "next lesson" CTA derives from
  // fresh server state. Without this, the once-per-sign-in `server` snapshot
  // still shows an earlier lesson as in-flight (the live overlay only covers the
  // ACTIVE lesson), so the CTA could point back at an already-completed lesson.
  useEffect(() => {
    refresh()
  }, [refresh])

  // Re-prompt a signed-out learner to save their progress at every completion.
  // Briefly delayed so the celebration lands first; dismissible, and shown fresh
  // on each completion (this screen remounts per lesson), so it recurs until they
  // sign in. The in-lesson nudge (~a third in) is the other re-prompt point.
  useEffect(() => {
    if (user) return
    const t = setTimeout(() => setPromptReady(true), 650)
    return () => clearTimeout(t)
  }, [user])

  // The forward CTA leads into the next now-unlocked lesson (S&Q -> Arrays); when
  // there's nothing further, it returns to the course path.
  const next = derivePathNodes(progressByLesson).find(
    (n) => n.state === "current" || n.state === "available",
  )
  const checks = COMPLETION_CHECKS[lessonId] ?? []

  return (
    <div className="flex min-h-svh flex-1 flex-col items-center px-6 pb-10 pt-8 lg:mx-auto lg:min-h-0 lg:max-w-md">
      <WillowLogo size="sm" />

      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative mb-2 flex h-44 w-full items-center justify-center">
          <span
            className="absolute size-44 rounded-full"
            style={{
              background:
                "radial-gradient(circle, var(--lilac-soft) 0%, transparent 70%)",
            }}
          />
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 18 }}
          >
            <WillowMark className="size-32" />
          </motion.div>
          <div className="absolute right-10 top-8">
            <Flame tier={3} size={56} />
          </div>
          <Sparkles className="absolute left-12 top-6 size-4 text-lilac-strong/70" />
          <Sparkles className="absolute right-8 bottom-10 size-3 text-lilac-strong/60" />
        </div>

        <motion.h1
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-[30px] font-bold text-foreground"
        >
          Lesson complete
        </motion.h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          You mastered {lessonName(lessonId)}.
        </p>

        {checks.length > 0 && (
          <CompletionChecks
            className="mt-6 w-full"
            items={checks.map((label) => ({ label, done: true }))}
          />
        )}
      </div>

      <div className="w-full space-y-3">
        <Button
          variant="tactile"
          size="lg"
          className="w-full"
          onClick={() =>
            next
              ? navigate({ name: "lesson", lessonId: next.id })
              : navigate({ name: "course", courseId: "data-structures" })
          }
        >
          {next ? `Continue to ${next.name}` : "Back to course"}
          <ArrowRight className="size-5" />
        </Button>
        <button
          type="button"
          onClick={() => navigate({ name: "home" })}
          className="w-full text-center text-sm font-medium text-lilac-strong hover:underline"
        >
          Back to home
        </button>
      </div>

      {!user && promptReady && !promptDismissed && (
        <SignInPrompt
          body={`Sign in to keep your streak and save ${lessonName(lessonId)}.`}
          onSignIn={() =>
            navigate({
              name: "signin",
              reason: "Sign in to save your progress.",
              intent: "save",
            })
          }
          onDismiss={() => setPromptDismissed(true)}
        />
      )}
    </div>
  )
}
