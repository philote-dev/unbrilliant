import { useEffect, useState, type ReactNode } from "react"
import { Menu } from "lucide-react"

import { cn } from "@/lib/utils"
import { SideNav } from "@/components/willow/desktop/SideNav"

/**
 * The `lg`+ layout: a persistent left SideNav beside a centered, capped main
 * column. The rail can be hidden via its three-line button; when hidden a small
 * floating control brings it back. The collapsed choice persists across screens
 * and reloads. Below `lg`, AppShell renders the mobile column instead.
 */
const COLLAPSE_KEY = "willow.sidebar.collapsed"

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1"
  } catch {
    return false
  }
}

export function DesktopShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const [collapsed, setCollapsed] = useState(readCollapsed)

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0")
    } catch {
      // localStorage may be unavailable; the toggle still works for the session.
    }
  }, [collapsed])

  return (
    <div className="flex min-h-svh w-full bg-background">
      {!collapsed && <SideNav onCollapse={() => setCollapsed(true)} />}
      <main className="relative flex min-w-0 flex-1 flex-col">
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Show sidebar"
            title="Show sidebar"
            className="fixed left-4 top-4 z-50 flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-card transition-colors hover:bg-muted hover:text-foreground"
          >
            <Menu className="size-5" />
          </button>
        )}
        <div
          className={cn(
            "mx-auto flex w-full max-w-[var(--willow-content-max)] flex-1 flex-col px-8 py-8",
            collapsed && "pt-16",
            className,
          )}
        >
          {children}
        </div>
      </main>
    </div>
  )
}
