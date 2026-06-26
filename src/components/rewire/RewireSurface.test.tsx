import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { RewireSurface } from "./RewireSurface"
import { RewireSource } from "./RewireSource"
import { RewireTarget } from "./RewireTarget"
import { useRewireContext } from "./RewireContext"

/**
 * Component tests for the rewire surface — the seams a pure function can't
 * express: the tap-source-then-tap-target path, snap-back on empty, and that
 * legality never gates emission (a real-but-wrong target is still the learner's
 * choice). Keyboard/drag parity lives alongside these in later slices.
 */

function setup(opts?: {
  legal?: string[]
  onRewire?: (from: string, to: string) => void
}) {
  const onRewire = opts?.onRewire ?? vi.fn()
  const legalTargets = new Set(opts?.legal ?? ["n1", "n2"])
  const utils = render(
    <RewireSurface
      legalTargets={legalTargets}
      onRewire={onRewire}
      label="Rewire the pointer"
    >
      <RewireSource id="p1" label="head pointer" />
      <RewireSource id="p2" label="tail pointer" />
      <RewireTarget id="n1" label="node one" />
      <RewireTarget id="n2" label="node two" />
    </RewireSurface>,
  )
  return { onRewire, ...utils }
}

const source = (id: string): HTMLElement =>
  document.querySelector(`[data-rewire-source="${id}"]`) as HTMLElement
const target = (id: string): HTMLElement =>
  document.querySelector(`[data-rewire-target="${id}"]`) as HTMLElement

/** jsdom has no layout, so give a target a concrete box for geometry hit-tests. */
function stubRect(el: HTMLElement, x: number, y: number, w: number, h: number) {
  el.getBoundingClientRect = () =>
    ({
      x,
      y,
      left: x,
      top: y,
      right: x + w,
      bottom: y + h,
      width: w,
      height: h,
      toJSON: () => ({}),
    }) as DOMRect
}

describe("RewireSurface — tap modality", () => {
  it("emits one from→to intent when a source is tapped then a target", async () => {
    const user = userEvent.setup()
    const { onRewire } = setup()

    await user.click(source("p1"))
    await user.click(target("n1"))

    expect(onRewire).toHaveBeenCalledTimes(1)
    expect(onRewire).toHaveBeenCalledWith("p1", "n1")
  })

  it("snaps back with no emit when a source is tapped then empty space", async () => {
    const user = userEvent.setup()
    const { onRewire } = setup()

    await user.click(source("p1"))
    await user.click(screen.getByTestId("rewire-surface"))

    expect(onRewire).not.toHaveBeenCalled()
  })

  it("still emits when dropped on a registered-but-illegal target", async () => {
    const user = userEvent.setup()
    const { onRewire } = setup({ legal: ["n1"] }) // n2 is registered but illegal

    await user.click(source("p1"))
    await user.click(target("n2"))

    expect(onRewire).toHaveBeenCalledWith("p1", "n2")
  })

  it("re-arms to a new source instead of emitting when two sources are tapped", async () => {
    const user = userEvent.setup()
    const { onRewire } = setup()

    await user.click(source("p1"))
    await user.click(source("p2"))
    await user.click(target("n1"))

    expect(onRewire).toHaveBeenCalledTimes(1)
    expect(onRewire).toHaveBeenCalledWith("p2", "n1")
  })
})

