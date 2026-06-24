import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"

import { StepTransport } from "./StepTransport"

/**
 * Two concerns: (1) the ORIGINAL six-prop transport still renders and behaves
 * exactly as before (Stacks & Queues depends on this), and (2) every upgrade is
 * strictly opt-in, only appearing when its handler is supplied.
 */

const baseProps = {
  index: 0,
  total: 3,
  playing: false,
  onPlayToggle: vi.fn(),
  onPrev: vi.fn(),
  onNext: vi.fn(),
  onReplay: vi.fn(),
}

describe("StepTransport — existing six-prop behavior (unchanged)", () => {
  it("renders the core controls, the position readout, and nothing opt-in", () => {
    render(<StepTransport {...baseProps} index={1} total={3} />)

    expect(screen.getByLabelText("Step back")).toBeInTheDocument()
    expect(screen.getByLabelText("Play")).toBeInTheDocument()
    expect(screen.getByLabelText("Step forward")).toBeInTheDocument()
    expect(screen.getByLabelText("Replay")).toBeInTheDocument()
    expect(screen.getByText("2 / 3")).toBeInTheDocument()

    // none of the additive features leak in without their handlers/flags.
    expect(screen.queryByLabelText("Jump to start")).toBeNull()
    expect(screen.queryByLabelText("Jump to end")).toBeNull()
    expect(screen.queryByLabelText("Timeline scrubber")).toBeNull()
    expect(screen.queryByRole("group")).toBeNull() // no keyboard group by default
    expect(screen.queryByRole("status")).toBeNull() // no live region by default
  })

  it("disables Step back at the first frame and Step forward at the last", () => {
    const { rerender } = render(<StepTransport {...baseProps} index={0} total={3} />)
    expect(screen.getByLabelText("Step back")).toBeDisabled()
    expect(screen.getByLabelText("Step forward")).toBeEnabled()

    rerender(<StepTransport {...baseProps} index={2} total={3} />)
    expect(screen.getByLabelText("Step back")).toBeEnabled()
    expect(screen.getByLabelText("Step forward")).toBeDisabled()
  })

  it("fires the controlled callbacks on tap", () => {
    const props = { ...baseProps, onPlayToggle: vi.fn(), onPrev: vi.fn(), onNext: vi.fn(), onReplay: vi.fn() }
    render(<StepTransport {...props} index={1} total={3} />)

    fireEvent.click(screen.getByLabelText("Play"))
    fireEvent.click(screen.getByLabelText("Step back"))
    fireEvent.click(screen.getByLabelText("Step forward"))
    fireEvent.click(screen.getByLabelText("Replay"))

    expect(props.onPlayToggle).toHaveBeenCalledTimes(1)
    expect(props.onPrev).toHaveBeenCalledTimes(1)
    expect(props.onNext).toHaveBeenCalledTimes(1)
    expect(props.onReplay).toHaveBeenCalledTimes(1)
  })

  it("shows Pause when playing", () => {
    render(<StepTransport {...baseProps} playing />)
    expect(screen.getByLabelText("Pause")).toBeInTheDocument()
    expect(screen.queryByLabelText("Play")).toBeNull()
  })
})

describe("StepTransport — opt-in keyboard", () => {
  function setup() {
    const props = {
      ...baseProps,
      index: 1,
      total: 5,
      onPlayToggle: vi.fn(),
      onPrev: vi.fn(),
      onNext: vi.fn(),
      onReplay: vi.fn(),
      onFirst: vi.fn(),
      onLast: vi.fn(),
      keyboard: true,
    }
    render(<StepTransport {...props} />)
    return { props, group: screen.getByRole("group") }
  }

  it("exposes a focusable group with the documented shortcuts", () => {
    const { group } = setup()
    expect(group).toHaveAttribute("tabindex", "0")
    expect(group).toHaveAttribute("aria-keyshortcuts", "Space ArrowLeft ArrowRight Home End")
  })

  it("maps Space, arrows, Home, and End to the right callbacks", () => {
    const { props, group } = setup()

    fireEvent.keyDown(group, { key: " " })
    expect(props.onPlayToggle).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(group, { key: "ArrowLeft" })
    expect(props.onPrev).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(group, { key: "ArrowRight" })
    expect(props.onNext).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(group, { key: "Home" })
    expect(props.onFirst).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(group, { key: "End" })
    expect(props.onLast).toHaveBeenCalledTimes(1)
  })
})

