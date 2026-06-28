import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Menu } from "lucide-react"

import { useNavigation } from "@/lib/navigation"
import { useNavChrome } from "@/components/willow/NavChromeProvider"
import { BottomNav } from "@/components/willow/BottomNav"

/**
 * Mobile lesson nav. Closed, it is a three-line icon sitting in the bottom-right,
 * level with the lesson's own Continue button (the lesson chrome reserves a small
 * gutter for it). Opening slides the normal tab bar up across the bottom while the
 * lesson's CTA lifts to sit above it, exactly the resting layout the tab bar has
 * on every other screen. The shared open state lives in NavChromeProvider so the
 * chrome and this dock move together.
 */
export function MobileImmersiveNav() {
  const { screen } = useNavigation()
  const { menuOpen, setMenuOpen } = useNavChrome()
  const reduce = useReducedMotion()

  // The dock belongs to the active lesson; other immersive routes keep their own
  // navigation, so the dock would only cover their buttons.
  if (screen.name !== "lesson") return null

  const spring = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 460, damping: 40 }

  return (
    <>
      <AnimatePresence>
        {menuOpen && (
          <motion.button
            key="scrim"
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-40 bg-foreground/5"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
        <AnimatePresence initial={false} mode="popLayout">
          {menuOpen ? (
            <motion.div
              key="bar"
              className="pointer-events-auto mx-auto max-w-md px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              initial={reduce ? false : { y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { y: 28, opacity: 0 }}
              transition={spring}
            >
              <BottomNav />
            </motion.div>
          ) : (
            <motion.div
              key="fab"
              className="mx-auto flex max-w-md justify-end px-5 pb-6"
              style={{ transformOrigin: "bottom right" }}
              initial={reduce ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              transition={spring}
            >
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Show navigation"
                className="pointer-events-auto flex size-14 items-center justify-center rounded-2xl border border-border bg-card/90 text-foreground shadow-card backdrop-blur-md"
              >
                <Menu className="size-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
