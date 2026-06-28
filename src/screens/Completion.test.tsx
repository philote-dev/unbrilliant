import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"

const h = vi.hoisted(() => ({
  user: null as null | { uid: string },
  navigate: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
  streak: { current: 0, longest: 0 },
}))

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: h.user }) }))
vi.mock("@/lib/navigation", () => ({
  useNavigation: () => ({ navigate: h.navigate, back: h.back }),
}))
vi.mock("@/features/progress/CourseProgressProvider", () => ({
  useCourseProgress: () => ({
    progressByLesson: {},
    refresh: h.refresh,
    streak: h.streak,
  }),
}))

import { Completion } from "./Completion"

// The save prompt is delayed (celebration first); advance past it deterministically.
function renderAndRevealPrompt() {
  vi.useFakeTimers()
  render(<Completion lessonId="arrays" />)
  act(() => {
    vi.advanceTimersByTime(800)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.user = null
  h.streak = { current: 0, longest: 0 }
})

afterEach(() => {
  vi.useRealTimers()
})

describe("Completion save prompt", () => {
  it("offers to keep the streak when the learner finished on a roll", () => {
    h.streak = { current: 5, longest: 5 }
    renderAndRevealPrompt()
    expect(screen.getByText(/keep your streak/i)).toBeInTheDocument()
  })

  it("drops the streak claim when no streak was built", () => {
    h.streak = { current: 1, longest: 1 }
    renderAndRevealPrompt()
    expect(screen.queryByText(/keep your streak/i)).not.toBeInTheDocument()
    expect(
      screen.getByText(/pick up right where you left off/i),
    ).toBeInTheDocument()
  })

  it("shows no save prompt to a signed-in learner", () => {
    h.user = { uid: "u1" }
    h.streak = { current: 5, longest: 5 }
    renderAndRevealPrompt()
    expect(screen.queryByText(/keep your streak/i)).not.toBeInTheDocument()
  })
})