describe("RewireSurface — pointer drag modality", () => {
  it("emits the same intent as tap when a source is dragged onto a target", () => {
    const { onRewire } = setup()
    stubRect(target("n2"), 200, 0, 120, 60)

    fireEvent.pointerDown(source("p1"), { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 260, clientY: 30 })
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 260, clientY: 30 })

    expect(onRewire).toHaveBeenCalledTimes(1)
    expect(onRewire).toHaveBeenCalledWith("p1", "n2")
  })

  it("snaps back without emitting when released over empty space", () => {
    const { onRewire } = setup()
    stubRect(target("n1"), 0, 0, 60, 60)

    fireEvent.pointerDown(source("p1"), { pointerId: 1, button: 0, clientX: 10, clientY: 300 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 500, clientY: 500 })
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 500, clientY: 500 })

    expect(onRewire).not.toHaveBeenCalled()
  })

  it("treats pointercancel as a snap-back even over a target", () => {
    const { onRewire } = setup()
    stubRect(target("n1"), 0, 0, 200, 200)

    fireEvent.pointerDown(source("p1"), { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerCancel(window, { pointerId: 1, clientX: 100, clientY: 100 })

    expect(onRewire).not.toHaveBeenCalled()
  })

  it("ignores a sub-threshold jitter (a press, not a drag)", () => {
    const { onRewire } = setup()
    stubRect(target("n1"), 0, 0, 200, 200)

    fireEvent.pointerDown(source("p1"), { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 12, clientY: 12 })
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 12, clientY: 12 })

    expect(onRewire).not.toHaveBeenCalled()
  })
})

/** Reads the live drag-follow visual off the context so a test can assert the
 * plumbing that drives the source's pointer-follow transform, deterministically
 * (no dependency on motion's async style application in jsdom). */
function DragVisualProbe() {
  const { dragVisual } = useRewireContext()
  return (
    <div data-testid="drag-visual">
      {dragVisual ? `${dragVisual.from}:${dragVisual.dx}:${dragVisual.dy}` : "none"}
    </div>
  )
}

describe("RewireSurface — pointer drag-follow visual", () => {
  function renderProbe() {
    const onRewire = vi.fn()
    render(
      <RewireSurface legalTargets={new Set(["n1"])} onRewire={onRewire} label="Rewire">
        <RewireSource id="p1" label="head pointer" />
        <RewireTarget id="n1" label="node one" />
        <DragVisualProbe />
      </RewireSurface>,
    )
    return { onRewire, visual: () => screen.getByTestId("drag-visual").textContent }
  }

  it("exposes the live source offset only after the drag threshold, then clears it on drop", () => {
    const { onRewire, visual } = renderProbe()
    stubRect(target("n1"), 200, 0, 120, 60)

    expect(visual()).toBe("none")

    fireEvent.pointerDown(source("p1"), { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
    // a sub-threshold jitter is a press, not a drag: no follow visual yet
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 12, clientY: 11 })
    expect(visual()).toBe("none")

    // crossing the threshold begins the follow: the source id + its live offset
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 260, clientY: 30 })
    expect(visual()).toBe("p1:250:20")

    // a drop over the target clears the visual AND still emits the same intent
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 260, clientY: 30 })
    expect(visual()).toBe("none")
    expect(onRewire).toHaveBeenCalledTimes(1)
    expect(onRewire).toHaveBeenCalledWith("p1", "n1")
  })

  it("clears the drag visual and snaps back without emitting on a miss", () => {
    const { onRewire, visual } = renderProbe()
    stubRect(target("n1"), 0, 0, 60, 60)

    fireEvent.pointerDown(source("p1"), { pointerId: 1, button: 0, clientX: 10, clientY: 300 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 500, clientY: 500 })
    expect(visual()).toBe("p1:490:200")

    fireEvent.pointerUp(window, { pointerId: 1, clientX: 500, clientY: 500 })
    expect(visual()).toBe("none")
    expect(onRewire).not.toHaveBeenCalled()
  })
})

