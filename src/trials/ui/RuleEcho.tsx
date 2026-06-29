import type { OperationSpec, Position, StructureKind } from "@/features/trials/types"

/**
 * Restates each placed operation as a plain-language rule, keyed by `op id` +
 * `position`. This is the comprehension scaffold for weak-visual learners: the
 * board shows where a chip sits; the echo says what that placement *means*.
 * Unknown combinations fall back to "<op label> -> <position>".
 */
const RULE_PHRASES: Record<string, string> = {
  "arrival:back": "A new arrival joins the back of the line.",
  "arrival:front": "A new arrival cuts in at the front of the line.",
  "arrival:middle": "A new arrival squeezes into the middle of the line.",
  "serve:front": "Serve next takes from the front of the line.",
  "serve:back": "Serve next takes from the back of the line.",
  "serve:middle": "Serve next pulls from the middle of the line.",
  "remove:middle": "A cancellation is pulled out of the middle.",
  "remove:front": "A cancellation leaves from the front.",
  "remove:back": "A cancellation leaves from the back.",
  "record:top": "Each action is recorded on top of the pile.",
  "undo:top": "Undo lifts the most recent action off the top.",
}

function sentenceFor(op: OperationSpec, position: Position): string {
  return RULE_PHRASES[`${op.id}:${position}`] ?? `${op.label} -> ${position}`
}

export function RuleEcho({
  structure,
  mapping,
  operations,
}: {
  structure: StructureKind | null
  mapping: Record<string, Position>
  operations: OperationSpec[]
}) {
  if (structure == null) return null
  const placed = operations.filter((op) => mapping[op.id] != null)
  if (placed.length === 0) return null

  return (
    <ul className="flex flex-col gap-2">
      {placed.map((op) => (
        <li
          key={op.id}
          className="flex items-start gap-2 text-sm leading-relaxed text-foreground"
        >
          <span
            aria-hidden
            className="mt-1.5 size-1.5 shrink-0 rounded-full bg-lilac-strong"
          />
          <span>{sentenceFor(op, mapping[op.id])}</span>
        </li>
      ))}
    </ul>
  )
}
