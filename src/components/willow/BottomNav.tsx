import { cn } from "@/lib/utils"
import { useNavigation } from "@/lib/navigation"
import { NAV_ITEMS } from "@/lib/navItems"

/** Persistent rounded-pill bottom navigation. */
export function BottomNav() {
  const { tab: active, navigate } = useNavigation()

  return (
    <nav className="pointer-events-auto mx-auto flex items-center justify-around gap-1 rounded-3xl border border-border bg-card/90 p-2 shadow-card backdrop-blur-md">
      {NAV_ITEMS.map(({ tab, label, Icon, target }) => {
        const isActive = tab === active
        return (
          <button
            key={tab}
            type="button"
            onClick={() => navigate(target)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] font-medium transition-colors",
              isActive
                ? "text-lilac-strong"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon
              className="size-5"
              strokeWidth={isActive ? 2.4 : 2}
              fill={isActive ? "var(--lilac)" : "none"}
            />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
