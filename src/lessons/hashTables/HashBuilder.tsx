import { cn } from "@/lib/utils"
import {
  RULE_LABEL,
  type CombineRule,
} from "@/features/lesson/hashTablesEngine"
import { HashTable } from "./HashTable"

/**
 * The shared make-a-hash control panel: a row of combine-rule chips, a row of
 * bucket-count chips, and the live distribution those choices produce, with any
 * colliding bins tinted and a running collision count. Purely presentational. The
 * free-play sandbox (`hash-build-demo`) and the graded design challenge
 * (`hash-design`) both render it; the sandbox owns the choice in local state, the
 * design beat owns it in the engine so it can grade the result.
 */
export function HashBuilder({
  rule,
  buckets,
  ruleOptions,
  bucketOptions,
  table,
  collisions,
  onPickRule,
  onPickBuckets,
  disabled,
  reducedMotion,
}: {
  rule: CombineRule
  buckets: number
  ruleOptions: CombineRule[]
  bucketOptions: number[]
  /** The live distribution for the current rule + bucket count. */
  table: Record<number, string[]>
  /** How many keys collide (share a bin with an earlier key). */
  collisions: number
  onPickRule: (rule: CombineRule) => void
  onPickBuckets: (count: number) => void
  /** Locks the controls (e.g. after a correct verdict). */
  disabled?: boolean
  reducedMotion?: boolean
}) {
  const collisionBuckets = new Set(
    Object.entries(table)
      .filter(([, chain]) => chain.length > 1)
      .map(([i]) => Number(i)),
  )

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <ControlRow label="Combine the key by">
        {ruleOptions.map((r) => (
          <Chip
            key={r}
            active={r === rule}
            disabled={disabled}
            onClick={() => onPickRule(r)}
          >
            {RULE_LABEL[r]}
          </Chip>
        ))}
      </ControlRow>

      <ControlRow label="Number of bins">
        {bucketOptions.map((b) => (
          <Chip
            key={b}
            active={b === buckets}
            disabled={disabled}
            onClick={() => onPickBuckets(b)}
          >
            {b}
          </Chip>
        ))}
      </ControlRow>

      <HashTable
        bucketCount={buckets}
        table={table}
        mode="display"
        collisionBuckets={collisionBuckets}
        reducedMotion={reducedMotion}
        className="mx-auto"
      />

      <CollisionReadout collisions={collisions} />
    </div>
  )
}

/* --------------------------------- pieces --------------------------------- */

function ControlRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">{children}</div>
    </div>
  )
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-lg border-2 px-2.5 py-1 text-sm font-bold outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-lilac-strong/60",
        disabled && "cursor-default opacity-60",
        active
          ? "border-lilac-strong bg-lilac-soft text-foreground"
          : "border-border bg-card text-muted-foreground hover:border-lilac-strong/45",
      )}
    >
      {children}
    </button>
  )
}

/** A live verdict chip: green when nothing collides, amber with the count otherwise. */
function CollisionReadout({ collisions }: { collisions: number }) {
  const clean = collisions === 0
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "mx-auto flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold",
        clean
          ? "border-success/40 bg-success-soft text-foreground"
          : "border-warning/50 bg-warning-soft text-foreground",
      )}
    >
      <span
        className={cn("size-2.5 rounded-full", clean ? "bg-success" : "bg-warning")}
        aria-hidden
      />
      {clean
        ? "No collisions: every key has its own bin"
        : `${collisions} ${collisions === 1 ? "key collides" : "keys collide"}`}
    </div>
  )
}
