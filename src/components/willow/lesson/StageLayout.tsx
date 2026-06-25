import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { useIsDesktop } from "@/hooks/useMediaQuery"

/**
 * Desktop layout primitives for lesson beats. Both render the EXACT mobile
 * markup below `lg` (a `flex flex-1 flex-col` column), so the bespoke phone
 * layouts and their dev-only `data-*` hooks are untouched. At `lg`+ they reflow:
 *
 *  - StageSplit (beats with answer cards): the interactive figure takes a large
 *    left canvas; the prompt + cards + FeedbackFooter move into a right panel.
 *  - StageCenter (pure-interactive / teach / demo beats, no cards): the column
 *    centers and the figure scales up into the extra room.
 */

export function StageSplit({
  header,
  figure,
  interaction,
}: {
  /** Prompt header (kicker + question), plus any quota line. */
  header?: ReactNode
  /** The interactive figure section, with its own spacing wrapper. */
  figure: ReactNode
  /** Answer cards + FeedbackFooter (the things you act on). */
  interaction: ReactNode
}) {
  const isDesktop = useIsDesktop()

  if (isDesktop) {
    return (
      <div className="grid flex-1 grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-stretch gap-10 xl:gap-14">
        {/* Figure cell stretches its child to the full column width (no
            items-center) so width-fit figures and `w-full max-w-*` figures
            measure the real column and scale up; each figure centers its own
            content internally. */}
        <div className="flex min-w-0 flex-col justify-center">{figure}</div>
        <div className="flex min-w-0 flex-col">
          {header}
          {interaction}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      {header}
      {figure}
      {interaction}
    </div>
  )
}

export function StageCenter({
  children,
  /** Desktop max width for the centered column. Wider for figure-heavy beats. */
  maxWidthClass = "max-w-3xl",
  className,
}: {
  children: ReactNode
  maxWidthClass?: string
  className?: string
}) {
  const isDesktop = useIsDesktop()

  if (isDesktop) {
    return (
      <div
        className={cn(
          "mx-auto flex w-full flex-1 flex-col",
          maxWidthClass,
          className,
        )}
      >
        {children}
      </div>
    )
  }

  return <div className="flex flex-1 flex-col">{children}</div>
}
