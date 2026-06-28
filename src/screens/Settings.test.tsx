import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { Settings } from "./Settings"

// Shared, mutable mock state so each test can set the signed-in user.
const h = vi.hoisted(() => ({
  user: null as null | { uid: string; displayName: string; email: string | null },
  updateDisplayName: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
  navigate: vi.fn(),
  toggle: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: h.user,
    updateDisplayName: h.updateDisplayName,
    signOut: h.signOut,
  }),
}))
vi.mock("@/lib/navigation", () => ({ useNavigation: () => ({ navigate: h.navigate }) }))
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ theme: "light", toggle: h.toggle }) }))

describe("Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.user = null
  })

  it("prompts a guest to sign in and shows no username field", () => {
    render(<Settings />)
    expect(
      screen.getByRole("button", { name: /sign in to save your progress/i }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/display name/i)).not.toBeInTheDocument()
  })

  it("lets a signed-in learner change their username", async () => {
    h.user = { uid: "u1", displayName: "Mara", email: "mara@willow.dev" }
    render(<Settings />)

    const input = screen.getByLabelText(/display name/i)
    expect(input).toHaveValue("Mara")

    const save = screen.getByRole("button", { name: /^save$/i })
    expect(save).toBeDisabled() // unchanged, nothing to save

    await userEvent.clear(input)
    await userEvent.type(input, "Mara Lin")
    expect(save).toBeEnabled()

    await userEvent.click(save)
    await waitFor(() => expect(h.updateDisplayName).toHaveBeenCalledWith("Mara Lin"))
    expect(await screen.findByText(/name updated/i)).toBeInTheDocument()
  })

  it("does not save a blank or unchanged name", async () => {
    h.user = { uid: "u1", displayName: "Mara", email: null }
    render(<Settings />)
    const input = screen.getByLabelText(/display name/i)
    await userEvent.clear(input)
    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled()
    expect(h.updateDisplayName).not.toHaveBeenCalled()
  })
})
