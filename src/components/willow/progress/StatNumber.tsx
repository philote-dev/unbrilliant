import type { ReactNode } from "react"

/** A big tabular number with a caption and optional sub-caption. */
export function StatNumber({
  value,
  label,
  sublabel,
}: {
  value: ReactNode
  label: string
  sublabel?: string
}) {
  return (
    <div className="flex flex-col">
      <span className="text-3xl font-bold tabular-nums leading-none text-foreground">
        {value}
      </span>
      <span className="mt-1.5 text-sm font-medium text-muted-foreground">{label}</span>
      {sublabel ? <span className="mt-0.5 text-xs text-faint">{sublabel}</span> : null}
    </div>
  )
}

/** Two stats side by side, separated by a thin divider. */
export function StatPair({
  left,
  right,
}: {
  left: ReactNode
  right: ReactNode
}) {
  return (
    <div className="flex items-stretch">
      <div className="flex-1">{left}</div>
      <div className="mx-4 w-px shrink-0 bg-border" />
      <div className="flex-1">{right}</div>
    </div>
  )
}
