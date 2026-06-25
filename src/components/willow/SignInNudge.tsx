import { X } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * A subtle, non-blocking, dismissible nudge to sign in mid-run. Surfaced at a
 * natural moment (after the first correct answer), never a modal over a
 * prediction. See docs/prototype.md (auth/persistence model).
 */
export function SignInNudge({
  onSignIn,
  onDismiss,
}: {
  onSignIn: () => void
  onDismiss: () => void
}) {
  return (
    <div className="animate-slide-up mt-3 flex items-center gap-2.5 rounded-2xl border border-lilac-strong/20 bg-lilac-soft/70 px-3.5 py-2.5">
      <p className="flex-1 text-xs text-foreground">
        On a roll.{" "}
        <span className="font-medium text-lilac-strong">
          Sign in to save your progress and streak.
        </span>
      </p>
      <Button variant="soft" size="sm" onClick={onSignIn}>
        Sign in
      </Button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
