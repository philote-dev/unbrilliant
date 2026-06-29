import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

/**
 * One operation rendered as a tappable pill, with three visual states:
 *  - default: resting in the operations tray, tap to arm it
 *  - armed: selected and waiting for a zone tap (lifted lilac ring)
 *  - placed: sitting inside a zone on the board, tap to lift it back off
 *
 * Presentational only: the parent owns arming/placing and passes `onClick`.
 */
export function OperationChip({
  label,
  armed = false,
  placed = false,
  className,
  ...props
}: Omit<ComponentProps<"button">, "children"> & {
  label: string
  armed?: boolean
  placed?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={placed ? undefined : armed}
      data-armed={armed || undefined}
      data-placed={placed || undefined}
      className={cn(
        "inline-flex select-none items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium outline-none transition-[transform,background-color,box-shadow,border-color] focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
        placed
          ? "border-transparent bg-primary text-primary-foreground shadow-soft"
          : armed
            ? "border-lilac-strong bg-lilac text-lilac-foreground shadow-[0_0_0_3px_color-mix(in_srgb,var(--lilac-strong)_30%,transparent)]"
            : "border-border bg-card text-foreground hover:border-lilac-strong/50 hover:bg-lilac-soft",
        className,
      )}
      {...props}
    >
      <span>{label}</span>
      {placed && (
        <svg
          viewBox="0 0 24 24"
          className="size-3.5 opacity-80"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.6}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      )}
    </button>
  )
}
