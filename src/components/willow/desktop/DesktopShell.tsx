import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { SideNav } from "@/components/willow/desktop/SideNav"

/**
 * The `lg`+ layout: a persistent left SideNav beside a centered, capped main
 * column. Used for every screen (including lessons), so the rail is always
 * present on desktop. Below `lg`, AppShell renders the mobile column instead.
 */
export function DesktopShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className="flex min-h-svh w-full bg-background">
      <SideNav />
      <main className="flex min-w-0 flex-1 flex-col">
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
