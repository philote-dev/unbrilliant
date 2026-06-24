import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Shared shell every metric tile renders inside, so tiles stay drop-in and
 * visually consistent. Optional small heading, then the tile body.
 */
export function MetricCard({
  title,
  children,
  className,
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-card p-5 shadow-card",
        className,
      )}
    >
      {title ? (
        <div className="mb-3 text-sm font-semibold text-foreground">{title}</div>
      ) : null}
      {children}
    </div>
  )
}
