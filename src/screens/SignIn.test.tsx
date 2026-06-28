import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const h = vi.hoisted(() => ({
  streak: { current: 0, longest: 0 },
}))

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    signInWithGoogle: vi.fn(),
    signUpWithEmail: vi.fn(),
    signInWithEmail: vi.fn(),
  }),
}))
vi.mock("@/lib/navigation", () => ({
  useNavigation: () => ({ back: vi.fn(), replace: vi.fn() }),
}))
vi.mock("@/features/progress/CourseProgressProvider", () => ({
  useCourseProgress: () => ({ streak: h.streak }),
}))

import { SignIn } from "./SignIn"

beforeEach(() => {
  h.streak = { current: 0, longest: 0 }
})

describe("SignIn save pitch", () => {
  it("says 'Save your progress' exactly once (no redundant subtitle)", () => {
    render(<SignIn />)
    // Only the headline carries the phrase; the subtitle must not repeat it.
    expect(screen.getAllByText(/save your progress/i)).toHaveLength(1)
  })

  it("claims the streak only when one is lit", () => {
    h.streak = { current: 5, longest: 5 }
    render(<SignIn />)
    expect(screen.getByText(/keep your streak/i)).toBeInTheDocument()
    expect(screen.getAllByText(/save your progress/i)).toHaveLength(1)
  })

  it("drops the streak claim when there is no streak", () => {
    h.streak = { current: 0, longest: 0 }
    render(<SignIn />)
    expect(screen.queryByText(/keep your streak/i)).not.toBeInTheDocument()
    expect(
      screen.getByText(/pick up right where you left off/i),
    ).toBeInTheDocument()
  })
})
