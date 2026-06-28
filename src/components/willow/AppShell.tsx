import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { BottomNav } from "@/components/willow/BottomNav"
import { MobileImmersiveNav } from "@/components/willow/MobileImmersiveNav"
import { NavChromeProvider, useNavChrome } from "@/components/willow/NavChromeProvider"
import { DesktopShell } from "@/components/willow/desktop/DesktopShell"
import { useIsDesktop } from "@/hooks/useMediaQuery"

/**
 * The single layout seam. At `lg`+ it renders the DesktopShell (collapsible
 * SideNav + centered capped main). Below `lg` it renders the mobile-first column
 * with a bottom nav that becomes a condensed corner icon during the lesson flow.
 * NavChromeProvider sits here so both shells share one nav-chrome state.
 */
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
    <NavChromeProvider>
      <AppShellInner bottomNav={bottomNav} className={className}>
        {children}
      </AppShellInner>
    </NavChromeProvider>
  )
}

function AppShellInner({
  children,
  bottomNav,
  className,
}: {
  children: ReactNode
  bottomNav: boolean
  className?: string
}) {
  const isDesktop = useIsDesktop()
  const { immersive } = useNavChrome()

  if (isDesktop) {
    return <DesktopShell className={className}>{children}</DesktopShell>
  }

  return (
    <div className="relative mx-auto flex min-h-svh w-full max-w-md flex-col bg-background">
      <div className={cn("flex flex-1 flex-col", className)}>{children}</div>

      {immersive ? (
        <MobileImmersiveNav />
      ) : bottomNav ? (
        <div className="fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto max-w-md px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <BottomNav />
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Action pinned just above the bottom nav (e.g. the tactile Start pill). */
export function PinnedAction({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktop()

  if (isDesktop) {
    return (
      <div className="sticky bottom-6 z-30 mx-auto mt-8 w-full max-w-md">
        {children}
      </div>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30">
      <div className="mx-auto max-w-md px-5 pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+5.5rem))]">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background via-background/90 to-transparent" />
        <div className="pointer-events-auto relative">{children}</div>
      </div>
    </div>
  )
}
