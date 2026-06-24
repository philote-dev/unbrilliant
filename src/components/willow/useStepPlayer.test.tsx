import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"

import { STEP_SPEEDS, useStepPlayer } from "./useStepPlayer"

/**
 * Tests for the cross-lesson playback brain. `useReducedMotion` reads matchMedia,
 * so stub it (matches:false) and drive the reduced-motion path via the explicit
 * `reduced` option, keeping these deterministic without media mocking.
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

describe("useStepPlayer — bounds & navigation", () => {
  it("starts at the first frame and clamps next/prev at the ends", () => {
    const { result } = renderHook(() => useStepPlayer(4, { reduced: false }))
    expect(result.current.index).toBe(0)
    expect(result.current.atStart).toBe(true)
    expect(result.current.atEnd).toBe(false)

    act(() => result.current.next())
    expect(result.current.index).toBe(1)
    act(() => result.current.next())
    act(() => result.current.next())
    expect(result.current.index).toBe(3)
    expect(result.current.atEnd).toBe(true)

    act(() => result.current.next()) // clamp at the end
    expect(result.current.index).toBe(3)

    act(() => result.current.prev())
    expect(result.current.index).toBe(2)
    act(() => result.current.prev())
    act(() => result.current.prev())
    expect(result.current.index).toBe(0)
    act(() => result.current.prev()) // clamp at the start
    expect(result.current.index).toBe(0)
  })

  it("first() and last() jump to the ends", () => {
    const { result } = renderHook(() => useStepPlayer(5, { reduced: false }))
    act(() => result.current.last())
    expect(result.current.index).toBe(4)
    act(() => result.current.first())
    expect(result.current.index).toBe(0)
  })

  it("goTo rounds and clamps into range", () => {
    const { result } = renderHook(() => useStepPlayer(3, { reduced: false }))
    act(() => result.current.goTo(99))
    expect(result.current.index).toBe(2)
    act(() => result.current.goTo(-4))
    expect(result.current.index).toBe(0)
    act(() => result.current.goTo(1.6))
    expect(result.current.index).toBe(2)
  })
})

describe("useStepPlayer — reduced motion", () => {
  it("starts parked on the END frame and never auto-plays", () => {
    const { result } = renderHook(() =>
      useStepPlayer(5, { reduced: true, autoPlay: true }),
    )
    expect(result.current.index).toBe(4)
    expect(result.current.atEnd).toBe(true)
    expect(result.current.playing).toBe(false)
  })

  it("still allows manual stepping (view-state, not engine-state)", () => {
    const { result } = renderHook(() => useStepPlayer(3, { reduced: true }))
    expect(result.current.index).toBe(2)
    act(() => result.current.prev())
    expect(result.current.index).toBe(1)
  })

  it("play() and replay() do not start motion under reduced motion", () => {
    const { result } = renderHook(() => useStepPlayer(3, { reduced: true }))
    act(() => result.current.play())
    expect(result.current.playing).toBe(false)
    act(() => result.current.replay())
    expect(result.current.playing).toBe(false)
    expect(result.current.index).toBe(0)
  })
})

describe("useStepPlayer — autoplay", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("auto-advances frame by frame, stops at the end, and does not loop", () => {
    const { result } = renderHook(() =>
      useStepPlayer(3, { reduced: false, autoPlay: true, baseStepMs: 100 }),
    )
    expect(result.current.playing).toBe(true)
    expect(result.current.index).toBe(0)

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.index).toBe(1)

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.index).toBe(2)
    expect(result.current.playing).toBe(false) // stopped itself at the end

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.index).toBe(2) // no looping
  })

  it("pause freezes advancement; toggle resumes from the current frame", () => {
    const { result } = renderHook(() =>
      useStepPlayer(4, { reduced: false, autoPlay: true, baseStepMs: 100 }),
    )
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.index).toBe(1)

    act(() => result.current.pause())
    expect(result.current.playing).toBe(false)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.index).toBe(1) // frozen while paused

    act(() => result.current.toggle())
    expect(result.current.playing).toBe(true)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.index).toBe(2)
  })

  it("manual stepping pauses an in-flight autoplay", () => {
    const { result } = renderHook(() =>
      useStepPlayer(5, { reduced: false, autoPlay: true, baseStepMs: 100 }),
    )
    act(() => {
      vi.advanceTimersByTime(100)
    })
    act(() => result.current.next())
    expect(result.current.playing).toBe(false)
    expect(result.current.index).toBe(2)
  })
})

describe("useStepPlayer — speed", () => {
  it("clamps speed to the supported range", () => {
    const { result } = renderHook(() => useStepPlayer(4, { reduced: false }))
    act(() => result.current.setSpeed(99))
    expect(result.current.speed).toBe(STEP_SPEEDS[STEP_SPEEDS.length - 1])
    act(() => result.current.setSpeed(0.0001))
    expect(result.current.speed).toBe(STEP_SPEEDS[0])
  })

  it("a single frame can never play", () => {
    const { result } = renderHook(() =>
      useStepPlayer(1, { reduced: false, autoPlay: true }),
    )
    expect(result.current.playing).toBe(false)
    expect(result.current.atStart).toBe(true)
    expect(result.current.atEnd).toBe(true)
  })
})
