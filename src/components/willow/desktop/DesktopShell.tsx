import type { ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { SideNav } from "@/components/willow/desktop/SideNav"
import { CollapsedReveal } from "@/components/willow/desktop/CollapsedReveal"
import { useNavChrome } from "@/components/willow/NavChromeProvider"

/** Matches --willow-sidebar-w. Animated to 0 when collapsed. */
const RAIL_W = 260

/** Shared close/open easing (easeOutQuint-ish): a confident settle, no bounce. */
const EASE = [0.22, 1, 0.36, 1] as const

/**
 * The `lg`+ layout: a collapsible left SideNav beside a centered, capped main
 * column. The rail's width animates between RAIL_W and 0 and its contents fade in
 * lockstep, so the column reflows as one clean motion with no clipped ghosting.
 * While collapsed, CollapsedReveal fades in a reopen icon and an edge-peek handle.
 * Collapse state comes from NavChromeProvider (manual pref + route immersion).
 * Below `lg`, AppShell renders the mobile column instead.
 */
export function DesktopShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const { collapsed, open, close } = useNavChrome()
  const reduce = useReducedMotion()

  return (
    <div className="flex min-h-svh w-full bg-background">
      <motion.div
        className="relative z-10 shrink-0 overflow-hidden"
        initial={false}
        animate={{ width: collapsed ? 0 : RAIL_W }}
        transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
        aria-hidden={collapsed}
      >
        {/* Fixed-width inner so the rail contents never squish while the frame
            collapses; the opacity fade hides the clip edge as it closes. */}
        <motion.div
          style={{ width: RAIL_W }}
          className="h-full"
          initial={false}
          animate={{ opacity: collapsed ? 0 : 1 }}
          transition={reduce ? { duration: 0 } : { duration: 0.18, ease: EASE }}
        >
          <SideNav onCollapse={close} />
        </motion.div>
      </motion.div>

      <CollapsedReveal collapsed={collapsed} onOpen={open} reduce={!!reduce} />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <div
          className={cn(
            "mx-auto flex w-full max-w-[var(--willow-content-max)] flex-1 flex-col px-8 py-8",
            className,
          )}
        >
          {children}
        </div>
      </main>
    </div>
  )
}
