import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { BottomNav } from "@/components/willow/BottomNav"

/** Centered mobile-first column (max-w-md) with an optional persistent nav. */
export function AppShell({
  children,
  bottomNav = false,
  className,
}: {
  children: ReactNode
  bottomNav?: boolean
  className?: string
}) {
  return (
    <div className="relative mx-auto flex min-h-svh w-full max-w-md flex-col bg-background">
      <div className={cn("flex flex-1 flex-col", className)}>{children}</div>

      {bottomNav && (
        <div className="fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto max-w-md px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <BottomNav />
          </div>
        </div>
      )}
    </div>
  )
}

/** Action pinned just above the bottom nav (e.g. the tactile Start pill). */
export function PinnedAction({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30">
      <div className="mx-auto max-w-md px-5 pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+5.5rem))]">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background via-background/90 to-transparent" />
        <div className="pointer-events-auto relative">{children}</div>
      </div>
    </div>
  )
}