describe("StepTransport — opt-in jump buttons", () => {
  it("renders Home/End buttons that fire and disable at the bounds", () => {
    const onFirst = vi.fn()
    const onLast = vi.fn()
    const { rerender } = render(
      <StepTransport {...baseProps} index={0} total={4} onFirst={onFirst} onLast={onLast} />,
    )
    expect(screen.getByLabelText("Jump to start")).toBeDisabled() // already at start
    expect(screen.getByLabelText("Jump to end")).toBeEnabled()

    fireEvent.click(screen.getByLabelText("Jump to end"))
    expect(onLast).toHaveBeenCalledTimes(1)

    rerender(
      <StepTransport {...baseProps} index={3} total={4} onFirst={onFirst} onLast={onLast} />,
    )
    expect(screen.getByLabelText("Jump to start")).toBeEnabled()
    expect(screen.getByLabelText("Jump to end")).toBeDisabled()
    fireEvent.click(screen.getByLabelText("Jump to start"))
    expect(onFirst).toHaveBeenCalledTimes(1)
  })
})

describe("StepTransport — opt-in scrubber", () => {
  it("renders a range slider bound to index that scrubs to an absolute frame", () => {
    const onScrub = vi.fn()
    render(<StepTransport {...baseProps} index={2} total={6} onScrub={onScrub} />)

    const slider = screen.getByLabelText("Timeline scrubber") as HTMLInputElement
    expect(slider).toHaveAttribute("type", "range")
    expect(slider).toHaveAttribute("min", "0")
    expect(slider).toHaveAttribute("max", "5")
    expect(slider.value).toBe("2")

    fireEvent.change(slider, { target: { value: "4" } })
    expect(onScrub).toHaveBeenCalledWith(4)
  })
})

describe("StepTransport — opt-in speed control", () => {
  it("cycles to the next speed in the supported set", () => {
    const onSpeedChange = vi.fn()
    render(<StepTransport {...baseProps} speed={1} onSpeedChange={onSpeedChange} />)

    const speedBtn = screen.getByLabelText(/Playback speed 1x/i)
    expect(speedBtn).toHaveTextContent("1x")
    fireEvent.click(speedBtn)
    expect(onSpeedChange).toHaveBeenCalledWith(2) // 0.25, 0.5, 1, -> 2, 4
  })

  it("wraps from the fastest speed back to the slowest", () => {
    const onSpeedChange = vi.fn()
    render(<StepTransport {...baseProps} speed={4} onSpeedChange={onSpeedChange} />)
    fireEvent.click(screen.getByLabelText(/Playback speed 4x/i))
    expect(onSpeedChange).toHaveBeenCalledWith(0.25)
  })
})

describe("StepTransport — opt-in live region", () => {
  it("announces the current frame politely", () => {
    render(<StepTransport {...baseProps} liveLabel="C slides right into index 4." />)
    const live = screen.getByRole("status")
    expect(live).toHaveAttribute("aria-live", "polite")
    expect(live).toHaveTextContent("C slides right into index 4.")
  })
})

describe("StepTransport — additive layout", () => {
  it("keeps the core controls present alongside every opt-in feature", () => {
    render(
      <StepTransport
        {...baseProps}
        index={1}
        total={5}
        onFirst={vi.fn()}
        onLast={vi.fn()}
        onScrub={vi.fn()}
        speed={1}
        onSpeedChange={vi.fn()}
        keyboard
        liveLabel="step 1"
      />,
    )
    const group = screen.getByRole("group")
    expect(within(group).getByLabelText("Step back")).toBeInTheDocument()
    expect(within(group).getByLabelText("Step forward")).toBeInTheDocument()
    expect(within(group).getByLabelText("Replay")).toBeInTheDocument()
    expect(within(group).getByLabelText("Timeline scrubber")).toBeInTheDocument()
  })
})
