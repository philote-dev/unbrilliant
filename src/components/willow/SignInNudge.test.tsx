import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { SignInNudge } from "./SignInNudge"

describe("SignInNudge copy", () => {
  it("celebrates an active streak with the 'On a roll' lead-in", () => {
    render(<SignInNudge onStreak onSignIn={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.getByText(/on a roll/i)).toBeInTheDocument()
    expect(screen.getByText(/save your progress and streak/i)).toBeInTheDocument()
  })

  it("drops the streak claim when the learner is not on a streak", () => {
    render(
      <SignInNudge onStreak={false} onSignIn={vi.fn()} onDismiss={vi.fn()} />,
    )
    expect(screen.queryByText(/on a roll/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/and streak/i)).not.toBeInTheDocument()
    expect(screen.getByText(/sign in to save your progress\./i)).toBeInTheDocument()
  })

  it("always offers a sign-in action", () => {
    render(
      <SignInNudge onStreak={false} onSignIn={vi.fn()} onDismiss={vi.fn()} />,
    )
    expect(
      screen.getByRole("button", { name: /^sign in$/i }),
    ).toBeInTheDocument()
  })
})
