import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useStallNudge } from "./useStallNudge"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("useStallNudge", () => {
  it("fires once after the delay when enabled", () => {
    const onStall = vi.fn()
    renderHook(() => useStallNudge({ enabled: true, resetKey: 0, delayMs: 20000, onStall }))
    vi.advanceTimersByTime(19999)
    expect(onStall).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onStall).toHaveBeenCalledTimes(1)
  })

  it("resets the timer when resetKey changes (activity)", () => {
    const onStall = vi.fn()
    const { rerender } = renderHook(
      ({ k }) => useStallNudge({ enabled: true, resetKey: k, delayMs: 20000, onStall }),
      { initialProps: { k: 0 } },
    )
    vi.advanceTimersByTime(15000)
    rerender({ k: 1 })
    vi.advanceTimersByTime(15000)
    expect(onStall).not.toHaveBeenCalled()
    vi.advanceTimersByTime(5000)
    expect(onStall).toHaveBeenCalledTimes(1)
  })

  it("does nothing when disabled", () => {
    const onStall = vi.fn()
    renderHook(() => useStallNudge({ enabled: false, resetKey: 0, delayMs: 20000, onStall }))
    vi.advanceTimersByTime(60000)
    expect(onStall).not.toHaveBeenCalled()
  })
})
