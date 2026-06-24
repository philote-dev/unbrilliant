import { Lock } from "lucide-react"
import type { ComponentType, SVGProps } from "react"

import { cn } from "@/lib/utils"

/**
 * An achievement chip: an icon in a rounded square plus a label. Earned badges
 * glow lilac; locked ones are muted with a small lock overlay.
 */
export function Badge({
  icon: Icon,
  label,
  earned,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  earned: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className={cn(
          "relative flex size-12 items-center justify-center rounded-2xl",
          earned ? "bg-lilac-soft text-lilac-strong" : "bg-muted text-faint",
        )}
      >
        <Icon className="size-6" aria-hidden />
        {!earned ? (
          <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-muted text-faint ring-2 ring-card">
            <Lock className="size-3" aria-hidden />
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "text-center text-xs font-medium",
          earned ? "text-foreground" : "text-faint",
        )}
      >
        {label}
      </span>
    </div>
  )
}