describe("RewireSurface — keyboard modality", () => {
  it("arms with Enter, cycles with arrows, and confirms the same intent as a tap", () => {
    const { onRewire } = setup()
    const src = source("p1")
    src.focus()

    fireEvent.keyDown(src, { key: "Enter" }) // arm p1
    fireEvent.keyDown(src, { key: "ArrowRight" }) // hover n1
    fireEvent.keyDown(src, { key: "ArrowRight" }) // hover n2
    fireEvent.keyDown(src, { key: "Enter" }) // confirm n2

    expect(onRewire).toHaveBeenCalledTimes(1)
    expect(onRewire).toHaveBeenCalledWith("p1", "n2")
  })

  it("can reach a registered-but-illegal target by keyboard and still emit", () => {
    const { onRewire } = setup({ legal: ["n1"] }) // n2 illegal but registered
    const src = source("p1")

    fireEvent.keyDown(src, { key: "Enter" })
    fireEvent.keyDown(src, { key: "ArrowRight" }) // n1
    fireEvent.keyDown(src, { key: "ArrowRight" }) // n2 (illegal)
    fireEvent.keyDown(src, { key: "Enter" })

    expect(onRewire).toHaveBeenCalledWith("p1", "n2")
  })

  it("snaps back on Escape without emitting", () => {
    const { onRewire } = setup()
    const src = source("p1")

    fireEvent.keyDown(src, { key: "Enter" })
    fireEvent.keyDown(src, { key: "ArrowRight" })
    fireEvent.keyDown(src, { key: "Escape" })

    expect(onRewire).not.toHaveBeenCalled()
  })

  it("does not emit when confirming with no target chosen", () => {
    const { onRewire } = setup()
    const src = source("p1")

    fireEvent.keyDown(src, { key: "Enter" })
    fireEvent.keyDown(src, { key: "Enter" })

    expect(onRewire).not.toHaveBeenCalled()
  })
})

describe("RewireSurface — modality parity", () => {
  /** Render a fresh surface, run one gesture, return the captured intent, unmount. */
  function connect(action: () => void): [string, string] | null {
    let captured: [string, string] | null = null
    const utils = render(
      <RewireSurface
        legalTargets={new Set(["n2"])}
        onRewire={(from, to) => {
          captured = [from, to]
        }}
        label="Rewire the pointer"
      >
        <RewireSource id="p1" label="head pointer" />
        <RewireTarget id="n1" label="node one" />
        <RewireTarget id="n2" label="node two" />
      </RewireSurface>,
    )
    action()
    utils.unmount()
    return captured
  }

  it("tap, drag, and keyboard all emit the identical intent", () => {
    const byTap = connect(() => {
      fireEvent.click(source("p1"))
      fireEvent.click(target("n2"))
    })

    const byDrag = connect(() => {
      stubRect(target("n2"), 200, 0, 120, 60)
      fireEvent.pointerDown(source("p1"), { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 260, clientY: 30 })
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 260, clientY: 30 })
    })

    const byKeyboard = connect(() => {
      const src = source("p1")
      fireEvent.keyDown(src, { key: "Enter" })
      fireEvent.keyDown(src, { key: "ArrowRight" })
      fireEvent.keyDown(src, { key: "ArrowRight" })
      fireEvent.keyDown(src, { key: "Enter" })
    })

    expect(byTap).toEqual(["p1", "n2"])
    expect(byDrag).toEqual(byTap)
    expect(byKeyboard).toEqual(byTap)
  })
})

describe("RewireSurface — announcements", () => {
  it("announces selection, result, and snap-back through the live region", async () => {
    const user = userEvent.setup()
    setup()
    const live = screen.getByRole("status")

    await user.click(source("p1"))
    expect(live).toHaveTextContent(/head pointer selected/i)

    await user.click(target("n1"))
    expect(live).toHaveTextContent(/rewired head pointer to node one/i)

    await user.click(source("p2"))
    await user.click(screen.getByTestId("rewire-surface"))
    expect(live).toHaveTextContent(/snapped back/i)
  })
})

describe("RewireSurface — tracer hooks & affordances", () => {
  it("exposes stable source/target id hooks and a dev-only legal marker", () => {
    setup({ legal: ["n1"] })

    expect(source("p1")).toHaveAttribute("data-rewire-source", "p1")
    expect(target("n1")).toHaveAttribute("data-rewire-target", "n1")
    expect(target("n1")).toHaveAttribute("data-rewire-legal", "1")
    expect(target("n2")).not.toHaveAttribute("data-rewire-legal")
  })
})
