import { Menu } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Shown whenever the desktop rail is collapsed. Two ways to reopen: a persistent
 * three-line icon (top-left corner), and an edge peek - a thin lilac sliver hint
 * that slides in when the cursor approaches the far left edge; clicking either
 * opens the rail.
 */
export function CollapsedReveal({
  onOpen,
  reduce,
}: {
  onOpen: () => void
  reduce: boolean
}) {
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Show sidebar"
        title="Show sidebar"
        className="fixed left-4 top-4 z-50 flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-card transition-colors hover:bg-muted hover:text-foreground"
      >
        <Menu className="size-5" />
      </button>

      {/* Edge-peek hover zone: invisible hit area at the far left edge. */}
      <div className="group fixed inset-y-0 left-0 z-40 w-3">
        <button
          type="button"
          onClick={onOpen}
          aria-label="Show sidebar"
          tabIndex={-1}
          className={cn(
            "absolute inset-y-0 left-0 my-auto h-24 w-1.5 -translate-x-2 rounded-r-full bg-lilac-strong/40 opacity-0",
            "group-hover:translate-x-0 group-hover:opacity-100 hover:bg-lilac-strong/60",
            reduce ? "transition-none" : "transition-all duration-200 ease-out",
          )}
        />
      </div>
    </>
  )
}
