import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  back: vi.fn(),
  submit: vi.fn(),
}))

vi.mock("@/lib/navigation", () => ({
  useNavigation: () => ({ back: h.back }),
}))

vi.mock("@/screens/LessonPlayer", () => ({
  LessonPlayer: ({ onComplete }: { onComplete: () => void }) => (
    <button type="button" onClick={onComplete}>
      Complete mock lesson
    </button>
  ),
}))

vi.mock("@/features/playtest/playtestFeedback", () => ({
  submitPlaytestFeedback: h.submit,
}))

import { PlaytestScreen } from "@/screens/PlaytestScreen"

beforeEach(() => {
  vi.clearAllMocks()
  h.submit.mockResolvedValue(undefined)
})

describe("PlaytestScreen", () => {
  it("asks for blunt notes after the assigned lesson is completed", async () => {
    const user = userEvent.setup()

    render(<PlaytestScreen lessonId="graphs" />)

    expect(screen.getByText("Playtest for Graphs")).toBeInTheDocument()
    expect(screen.getByText(/please be blunt/i)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /complete mock lesson/i }))

    const notes = screen.getByLabelText(/bugs, confusion, or improvements/i)
    await user.type(notes, "The map labels overlapped on my phone.")
    await user.click(screen.getByRole("button", { name: /send feedback/i }))

    expect(h.submit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        lessonId: "graphs",
        notes: "The map labels overlapped on my phone.",
      }),
    )
    expect(await screen.findByText(/thank you/i)).toBeInTheDocument()
  })
})
