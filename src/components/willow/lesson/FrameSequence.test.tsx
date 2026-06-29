import { describe, it, expect, beforeAll, afterEach, vi } from "vitest"
import { fireEvent, render, screen, act } from "@testing-library/react"

import { FrameSequence } from "./FrameSequence"

/**
 * Behaviour tests for the shared frame stepper (generalised from Heaps' local
 * StepReplay). Covers the initial frame, timer-driven autoplay with a hard cap at
 * the last frame, the manual Back / Next / Replay controls, and the reduced-motion
 * snap (final frame immediately, no timer left running).
 */

beforeAll(() => {
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  }
})

afterEach(() => {
  vi.useRealTimers()
})

const FRAMES = ["alpha", "bravo", "charlie"]

function renderFrames(props: Partial<React.ComponentProps<typeof FrameSequence<string>>> = {}) {
  return render(
    <FrameSequence frames={FRAMES} {...props}>
      {(frame, index) => (
        <div data-testid="frame">
          {frame}-{index}
        </div>
      )}
    </FrameSequence>,
  )
}

const frameText = () => screen.getByTestId("frame").textContent

describe("FrameSequence: initial render", () => {
  it("renders frame 0 first when not autoplaying or reduced", () => {
    renderFrames()
    expect(frameText()).toBe("alpha-0")
  })
})

describe("FrameSequence: autoplay", () => {
  it("auto-advances to the last frame on a timer", () => {
    vi.useFakeTimers()
    renderFrames({ autoPlayMs: 1000 })
    expect(frameText()).toBe("alpha-0")

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(frameText()).toBe("bravo-1")

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(frameText()).toBe("charlie-2")
  })

  it("caps at the last frame and does not loop or overflow", () => {
    vi.useFakeTimers()
    renderFrames({ autoPlayMs: 1000 })

    // Each advance flushes effects, which schedules the next beat. Drive well
    // past the frame count: it must settle on the last frame, never wrap around.
    for (let i = 0; i < 6; i++) {
      act(() => {
        vi.advanceTimersByTime(1000)
      })
    }
    expect(frameText()).toBe("charlie-2")
    // No further timer is pending once it has settled on the last frame.
    expect(vi.getTimerCount()).toBe(0)
  })

  it("honours a per-index pacing function (the Heaps cadence)", () => {
    vi.useFakeTimers()
    renderFrames({ autoPlayMs: (index) => (index === 0 ? 1000 : 820) })
    expect(frameText()).toBe("alpha-0")

    // Frame 0 dwells on the longer 1000ms beat.
    act(() => {
      vi.advanceTimersByTime(999)
    })
    expect(frameText()).toBe("alpha-0")
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(frameText()).toBe("bravo-1")

    // Later frames advance on the shorter 820ms beat.
    act(() => {
      vi.advanceTimersByTime(819)
    })
    expect(frameText()).toBe("bravo-1")
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(frameText()).toBe("charlie-2")
  })
})

describe("FrameSequence: manual controls", () => {
  it("exposes Back / Next / Replay and steps correctly", () => {
    renderFrames({ controls: true })
    expect(frameText()).toBe("alpha-0")
    expect(screen.getByText("Step 0 / 2")).toBeInTheDocument()

    // Back is disabled on the first frame.
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(frameText()).toBe("bravo-1")

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(frameText()).toBe("charlie-2")
    // Next is disabled on the last frame (no overflow).
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(frameText()).toBe("bravo-1")

    fireEvent.click(screen.getByRole("button", { name: "Replay" }))
    expect(frameText()).toBe("alpha-0")
  })

  it("stops autoplay when the learner takes manual control", () => {
    vi.useFakeTimers()
    renderFrames({ autoPlayMs: 1000, controls: true })

    // Advance once so autoplay moves to frame 1, then grab the scrubber.
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(frameText()).toBe("bravo-1")

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Next" }))
    })
    expect(frameText()).toBe("charlie-2")

    // With autoplay halted, further time changes nothing (no surprise jumps).
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(frameText()).toBe("charlie-2")
  })
})

describe("FrameSequence: reduced motion", () => {
  it("renders the final frame immediately with no timer scheduled", () => {
    vi.useFakeTimers()
    renderFrames({ autoPlayMs: 1000, reduced: true })

    // Snaps straight to the last frame, never showing frame 0.
    expect(frameText()).toBe("charlie-2")
    // No autoplay timer is left running.
    expect(vi.getTimerCount()).toBe(0)

    // Advancing time does not change the displayed frame.
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(frameText()).toBe("charlie-2")
  })
})
