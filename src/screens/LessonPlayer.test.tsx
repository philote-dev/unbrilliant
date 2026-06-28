import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

// Drive the player off a fake lesson module so we control the live combo and how
// far in the learner is. Auth stays signed-out (the nudge only shows to guests).
const h = vi.hoisted(() => ({
  user: null as null | { uid: string },
  navigate: vi.fn(),
  back: vi.fn(),
  module: {
    totalParts: 9,
    filledParts: (_s: unknown) => 9,
    combo: (_s: unknown) => 0,
    completed: (_s: unknown) => false,
    Stage: () => null,
  },
}))

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: h.user }) }))
vi.mock("@/lib/navigation", () => ({
  useNavigation: () => ({ navigate: h.navigate, back: h.back }),
}))
vi.mock("@/features/lesson/useLessonRun", () => ({
  useLessonRun: () => ({ state: {}, dispatch: vi.fn(), module: h.module }),
}))
vi.mock("@/components/willow/NavChromeProvider", () => ({
  useNavChrome: () => ({
    collapsed: false,
    immersive: true,
    toggle: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    menuOpen: false,
    setMenuOpen: vi.fn(),
  }),
}))
vi.mock("@/hooks/useMediaQuery", () => ({
  useIsDesktop: () => false,
  useMediaQuery: () => false,
}))

import { LessonPlayer } from "./LessonPlayer"

beforeEach(() => {
  vi.clearAllMocks()
  h.user = null
  h.module.filledParts = () => 9
  h.module.combo = () => 0
  h.module.completed = () => false
})

describe("LessonPlayer sign-in nudge", () => {
  it("claims a streak only when the live combo lights the flame", () => {
    h.module.combo = () => 4
    render(<LessonPlayer lessonId="arrays" />)
    expect(screen.getByText(/on a roll/i)).toBeInTheDocument()
    expect(screen.getByText(/and streak/i)).toBeInTheDocument()
  })

  it("shows the plain save prompt when there is no streak yet", () => {
    h.module.combo = () => 1
    render(<LessonPlayer lessonId="arrays" />)
    expect(screen.queryByText(/on a roll/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/and streak/i)).not.toBeInTheDocument()
    expect(screen.getByText(/sign in to save your progress/i)).toBeInTheDocument()
  })

  it("does not nudge before the learner is invested", () => {
    h.module.combo = () => 6
    h.module.filledParts = () => 0
    render(<LessonPlayer lessonId="arrays" />)
    expect(screen.queryByText(/save your progress/i)).not.toBeInTheDocument()
  })
})
