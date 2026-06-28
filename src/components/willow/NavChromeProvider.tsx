import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react"

import { useNavigation } from "@/lib/navigation"
import {
  initNavChrome,
  isImmersive,
  navChromeReducer,
  railCollapsed,
} from "@/lib/navChrome"

const COLLAPSE_KEY = "willow.sidebar.collapsed"

function readManualCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1"
  } catch {
    return false
  }
}

interface NavChromeValue {
  /** Desktop rail collapsed (derived from manual pref + immersion + reveal). */
  collapsed: boolean
  /** Whether the current route is immersive (the lesson flow). */
  immersive: boolean
  toggle: () => void
  open: () => void
  close: () => void
  /**
   * Mobile-only: whether the immersive lesson nav is expanded into the full tab
   * bar. Shared here so the lesson chrome can shift its CTA up to make room while
   * the dock renders the bar. Auto-resets on every route change.
   */
  menuOpen: boolean
  setMenuOpen: (open: boolean) => void
}

const NavChromeContext = createContext<NavChromeValue | null>(null)

/**
 * Owns nav-chrome state for one app instance: runs the pure reducer, derives
 * immersion from the current route, and persists only the manual preference.
 * Mounted inside AppShell (which is always under NavigationProvider).
 */
export function NavChromeProvider({ children }: { children: ReactNode }) {
  const { screen } = useNavigation()
  const [state, dispatch] = useReducer(
    navChromeReducer,
    { manualCollapsed: readManualCollapsed(), immersive: isImmersive(screen) },
    initNavChrome,
  )

  const [menuOpen, setMenuOpen] = useState(false)

  const immersiveNow = isImmersive(screen)
  useEffect(() => {
    dispatch({ type: immersiveNow ? "enterImmersive" : "exitImmersive" })
  }, [immersiveNow])

  // The mobile lesson menu is transient: any route change (advancing a beat or
  // leaving the lesson) collapses it back to the icon.
  useEffect(() => {
    setMenuOpen(false)
  }, [screen])

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, state.manualCollapsed ? "1" : "0")
    } catch {
      // localStorage may be unavailable; toggling still works for the session.
    }
  }, [state.manualCollapsed])

  const toggle = useCallback(() => dispatch({ type: "toggle" }), [])
  const open = useCallback(() => dispatch({ type: "open" }), [])
  const close = useCallback(() => dispatch({ type: "close" }), [])

  const value = useMemo<NavChromeValue>(
    () => ({
      collapsed: railCollapsed(state),
      immersive: state.immersive,
      toggle,
      open,
      close,
      menuOpen,
      setMenuOpen,
    }),
    [state, toggle, open, close, menuOpen],
  )

  return <NavChromeContext value={value}>{children}</NavChromeContext>
}

export function useNavChrome(): NavChromeValue {
  const ctx = useContext(NavChromeContext)
  if (!ctx) throw new Error("useNavChrome must be used within NavChromeProvider")
  return ctx
}
