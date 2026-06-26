import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PolyCheckpoint } from "./PolyCheckpoint"

function deps(over: Partial<Parameters<typeof PolyCheckpoint>[0]> = {}) {
  return {
    conceptId: "stacks",
    conceptName: "stacks",
    uid: null,
    onDone: vi.fn(),
    scoreExplanation: vi.fn().mockResolvedValue({
      scores: [{ id: "P1", verdict: "covered" }],
      weakest: null,
    }),
    requestProbe: vi.fn().mockResolvedValue({ question: "probe?" }),
    saveExplanation: vi.fn().mockResolvedValue(undefined),
    ...over,
  }
}

// A fake recorder whose stop() yields a canned transcript.
function fakeRecorder(transcript: string) {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(transcript),
    cancel: vi.fn(),
  }
}

describe("PolyCheckpoint", () => {
  it("affirms and continues when the explanation covers everything", async () => {
    const props = deps()
    render(<PolyCheckpoint {...props} />)
    expect(screen.getByRole("textbox", { name: /your explanation/i })).toBeInTheDocument()
    await userEvent.type(screen.getByRole("textbox"), "last in first out")
    await userEvent.click(screen.getByRole("button", { name: /submit/i }))
    await waitFor(() => expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument())
    await userEvent.click(screen.getByRole("button", { name: /continue/i }))
    expect(props.onDone).toHaveBeenCalledTimes(1)
  })

  it("probes the weakest gap, then continues after the cap", async () => {
    const props = deps({
      maxExchanges: 2,
      scoreExplanation: vi.fn().mockResolvedValue({
        scores: [{ id: "P1", verdict: "missing" }],
        weakest: "P1",
      }),
    })
    render(<PolyCheckpoint {...props} />)
    await userEvent.type(screen.getByRole("textbox"), "first answer")
    await userEvent.click(screen.getByRole("button", { name: /submit/i }))
    await waitFor(() => expect(screen.getByText("probe?")).toBeInTheDocument())
    await userEvent.type(screen.getByRole("textbox"), "second answer")
    await userEvent.click(screen.getByRole("button", { name: /submit/i }))
    // Cap reached (2 exchanges): continue is offered regardless.
    await waitFor(() => expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument())
    expect(props.requestProbe).toHaveBeenCalledTimes(1)
  })

  it("stores the raw explanation when a uid is present", async () => {
    const props = deps({ uid: "alice" })
    render(<PolyCheckpoint {...props} />)
    await userEvent.type(screen.getByRole("textbox"), "my explanation")
    await userEvent.click(screen.getByRole("button", { name: /submit/i }))
    await waitFor(() =>
      expect(props.saveExplanation).toHaveBeenCalledWith("alice", {
        conceptId: "stacks",
        explanation: "my explanation",
      }),
    )
  })

  it("skips to continue when scoring fails", async () => {
    const props = deps({ scoreExplanation: vi.fn().mockRejectedValue(new Error("down")) })
    render(<PolyCheckpoint {...props} />)
    await userEvent.type(screen.getByRole("textbox"), "x")
    await userEvent.click(screen.getByRole("button", { name: /submit/i }))
    await waitFor(() => expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument())
  })

  it("speaks the question when voice is enabled", async () => {
    const speakText = vi.fn().mockResolvedValue(undefined)
    const props = deps({ voice: true, speakText, createRecorder: () => fakeRecorder("") })
    render(<PolyCheckpoint {...props} />)
    await waitFor(() => expect(speakText).toHaveBeenCalledWith("In your own words, explain stacks."))
  })

  it("records speech, fills the transcript into the answer, and scores it", async () => {
    const rec = fakeRecorder("last in first out")
    const props = deps({
      voice: true,
      speakText: vi.fn().mockResolvedValue(undefined),
      createRecorder: () => rec,
    })
    render(<PolyCheckpoint {...props} />)
    await userEvent.click(screen.getByRole("button", { name: /record|speak your answer|mic/i }))
    await userEvent.click(screen.getByRole("button", { name: /stop/i }))
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /your explanation/i })).toHaveValue(
        "last in first out",
      ),
    )
    await userEvent.click(screen.getByRole("button", { name: /submit/i }))
    await waitFor(() => expect(props.scoreExplanation).toHaveBeenCalled())
  })

  it("shows a fallback note and keeps typing when the mic is denied", async () => {
    const rec = {
      start: vi.fn().mockRejectedValue(new Error("denied")),
      stop: vi.fn(),
      cancel: vi.fn(),
    }
    const props = deps({
      voice: true,
      speakText: vi.fn().mockResolvedValue(undefined),
      createRecorder: () => rec,
    })
    render(<PolyCheckpoint {...props} />)
    await userEvent.click(screen.getByRole("button", { name: /record|speak your answer|mic/i }))
    await waitFor(() => expect(screen.getByText(/type instead/i)).toBeInTheDocument())
    expect(screen.getByRole("textbox", { name: /your explanation/i })).toBeEnabled()
  })

  it("shows the fallback note when transcription returns nothing", async () => {
    const rec = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(""),
      cancel: vi.fn(),
    }
    const props = deps({
      voice: true,
      speakText: vi.fn().mockResolvedValue(undefined),
      createRecorder: () => rec,
    })
    render(<PolyCheckpoint {...props} />)
    await userEvent.click(screen.getByRole("button", { name: /speak your answer|record|mic/i }))
    await userEvent.click(screen.getByRole("button", { name: /stop/i }))
    await waitFor(() => expect(screen.getByText(/type instead/i)).toBeInTheDocument())
  })
})
