import { motion, useReducedMotion } from "motion/react"

import { Button } from "@/components/ui/button"

/**
 * The immersive entrance. A deep lilac scrim dims the world behind, and a single
 * crested Trial card sets the open-ended, commit-and-revise expectation before
 * the working surface appears. Calls `onBegin` when the learner steps in.
 */
export function TrialGate({
  onBegin,
  title = "The Trial",
}: {
  onBegin: () => void
  title?: string
}) {
  const reduce = useReducedMotion()

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-5 py-10">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 100% at 50% -10%, rgba(58,47,107,0.94), rgba(15,12,28,0.96))",
        }}
      />
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/10 shadow-pop"
      >
        <div
          className="relative px-6 pb-6 pt-7 text-white"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #2a2540, var(--lilac-strong) 62%, var(--lilac))",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-white/15">
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 20 10 6l4 8 3-5 4 11z" />
              </svg>
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
              Trial
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight text-white">
            {title}
          </h1>
        </div>

        <div className="flex flex-col gap-5 bg-card px-6 pb-7 pt-6">
          <p className="text-base leading-relaxed text-foreground">
            This is not a lesson. You will design a small system for a client.
            Your choices will be saved. Later changes may stress your design.
          </p>
          <Button
            variant="tactile"
            size="lg"
            className="w-full"
            onClick={onBegin}
          >
            Begin the Trial
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
