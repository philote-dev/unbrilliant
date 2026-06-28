import { ChevronRight, PanelLeft } from "lucide-react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

const EASE = [0.22, 1, 0.36, 1] as const

/**
 * The reopen affordances shown while the desktop rail is collapsed. Stays mounted
 * and animates on the `collapsed` flag (rather than mounting/unmounting) so it
 * fades and slides in as the rail finishes closing, and fades out the instant the
 * rail starts reopening. Two ways back: a top-left icon, and an edge-peek handle
 * at the far left that brightens and reveals a chevron on hover.
 */
export function CollapsedReveal({
  collapsed,
  onOpen,
  reduce,
}: {
  collapsed: boolean
  onOpen: () => void
  reduce: boolean
}) {
  return (
    <>
      <motion.button
        type="button"
        onClick={onOpen}
        aria-label="Show sidebar"
        aria-hidden={!collapsed}
        tabIndex={collapsed ? 0 : -1}
        title="Show sidebar"
        initial={false}
        animate={
          collapsed
            ? { opacity: 1, x: 0, scale: 1 }
            : { opacity: 0, x: -8, scale: 0.9 }
        }
        transition={
          reduce
            ? { duration: 0 }
            : { duration: 0.2, ease: EASE, delay: collapsed ? 0.14 : 0 }
        }
        style={{ pointerEvents: collapsed ? "auto" : "none" }}
        className="fixed left-4 top-4 z-50 flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-card transition-colors hover:bg-muted hover:text-foreground"
      >
        <PanelLeft className="size-5" />
      </motion.button>

      {/* Edge-peek handle: a faint vertical tab at the far left that grows and
          shows a chevron on hover. Decorative duplicate of the icon above, so it
          is aria-hidden and not in the tab order. */}
      <div
        className={cn(
          "group fixed inset-y-0 left-0 z-40 hidden w-4 lg:block",
          collapsed ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden
      >
        <button
          type="button"
          onClick={onOpen}
          tabIndex={-1}
          aria-hidden
          className={cn(
            "absolute left-0 top-1/2 flex h-16 w-1.5 -translate-y-1/2 items-center justify-center rounded-r-full bg-lilac-strong/25",
            collapsed ? "opacity-100" : "opacity-0",
            reduce
              ? "transition-none"
              : "transition-[width,background-color,opacity] duration-200 ease-out",
            "group-hover:w-5 group-hover:bg-lilac-strong/70",
          )}
        >
          <ChevronRight
            className={cn(
              "size-3.5 text-white opacity-0",
              reduce ? "transition-none" : "transition-opacity duration-150",
              "group-hover:opacity-100",
            )}
          />
        </button>
      </div>
    </>
  )
}
