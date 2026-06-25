import { ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react"

import { useNavigation } from "@/lib/navigation"
import { useTheme } from "@/lib/theme"

export function Settings() {
  const { back } = useNavigation()
  const { theme, toggle } = useTheme()
  const isDark = theme === "dark"

  return (
    <div className="flex flex-1 flex-col px-5 pb-28 pt-6 lg:mx-auto lg:w-full lg:max-w-lg lg:px-0 lg:pb-0 lg:pt-0">
      <div className="relative flex items-center justify-center">
        <button
          type="button"
          onClick={back}
          aria-label="Back"
          className="absolute left-0 flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">Settings</h1>
      </div>

      {/* appearance */}
      <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-center gap-3 px-5 py-4 transition-colors hover:bg-muted"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-muted text-foreground">
            {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </span>
          <span className="flex-1 text-left text-[15px] font-medium text-foreground">
            Appearance
          </span>
          <span className="text-sm text-muted-foreground">
            {isDark ? "Dark" : "Light"}
          </span>
        </button>
      </div>

      {/* about */}
      <div className="mt-4 flex items-center gap-3 rounded-3xl border border-border bg-card px-5 py-4 shadow-card">
        <span className="flex-1 text-[15px] font-medium text-foreground">
          About Willow
        </span>
        <ChevronRight className="size-4 text-faint" />
      </div>

      <p className="mt-6 text-center text-xs text-faint">
        Willow · algorithmic thinking, by doing
      </p>
    </div>
  )
}
