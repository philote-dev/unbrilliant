import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

/** Every screen Willow can show. A tiny client-side router: no dep needed. */
export type Screen =
  | { name: "home" }
  | { name: "courses" }
  | { name: "course"; courseId: string }
  | { name: "signin"; intent?: "save" | "unlock" }
  | { name: "lesson"; lessonId: string }
  | { name: "playtest"; lessonId: string }
  | { name: "complete"; lessonId: string }
  | { name: "progress" }
  | { name: "settings" }
  | { name: "poly-lab" }

export type Tab = "home" | "learn" | "progress" | "settings"

type NavContextValue = {
  screen: Screen
  navigate: (screen: Screen) => void
  replace: (screen: Screen) => void
  back: () => void
  canBack: boolean
  tab: Tab
}

const NavContext = createContext<NavContextValue | null>(null)

/** Which bottom-nav tab should read as active for a given screen. */
function tabForScreen(screen: Screen): Tab {
  switch (screen.name) {
    case "home":
      return "home"
    case "progress":
      return "progress"
    case "settings":
    case "signin":
      return "settings"
    default:
      return "learn"
  }
}

export function NavigationProvider({
  children,
  initial = { name: "home" },
}: {
  children: ReactNode
  initial?: Screen
}) {
  const [stack, setStack] = useState<Screen[]>([initial])

  const navigate = useCallback((screen: Screen) => {
    window.scrollTo({ top: 0 })
    setStack((s) => [...s, screen])
  }, [])

  const replace = useCallback((screen: Screen) => {
    window.scrollTo({ top: 0 })
    setStack((s) => [...s.slice(0, -1), screen])
  }, [])

  const back = useCallback(() => {
    window.scrollTo({ top: 0 })
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
  }, [])

  const screen = stack[stack.length - 1]

  const value = useMemo<NavContextValue>(
    () => ({
      screen,
      navigate,
      replace,
      back,
      canBack: stack.length > 1,
      tab: tabForScreen(screen),
    }),
    [screen, navigate, replace, back, stack.length],
  )

  return <NavContext value={value}>{children}</NavContext>
}

export function useNavigation() {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error("useNavigation must be used within NavigationProvider")
  return ctx
}
