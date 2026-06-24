import { ChevronRight, Lock } from "lucide-react"
import type { ComponentType, SVGProps } from "react"

import { cn } from "@/lib/utils"
import { ProgressBar } from "@/components/willow/Progress"

type IconType = ComponentType<SVGProps<SVGSVGElement>>

/** Course-selection card. `available` = entry + progress; `soon` = locked. */
export function CourseCard({
  title,
  subtitle,
  Icon,
  state,
  progress = 0,
  onClick,
}: {
  title: string
  subtitle: string
  Icon: IconType
  state: "available" | "soon"
  progress?: number
  onClick?: () => void
}) {
  const available = state === "available"

  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={!available}
      className={cn(
        "group w-full rounded-3xl border bg-card p-5 text-left shadow-card transition-all outline-none",
        "focus-visible:ring-2 focus-visible:ring-lilac-strong/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        available
          ? "border-lilac-strong/30 hover:-translate-y-0.5 hover:shadow-pop"
          : "border-border",
      )}
    >
      <div className="flex items-center gap-4">
        <span
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-2xl",
            available ? "bg-lilac-soft text-lilac-strong" : "bg-muted text-faint",
          )}
        >
          <Icon className="size-7" strokeWidth={1.8} />
        </span>

        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              "text-lg font-semibold",
              available ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {title}
          </h3>
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
          <span
            className={cn(
              "mt-1.5 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
              available
                ? "bg-lilac text-lilac-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {!available && <Lock className="size-3" />}
            {available ? "Available" : "Coming soon"}
          </span>
        </div>

        {available ? (
          <ChevronRight className="size-5 shrink-0 text-lilac-strong" />
        ) : (
          <Lock className="size-5 shrink-0 text-faint" />
        )}
      </div>

      {available && (
        <div className="mt-4">
          <ProgressBar value={progress} />
          <p className="mt-1.5 text-xs font-medium text-lilac-strong">
            {Math.round(progress)}% complete
          </p>
        </div>
      )}
    </button>
  )
}
