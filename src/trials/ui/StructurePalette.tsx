import { cn } from "@/lib/utils"
import type { StructureKind } from "@/features/trials/types"

/** Learner-facing name + one-line meaning for each structure. */
export const STRUCTURE_META: Record<
  StructureKind,
  { label: string; blurb: string }
> = {
  queue: {
    label: "Queue",
    blurb: "First in line is served first; newcomers join the back.",
  },
  stack: {
    label: "Stack",
    blurb: "The newest item sits on top and is lifted off first.",
  },
  array: {
    label: "Array",
    blurb: "Numbered slots in a row; a middle edit shifts the rest.",
  },
  "linked-list": {
    label: "Linked list",
    blurb: "A connected chain; neighbors relink around an edit.",
  },
}

/**
 * The structure palette: the offered structures as selectable cards. Clicking a
 * card chooses that structure (the parent dispatches `choose-structure`); the
 * chosen card stays highlighted. Empty for prediction segments (none offered).
 */
export function StructurePalette({
  offered,
  chosen,
  onChoose,
}: {
  offered: StructureKind[]
  chosen: StructureKind | null
  onChoose: (structure: StructureKind) => void
}) {
  if (offered.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Choose a structure
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {offered.map((kind) => {
          const meta = STRUCTURE_META[kind]
          const selected = chosen === kind
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={selected}
              onClick={() => onChoose(kind)}
              className={cn(
                "flex flex-col gap-1.5 rounded-2xl border p-3 text-left outline-none transition-[transform,border-color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px",
                selected
                  ? "border-lilac-strong bg-lilac-soft shadow-soft"
                  : "border-border bg-card hover:border-lilac-strong/50 hover:bg-lilac-soft/60",
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg text-lilac-strong",
                    selected ? "bg-card" : "bg-lilac-soft",
                  )}
                >
                  <StructureGlyph kind={kind} />
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {meta.label}
                </span>
                {selected && (
                  <svg
                    viewBox="0 0 24 24"
                    className="ml-auto size-4 text-lilac-strong"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12.5 10 17l9-10" />
                  </svg>
                )}
              </span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                {meta.blurb}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** A tiny schematic per structure; decorative, so it stays aria-hidden. */
function StructureGlyph({ kind }: { kind: StructureKind }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "size-4",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  }
  switch (kind) {
    case "stack":
      return (
        <svg {...common}>
          <rect x="5" y="5" width="14" height="4" rx="1" />
          <rect x="5" y="11" width="14" height="4" rx="1" />
          <rect x="5" y="17" width="14" height="3" rx="1" />
        </svg>
      )
    case "array":
      return (
        <svg {...common}>
          <rect x="3" y="9" width="5" height="6" rx="1" />
          <rect x="9.5" y="9" width="5" height="6" rx="1" />
          <rect x="16" y="9" width="5" height="6" rx="1" />
        </svg>
      )
    case "linked-list":
      return (
        <svg {...common}>
          <circle cx="6" cy="12" r="2.4" />
          <circle cx="18" cy="12" r="2.4" />
          <path d="M8.6 12h6.8" />
        </svg>
      )
    case "queue":
    default:
      return (
        <svg {...common}>
          <path d="M3 8h18M3 16h18" />
          <path d="M14 12h6m0 0-2.5-2.5M20 12l-2.5 2.5" />
        </svg>
      )
  }
}
