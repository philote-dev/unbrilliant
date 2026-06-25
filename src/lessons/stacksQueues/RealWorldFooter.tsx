import type { Dispatch } from "react"
import { Check, Lightbulb, X } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Feedback, LessonAction, QuestionCopy } from "@/features/lesson/engine"

/**
 * A themed verdict footer for the full-bleed real-world scenes (Browser Back and
 * the print queue), the S&Q sibling of Linked Lists' PlaylistFooter. It mirrors the
 * shared FeedbackFooter's state machine and button labels exactly (Check /
 * Continue / Why? / Reattempt) and dispatches the same actions, so the gate and
 * the e2e tracer behave identically; only the skin differs.
 *
 * Accessibility: every state pairs an icon with text (and the silent fail state
 * adds a screen-reader-only status), so meaning never rides on colour alone, and
 * nothing names the answer before the verdict.
 */
type Variant = "browser" | "printer"

interface Theme {
  surface: string
  hint: string
  primary: string
  secondary: string
  ok: string
  bad: string
  warn: string
}

const THEMES: Record<Variant, Theme> = {
  browser: {
    surface: "border-t border-neutral-200 bg-white",
    hint: "text-neutral-500",
    primary:
      "bg-[#1a73e8] text-white hover:bg-[#1769d6] focus-visible:ring-[#1a73e8]/50",
    secondary:
      "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 focus-visible:ring-neutral-400/50",
    ok: "text-emerald-600",
    bad: "text-red-600",
    warn: "text-amber-600",
  },
  printer: {
    surface: "border-t border-black/10 bg-[#dfe2e6]",
    hint: "text-neutral-500",
    primary:
      "bg-[#3b82f6] text-white hover:bg-[#2f74e6] focus-visible:ring-[#3b82f6]/50",
    secondary:
      "bg-black/5 text-neutral-700 hover:bg-black/10 focus-visible:ring-neutral-400/50",
    ok: "text-emerald-600",
    bad: "text-red-600",
    warn: "text-amber-600",
  },
}

export function RealWorldFooter({
  variant,
  feedback,
  showWhy,
  canCheck,
  copy,
  dispatch,
}: {
  variant: Variant
  feedback: Feedback
  showWhy: boolean
  canCheck: boolean
  copy: QuestionCopy
  dispatch: Dispatch<LessonAction>
}) {
  const t = THEMES[variant]

  return (
    <div className={cn("mt-auto min-h-[128px] px-5 pb-6 pt-3", t.surface)}>
      {feedback === "idle" && (
        <>
          <p className={cn("mb-3 text-center text-sm", t.hint)}>{copy.hint}</p>
          <PrimaryButton theme={t} disabled={!canCheck} onClick={() => dispatch({ type: "check" })}>
            Check
          </PrimaryButton>
        </>
      )}

      {feedback === "nudge" && (
        <>
          <Chip icon={<Lightbulb className="size-4" strokeWidth={2.5} />} tone={t.warn}>
            {copy.nudge}
          </Chip>
          <PrimaryButton theme={t} disabled={!canCheck} onClick={() => dispatch({ type: "check" })}>
            Check
          </PrimaryButton>
        </>
      )}

      {feedback === "correct" && (
        <>
          <Chip icon={<Check className="size-4" strokeWidth={3} />} tone={t.ok}>
            {copy.correct}
          </Chip>
          <PrimaryButton theme={t} onClick={() => dispatch({ type: "next" })}>
            Continue
          </PrimaryButton>
        </>
      )}

      {feedback === "fail" && (
        <>
          {showWhy ? (
            <Chip icon={<Lightbulb className="size-4" strokeWidth={2.5} />} tone={t.bad}>
              {copy.why}
            </Chip>
          ) : (
            <div className="mb-4 flex flex-col items-center gap-2 text-center">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full bg-current/15",
                  t.bad,
                )}
                aria-hidden
              >
                <X className="size-4" strokeWidth={3} />
              </span>
              <p role="status" className="sr-only">
                Try again. Tap Why for the answer, or reattempt.
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <SecondaryButton
              theme={t}
              disabled={showWhy}
              onClick={() => dispatch({ type: "reveal" })}
            >
              Why?
            </SecondaryButton>
            <PrimaryButton theme={t} onClick={() => dispatch({ type: "reattempt" })}>
              Reattempt
            </PrimaryButton>
          </div>
        </>
      )}
    </div>
  )
}

function PrimaryButton({
  theme,
  children,
  onClick,
  disabled,
}: {
  theme: Theme
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full rounded-full py-3.5 text-center text-[15px] font-bold outline-none transition-transform active:scale-[0.99] disabled:opacity-40",
        "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        theme.primary,
      )}
    >
      {children}
    </button>
  )
}

function SecondaryButton({
  theme,
  children,
  onClick,
  disabled,
}: {
  theme: Theme
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex-1 rounded-full py-3.5 text-center text-[15px] font-semibold outline-none transition-colors disabled:opacity-40",
        "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        theme.secondary,
      )}
    >
      {children}
    </button>
  )
}

function Chip({
  icon,
  tone,
  children,
}: {
  icon: React.ReactNode
  tone: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-center gap-2 text-center">
      <span className={cn("mt-0.5 shrink-0", tone)} aria-hidden>
        {icon}
      </span>
      <p className={cn("text-sm", tone)}>{children}</p>
    </div>
  )
}
