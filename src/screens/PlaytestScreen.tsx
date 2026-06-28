import { useState } from "react"

import { Button } from "@/components/ui/button"
import { WillowMark } from "@/components/willow/Logo"
import { useNavigation } from "@/lib/navigation"
import { db } from "@/lib/firebase"
import { lessonName } from "@/lessons/catalog"
import { LessonPlayer } from "@/screens/LessonPlayer"
import { submitPlaytestFeedback } from "@/features/playtest/playtestFeedback"

type SubmitState = "idle" | "submitting" | "sent" | "error"

export function PlaytestScreen({ lessonId }: { lessonId: string }) {
  const { back, replace } = useNavigation()
  const [completed, setCompleted] = useState(false)
  const [notes, setNotes] = useState("")
  const [submitState, setSubmitState] = useState<SubmitState>("idle")
  const name = lessonName(lessonId)

  async function handleSubmit() {
    if (!notes.trim() || submitState === "submitting") return
    setSubmitState("submitting")
    try {
      await submitPlaytestFeedback(db, {
        lessonId,
        notes,
        path: `${window.location.pathname}${window.location.search}`,
        userAgent: window.navigator.userAgent,
      })
      setSubmitState("sent")
    } catch {
      setSubmitState("error")
    }
  }

  if (completed) {
    return (
      <main className="flex min-h-svh flex-col px-5 py-6 lg:mx-auto lg:w-full lg:max-w-[var(--willow-lesson-max)]">
        <section className="mt-auto rounded-[2rem] border border-primary/15 bg-card p-6 text-center shadow-soft">
          <WillowMark className="mx-auto mb-5 size-10" />
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
            Playtest complete
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-foreground">
            Be blunt.
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-base leading-7 text-muted-foreground">
            What felt buggy, confusing, slow, too easy, too hard, or worth
            improving in {name}?
          </p>

          {submitState === "sent" ? (
            <div className="mt-8 rounded-3xl bg-primary/10 px-5 py-6 text-primary">
              <p className="text-lg font-black">Thank you.</p>
              <p className="mt-2 text-sm font-semibold">
                Your notes were saved for review.
              </p>
            </div>
          ) : (
            <div className="mt-7 text-left">
              <label
                htmlFor="playtest-notes"
                className="text-sm font-bold text-foreground"
              >
                Bugs, confusion, or improvements
              </label>
              <textarea
                id="playtest-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={7}
                maxLength={3000}
                placeholder="Be as blunt as you want. Screens, bugs, polish, confusing copy, and missing interactions are all useful."
                className="mt-3 w-full resize-none rounded-[1.5rem] border border-border bg-background px-4 py-4 text-base leading-7 text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
              />
              {submitState === "error" && (
                <p className="mt-3 text-sm font-semibold text-destructive">
                  Feedback did not save. Check your connection and try again.
                </p>
              )}
              <Button
                type="button"
                variant="tactile"
                size="lg"
                className="mt-5 w-full"
                disabled={!notes.trim() || submitState === "submitting"}
                onClick={handleSubmit}
              >
                {submitState === "submitting" ? "Sending..." : "Send feedback"}
              </Button>
            </div>
          )}
        </section>

        <Button
          type="button"
          variant="ghost"
          className="mx-auto mt-auto"
          onClick={back}
        >
          Close playtest
        </Button>
      </main>
    )
  }

  return (
    <main className="min-h-svh">
      <div className="px-5 pt-5 lg:mx-auto lg:w-full lg:max-w-[var(--willow-lesson-max)]">
        <div className="rounded-[1.5rem] border border-primary/15 bg-primary/10 px-4 py-3 text-center shadow-soft">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
            Playtest for {name}
          </p>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Please be blunt. After the lesson, note bugs and improvements.
          </p>
        </div>
      </div>
      <LessonPlayer
        lessonId={lessonId}
        hideSignInNudge
        onComplete={() => setCompleted(true)}
        onClose={() => replace({ name: "home" })}
      />
    </main>
  )
}
