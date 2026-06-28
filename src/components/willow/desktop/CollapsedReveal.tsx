import { Menu } from "lucide-react"

export function CollapsedReveal({ onOpen }: { onOpen: () => void; reduce: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Show sidebar"
      title="Show sidebar"
      className="fixed left-4 top-4 z-50 flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-card transition-colors hover:bg-muted hover:text-foreground"
    >
      <Menu className="size-5" />
    </button>
  )
}
