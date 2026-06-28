import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { createInMemoryProgressRepository } from "@/features/progress/inMemoryProgressRepository"
import { TrialRunProvider } from "@/features/trials/TrialRunProvider"
import { trialOneSpec } from "@/trials/trialOne"

import { DesignBoard } from "./DesignBoard"

// Keep the run anonymous and in-memory: stub auth (no signed-in user) and the
// firebase module so importing the provider never reaches the real SDK. This
// mirrors the provider's own unit test.
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: null }) }))
vi.mock("@/lib/firebase", () => ({ db: {} }))

function renderBoard() {
  const repo = createInMemoryProgressRepository()
  return render(
    <TrialRunProvider spec={trialOneSpec} repo={repo} onTrialComplete={() => {}}>
      <DesignBoard />
    </TrialRunProvider>,
  )
}

describe("DesignBoard tap-to-place", () => {
  it("enables Run only once both required ops are placed, and echoes each placement", () => {
    renderBoard()

    const runButton = screen.getByRole("button", {
      name: /run the stress test/i,
    })
    // Disabled before a structure is chosen.
    expect(runButton).toBeDisabled()

    // Choose the queue structure.
    fireEvent.click(screen.getByRole("button", { name: /^queue/i }))
    expect(runButton).toBeDisabled()

    // Arm "a new student arrives" and drop it at the Back zone.
    fireEvent.click(
      screen.getByRole("button", { name: "a new student arrives" }),
    )
    fireEvent.click(screen.getByRole("button", { name: /place at back/i }))
    // Still disabled: the serve op is not placed yet.
    expect(runButton).toBeDisabled()

    // Arm "serve the next student" and drop it at the Front zone.
    fireEvent.click(
      screen.getByRole("button", { name: "serve the next student" }),
    )
    fireEvent.click(screen.getByRole("button", { name: /place at front/i }))

    // Both required ops placed -> Run is enabled, and both rules are echoed.
    expect(runButton).toBeEnabled()
    expect(
      screen.getByText(/a new arrival joins the back of the line/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/serve next takes from the front of the line/i),
    ).toBeInTheDocument()
  })

  it("keeps Run disabled when only one required op is placed", () => {
    renderBoard()

    fireEvent.click(screen.getByRole("button", { name: /^queue/i }))
    fireEvent.click(
      screen.getByRole("button", { name: "a new student arrives" }),
    )
    fireEvent.click(screen.getByRole("button", { name: /place at back/i }))

    expect(
      screen.getByRole("button", { name: /run the stress test/i }),
    ).toBeDisabled()
  })
})
