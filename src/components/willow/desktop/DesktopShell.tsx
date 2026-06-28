import type { ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { SideNav } from "@/components/willow/desktop/SideNav"
import { CollapsedReveal } from "@/components/willow/desktop/CollapsedReveal"
import { useNavChrome } from "@/components/willow/NavChromeProvider"

/** Matches --willow-sidebar-w (260px). Animated to 0 when collapsed. */
const RAIL_W = 260

/**
 * The `lg`+ layout: a collapsible left SideNav beside a centered, capped main
 * column. The rail's width animates between RAIL_W and 0 so the content reflows
 * as one. While collapsed, CollapsedReveal provides a reopen icon and an
 * edge-peek sliver. Collapse state comes from NavChromeProvider (manual pref +
 * route immersion). Below `lg`, AppShell renders the mobile column instead.
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
        className="relative shrink-0 overflow-hidden"
        initial={false}
        animate={{ width: collapsed ? 0 : RAIL_W }}
        transition={reduce ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden={collapsed}
      >
        <div style={{ width: RAIL_W }} className="h-full">
          <SideNav onCollapse={close} />
        </div>
      </motion.div>

      {collapsed && <CollapsedReveal onOpen={open} reduce={!!reduce} />}

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
