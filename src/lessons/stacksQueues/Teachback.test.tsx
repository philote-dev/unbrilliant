import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Teachback } from "./Teachback"

function deps(over: Partial<Parameters<typeof Teachback>[0]> = {}) {
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

type Update = { finalText: string; interimText: string }

function makeFakeTranscriber() {
  let onUpdate: (u: Update) => void = () => {}
  const transcriber = { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() }
  return {
    transcriber,
    create: (opts: { onUpdate: (u: Update) => void }) => {
      onUpdate = opts.onUpdate
      return transcriber
    },
    emit: (finalText: string, interimText = "") => onUpdate({ finalText, interimText }),
  }
}

describe("Teachback (keyboard mode)", () => {
  it("affirms and continues when the explanation covers everything", async () => {
    const props = deps()
    render(<Teachback {...props} />)
    expect(screen.getByRole("textbox", { name: /your explanation/i })).toBeInTheDocument()
    await userEvent.type(screen.getByRole("textbox"), "last in first out")
    await userEvent.click(screen.getByRole("button", { name: /submit/i }))
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument(),
    )
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
    render(<Teachback {...props} />)
    await userEvent.type(screen.getByRole("textbox"), "first answer")
    await userEvent.click(screen.getByRole("button", { name: /submit/i }))
    await waitFor(() => expect(screen.getByText("probe?")).toBeInTheDocument())
    await userEvent.type(screen.getByRole("textbox"), "second answer")
    await userEvent.click(screen.getByRole("button", { name: /submit/i }))
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument(),
    )
    expect(props.requestProbe).toHaveBeenCalledTimes(1)
  })

  it("stores the raw explanation when a uid is present", async () => {
    const props = deps({ uid: "alice" })
    render(<Teachback {...props} />)
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
    render(<Teachback {...props} />)
    await userEvent.type(screen.getByRole("textbox"), "x")
    await userEvent.click(screen.getByRole("button", { name: /submit/i }))
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument(),
    )
  })
})

describe("Teachback (voice mode)", () => {
  it("speaks the question, then opens the mic", async () => {
    const speakText = vi.fn().mockResolvedValue(undefined)
    const fake = makeFakeTranscriber()
    render(
      <Teachback {...deps({ voice: true, speakText, createTranscriber: fake.create })} />,
    )
    await waitFor(() =>
      expect(speakText).toHaveBeenCalledWith(
        "Teach it back: explain stacks in your own words.",
        expect.any(AbortSignal),
      ),
    )
    await waitFor(() => expect(fake.transcriber.start).toHaveBeenCalled())
  })

  it("cancels Poly's in-flight speech when the checkpoint unmounts", async () => {
    // The bug: a checkpoint's TTS could resolve/play after navigation (e.g. landing
    // on the completion screen), so Poly "talked" from the previous segment. The
    // checkpoint must abort the speech turn on unmount.
    let captured: AbortSignal | undefined
    const speakText = vi.fn((_text: string, signal?: AbortSignal) => {
      captured = signal
      // Never resolves: simulates a fetch/playback still in flight at unmount.
      return new Promise<void>(() => {})
    })
    const fake = makeFakeTranscriber()
    const { unmount } = render(
      <Teachback
        {...deps({ voice: true, speakText, createTranscriber: fake.create })}
      />,
    )
    await waitFor(() => expect(speakText).toHaveBeenCalled())
    expect(captured?.aborted).toBe(false)
    unmount()
    expect(captured?.aborted).toBe(true)
  })

  it("renders the live transcript and scores it on Done", async () => {
    const fake = makeFakeTranscriber()
    const props = deps({
      voice: true,
      speakText: vi.fn().mockResolvedValue(undefined),
      createTranscriber: fake.create,
    })
    render(<Teachback {...props} />)
    await waitFor(() => expect(fake.transcriber.start).toHaveBeenCalled())
    await act(async () => {
      fake.emit("last in first out", "only the top")
    })
    expect(screen.getByText(/last in first out/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /^done$/i }))
    await waitFor(() =>
      expect(props.scoreExplanation).toHaveBeenCalledWith({
        conceptId: "stacks",
        explanation: "last in first out only the top",
      }),
    )
  })

  it("falls back to the keyboard sheet when the connection fails", async () => {
    const create = () => ({
      start: vi.fn().mockRejectedValue(new Error("no mic")),
      stop: vi.fn(),
    })
    render(
      <Teachback
        {...deps({
          voice: true,
          speakText: vi.fn().mockResolvedValue(undefined),
          createTranscriber: create,
        })}
      />,
    )
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /your explanation/i })).toBeInTheDocument(),
    )
  })

  it("switches to the keyboard via the grabber and submits typed text", async () => {
    const fake = makeFakeTranscriber()
    const props = deps({
      voice: true,
      speakText: vi.fn().mockResolvedValue(undefined),
      createTranscriber: fake.create,
    })
    render(<Teachback {...props} />)
    await waitFor(() => expect(fake.transcriber.start).toHaveBeenCalled())
    await userEvent.click(screen.getByRole("button", { name: /type instead/i }))
    expect(fake.transcriber.stop).toHaveBeenCalled()
    const box = await screen.findByRole("textbox", { name: /your explanation/i })
    await userEvent.type(box, "typed answer")
    await userEvent.click(screen.getByRole("button", { name: /^submit$/i }))
    await waitFor(() =>
      expect(props.scoreExplanation).toHaveBeenCalledWith({
        conceptId: "stacks",
        explanation: "typed answer",
      }),
    )
  })
})
