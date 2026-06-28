import { Menu } from "lucide-react"

/**
 * Mobile lesson-flow nav: the bottom pill condensed to a corner three-line icon.
 * Full expand/condense behavior is added in a later task; this is the minimal shell.
 */
export function MobileImmersiveNav() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto flex max-w-md justify-end px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          aria-label="Show navigation"
          className="pointer-events-auto flex size-12 items-center justify-center rounded-2xl border border-border bg-card/90 text-foreground shadow-card backdrop-blur-md"
        >
          <Menu className="size-5" />
        </button>
      </div>
    </div>
  )
}
