import { useReducedMotion, motion } from "motion/react"

import { cn } from "@/lib/utils"
import { RewireSource } from "@/components/rewire/RewireSource"
import { RewireTarget } from "@/components/rewire/RewireTarget"
import { bucketTargetId, type HashQuestion } from "@/features/lesson/hashTablesEngine"
import { garmentFor, type Garment } from "./coatCheckData"

/** The draggable ticket's source id (value is opaque; grading is on the target). */
const TICKET_SOURCE = "hash-key"

/** Bucket geometry shared with the abstract HashTable, so rows never jump. */
const HOOK_BOX = "min-h-12 flex-1 items-center justify-start gap-1"

/**
 * The cloakroom skin of a hash table: a numbered wall of hooks (0…B-1), each a
 * drop target, and a coat to check in (a draggable ticket). The learner hashes
 * the owner's name to a hook and hangs the coat there. It's the real-world
 * mirror of the abstract drag beat: same rewire surface, same `bucket-N` target
 * ids, same single `data-hash-correct-bucket` tracer hook.
 *
 * Determinism: the hung coats are a pure function of `question.table` plus the
 * learner's own placement. The new coat rests on the hook the learner CHOSE
 * (`placedBucket`) until Check; only a correct verdict (`confirmed`) settles it
 * on `question.bucket`. The animation never picks the hook, and reduced motion
 * snaps every coat straight to rest.
 */
export function CoatCheckCounter({
  question,
  placedBucket,
  confirmed,
  reducedMotion,
}: {
  question: HashQuestion
  /** The hook index the learner dropped the coat on (their choice), if any. */
  placedBucket?: number | null
  /** The drop was graded correct: settle the coat on its hook. */
  confirmed?: boolean
  /** Force reduced motion (else the OS preference). */
  reducedMotion?: boolean
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false

  const key = question.key ?? ""
  const B = question.bucketCount
  const bucket = question.bucket
  const ticket = garmentFor(key)

  // Where the new coat currently hangs: nowhere until dropped, then on the
  // learner's chosen hook, finally pinned to its true hook once correct. Never
  // the correct hook before the learner picks it (no answer leak).
  const restingOn = confirmed ? bucket : placedBucket ?? null

  const coatsOn = (i: number): { node: string; isNew: boolean }[] => {
    const hung = (question.table[i] ?? []).map((node) => ({ node, isNew: false }))
    if (restingOn === i) hung.push({ node: key, isNew: true })
    return hung
  }

  return (
    <div
      data-reduced-motion={reduced ? "1" : undefined}
      className="flex w-full max-w-[300px] flex-col items-center gap-4"
    >
      {/* The coat to check in (a draggable ticket). One tracer hook lives here. */}
      <div className="flex flex-col items-center gap-1.5">
        <div
          data-hash-correct-bucket={
            import.meta.env.DEV ? bucketTargetId(bucket) : undefined
          }
        >
          <RewireSource
            id={TICKET_SOURCE}
            label={`Hang ${ticket.owner}'s ${ticket.kind} on its hook`}
          >
            <span className="flex items-center gap-2">
              <Swatch art={ticket.art} className="size-9" />
              <span className="flex flex-col items-start leading-tight">
                <span className="text-sm font-bold text-foreground">{ticket.label}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  Σ {key} = {question.sum}, mod {B}
                </span>
              </span>
            </span>
          </RewireSource>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Hash the name to a hook, then hang the coat there.
        </p>
      </div>

      {/* The wall of numbered hooks (each a drop target). */}
      <div className="flex w-full flex-col gap-1.5">
        {Array.from({ length: B }).map((_, i) => {
          const coats = coatsOn(i)
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-right text-[11px] font-semibold text-faint">
                {i}
              </span>
              <RewireTarget id={bucketTargetId(i)} label={`hook ${i}`} className={HOOK_BOX}>
                <HookIcon />
                <span className="flex min-w-0 items-center gap-1 overflow-x-auto">
                  {coats.length === 0 ? (
                    <span className="text-xs text-faint">empty</span>
                  ) : (
                    coats.map((c, idx) => (
                      <CoatChip
                        key={`${idx}-${c.node}`}
                        garment={garmentFor(c.node)}
                        isNew={c.isNew}
                        reduced={reduced}
                      />
                    ))
                  )}
                </span>
              </RewireTarget>
            </div>
          )
        })}
      </div>

      <p className="sr-only" role="status">
        {confirmed
          ? `${ticket.owner}'s ${ticket.kind} is hung on hook ${bucket}.`
          : restingOn != null
            ? `${ticket.owner}'s ${ticket.kind} is on hook ${restingOn}. Check your answer.`
            : `Hash ${key}: the letters sum to ${question.sum}; take ${question.sum} mod ${B} to choose a hook.`}
      </p>
    </div>
  )
}

/* --------------------------------- pieces --------------------------------- */

function Swatch({ art, className }: { art: [string, string]; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("shrink-0 rounded-md", className)}
      style={{ backgroundImage: `linear-gradient(135deg, ${art[0]}, ${art[1]})` }}
    />
  )
}

function CoatChip({
  garment,
  isNew,
  reduced,
}: {
  garment: Garment
  isNew: boolean
  reduced: boolean
}) {
  const animateIn = isNew && !reduced
  return (
    <motion.span
      layout
      initial={animateIn ? { opacity: 0, y: -18, scale: 0.8 } : false}
      animate={isNew ? { opacity: 1, y: 0, scale: 1 } : undefined}
      transition={animateIn ? { type: "spring", stiffness: 300, damping: 22 } : undefined}
      aria-label={`${garment.owner}'s ${garment.kind}`}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-lg border-2 px-1.5 py-1",
        isNew ? "border-lilac-strong bg-lilac-soft" : "border-border bg-card",
      )}
    >
      <Swatch art={garment.art} className="size-5" />
      <span className="text-xs font-semibold text-foreground">{garment.owner}</span>
    </motion.span>
  )
}

function HookIcon() {
  return (
    <span aria-hidden className="mr-0.5 inline-flex shrink-0 text-faint">
      <svg
        viewBox="0 0 12 20"
        className="h-5 w-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 2 v7 a3 3 0 0 1 -3 3" />
      </svg>
    </span>
  )
}
