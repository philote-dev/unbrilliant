import { createPortal } from "react-dom"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { WillowMark } from "@/components/willow/Logo"

/**
 * A dismissible, centered sign-in pop-up (portal + backdrop). Used at the natural
 * re-prompt moments (e.g. lesson completion) to nudge a signed-out learner to
 * save their progress. Renders nothing once dismissed by the caller. The caller
 * shows it again at the next milestone, so it recurs until the learner signs in.
 */
export function SignInPrompt({
  title = "Save your progress",
  body,
  onSignIn,
  onDismiss,
}: {
  title?: string
  body: string
  onSignIn: () => void
  onDismiss: () => void
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="absolute inset-0 cursor-default bg-foreground/30 backdrop-blur-sm"
      />
      <div className="animate-pop-in relative w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-pop">
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="absolute right-3.5 top-3.5 flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-5" />
        </button>

        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-lilac-soft">
          <WillowMark className="size-9" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-foreground">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
          {body}
        </p>

        <Button
          variant="tactile"
          size="lg"
          className="mt-5 w-full"
          onClick={onSignIn}
        >
          Sign in
        </Button>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-3 w-full text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Maybe later
        </button>
      </div>
    </div>,
    document.body,
  )
}
