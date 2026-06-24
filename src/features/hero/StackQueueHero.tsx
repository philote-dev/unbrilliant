import { useState } from "react"
import { ArrowDown, ArrowUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { StructureColumn } from "@/features/hero/StructureColumn"

type Mode = "stack" | "queue"
const LETTERS = ["A", "B", "C", "D", "E", "F"]

/**
 * The interactive Stack/Queue panel. Push & pop / enqueue & dequeue, animated
 * via Framer Motion so the rule is *seen*. Standalone it toggles Stack (LIFO) vs
 * Queue (FIFO); pass a `mode` to lock it to one structure (used inside the lesson
 * as the per-section play step. It starts empty so the learner builds it up).
 */
export function StackQueueHero({
  className,
  mode: lockedMode,
}: {
  className?: string
  mode?: Mode
}) {
  const locked = lockedMode != null
  const max = locked ? 6 : 4
  const [internalMode, setInternalMode] = useState<Mode>(lockedMode ?? "stack")
  const mode = lockedMode ?? internalMode
  // cards (top → bottom) + a monotonic counter for the next letter, kept in ONE
  // state so a functional update derives the letter freshly (no stale-closure
  // dupes on fast taps, StrictMode-safe).
  const [hero, setHero] = useState<{ cards: string[]; n: number }>(
    locked ? { cards: [], n: 0 } : { cards: ["C", "B", "A"], n: 3 },
  )
  const cards = hero.cards

  const switchMode = (next: Mode) => {
    setInternalMode(next)
    setHero({ cards: ["C", "B", "A"], n: 3 })
  }

  const add = () =>
    setHero((s) => {
      if (s.cards.length >= max) return s
      const letter = LETTERS[s.n % LETTERS.length]
      // stack pushes to the top (front of array); queue enqueues to the back (end)
      return {
        cards: mode === "stack" ? [letter, ...s.cards] : [...s.cards, letter],
        n: s.n + 1,
      }
    })

  // both leave from the top of the column (stack pop / queue dequeue at front)
  const remove = () => setHero((s) => ({ ...s, cards: s.cards.slice(1) }))

  const tags: Record<string, string> = {}
  if (cards.length) {
    tags[cards[0]] = mode === "stack" ? "TOP" : "FRONT"
    if (mode === "queue") tags[cards[cards.length - 1]] = "BACK"
  }

  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-card p-5 shadow-card",
        className,
      )}
    >
      {/* segmented toggle. Hidden when the structure is locked (lesson use) */}
      {!locked && (
        <div className="mx-auto mb-2 flex w-full max-w-xs rounded-full bg-muted p-1">
          {(["stack", "queue"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={cn(
                "flex-1 rounded-full py-1.5 text-sm font-semibold transition-colors",
                mode === m
                  ? "bg-card text-lilac-strong shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "stack" ? "Stack · LIFO" : "Queue · FIFO"}
            </button>
          ))}
        </div>
      )}

      {/* stage. Column is grounded at the bottom; arrows hint where ops happen */}
      <div className="relative flex min-h-[300px] flex-col items-center justify-end pb-2">
        <ArrowHint
          className="left-3 top-3"
          label={mode === "stack" ? "push" : "dequeue"}
          dir={mode === "stack" ? "down" : "up"}
        />
        <ArrowHint
          className="right-3 top-3"
          label={mode === "stack" ? "pop" : ""}
          dir="up"
          hidden={mode === "queue"}
        />
        <ArrowHint
          className="bottom-16 left-3"
          label={mode === "queue" ? "enqueue" : ""}
          dir="down"
          hidden={mode === "stack"}
        />
        <StructureColumn cards={cards} tags={tags} size="md" />
      </div>

      <p className="mb-4 text-center text-sm text-muted-foreground">
        {mode === "stack"
          ? "Cards go in and out at the top. Last in, first out."
          : "In at the back, out at the front. First in, first out."}
      </p>

      <div className="flex gap-3">
        <Button
          variant="soft"
          className="flex-1"
          onClick={add}
          disabled={cards.length >= max}
        >
          {mode === "stack" ? "Push" : "Enqueue"}
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onClick={remove}
          disabled={cards.length === 0}
        >
          {mode === "stack" ? "Pop" : "Dequeue"}
        </Button>
      </div>
    </div>
  )
}

function ArrowHint({
  label,
  dir,
  className,
  hidden,
}: {
  label: string
  dir: "up" | "down"
  className?: string
  hidden?: boolean
}) {
  if (hidden || !label) return null
  const Icon = dir === "up" ? ArrowUp : ArrowDown
  return (
    <span
      className={cn(
        "absolute inline-flex items-center gap-1 rounded-full bg-lilac-soft px-2.5 py-1 text-xs font-semibold text-lilac-strong",
        className,
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.5} />
      {label}
    </span>
  )
}
