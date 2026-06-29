import { describe, it, expect, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { usePolyHint } from "./usePolyHint"
import type { HintRequest, HintResponse } from "./polyClient"

const baseProps = {
  stageId: "stacks-and-queues",
  skill: "stackConstruct",
  discipline: "stack" as const,
}

describe("usePolyHint", () => {
  it("does nothing while there is no wrong attempt", () => {
    const requestHint = vi.fn()
    const { result } = renderHook(() =>
      usePolyHint({ ...baseProps, wrongAttempt: null, requestHint }),
    )
    expect(result.current).toEqual({ loading: false, text: null })
    expect(requestHint).not.toHaveBeenCalled()
  })

  it("fetches once for a wrong attempt and exposes the hint", async () => {
    const requestHint = vi
      .fn<(r: HintRequest) => Promise<HintResponse>>()
      .mockResolvedValue({ hint: "a nudge" })
    const { result, rerender } = renderHook((props) => usePolyHint(props), {
      initialProps: {
        ...baseProps,
        wrongAttempt: { id: 1, learnerOrder: ["A", "B", "C"] },
        requestHint,
      },
    })
    await waitFor(() => expect(result.current.text).toBe("a nudge"))
    expect(requestHint).toHaveBeenCalledTimes(1)
    // A re-render with the SAME attempt id must not refetch.
    rerender({
      ...baseProps,
      wrongAttempt: { id: 1, learnerOrder: ["A", "B", "C"] },
      requestHint,
    })
    expect(requestHint).toHaveBeenCalledTimes(1)
  })

  it("falls back (text null) after the 2-hint cap, passing the prior hint between calls", async () => {
    const requestHint = vi
      .fn<(r: HintRequest) => Promise<HintResponse>>()
      .mockResolvedValueOnce({ hint: "hint 1" })
      .mockResolvedValueOnce({ hint: "hint 2" })
    const { result, rerender } = renderHook((props) => usePolyHint(props), {
      initialProps: {
        ...baseProps,
        wrongAttempt: { id: 1, learnerOrder: ["A"] },
        requestHint,
      },
    })
    await waitFor(() => expect(result.current.text).toBe("hint 1"))

    rerender({ ...baseProps, wrongAttempt: { id: 2, learnerOrder: ["A"] }, requestHint })
    await waitFor(() => expect(result.current.text).toBe("hint 2"))
    expect(requestHint.mock.calls[1][0].priorHint).toBe("hint 1")

    // Third wrong attempt is over the cap -> no fetch, fall back to static.
    rerender({ ...baseProps, wrongAttempt: { id: 3, learnerOrder: ["A"] }, requestHint })
    await waitFor(() => expect(result.current).toEqual({ loading: false, text: null }))
    expect(requestHint).toHaveBeenCalledTimes(2)
  })

  it("resets the cap when the beat (skill) changes", async () => {
    const requestHint = vi
      .fn<(r: HintRequest) => Promise<HintResponse>>()
      .mockResolvedValue({ hint: "x" })
    const { rerender } = renderHook((props) => usePolyHint(props), {
      initialProps: {
        ...baseProps,
        wrongAttempt: { id: 1, learnerOrder: ["A"] },
        requestHint,
      },
    })
    await waitFor(() => expect(requestHint).toHaveBeenCalledTimes(1))
    rerender({ ...baseProps, wrongAttempt: { id: 2, learnerOrder: ["A"] }, requestHint })
    await waitFor(() => expect(requestHint).toHaveBeenCalledTimes(2))
    // New beat: cap resets, so a wrong attempt fetches again.
    rerender({
      ...baseProps,
      skill: "queueConstruct",
      wrongAttempt: { id: 3, learnerOrder: ["A"] },
      requestHint,
    })
    await waitFor(() => expect(requestHint).toHaveBeenCalledTimes(3))
  })

  it("falls back (loading false, text null) when requestHint rejects", async () => {
    const requestHint = vi
      .fn<(r: HintRequest) => Promise<HintResponse>>()
      .mockRejectedValue(new Error("boom"))
    const { result } = renderHook(() =>
      usePolyHint({
        ...baseProps,
        wrongAttempt: { id: 1, learnerOrder: ["A", "B", "C"] },
        requestHint,
      }),
    )
    await waitFor(() => expect(result.current).toEqual({ loading: false, text: null }))
    expect(requestHint).toHaveBeenCalledTimes(1)
  })

  it("forwards the array discipline and the chosen wrong option", async () => {
    const requestHint = vi
      .fn<(r: HintRequest) => Promise<HintResponse>>()
      .mockResolvedValue({ hint: "again and again" })
    const { result } = renderHook(() =>
      usePolyHint({
        stageId: "arrays",
        skill: "grow",
        discipline: "array",
        wrongAttempt: { id: 1, learnerOrder: ["grow the block by one slot"] },
        requestHint,
      }),
    )
    await waitFor(() => expect(result.current.text).toBe("again and again"))
    expect(requestHint.mock.calls[0][0]).toMatchObject({
      discipline: "array",
      skill: "grow",
      learnerOrder: ["grow the block by one slot"],
    })
  })

  it("forwards diagnosis/attempt/boundary/configKey plus mode and attemptIndex", async () => {
    const requestHint = vi
      .fn<(r: HintRequest) => Promise<HintResponse>>()
      .mockResolvedValue({ hint: "mind the tail" })
    const { result } = renderHook(() =>
      usePolyHint({
        stageId: "linked-lists",
        skill: "llInsert",
        discipline: "linked-list",
        wrongAttempt: { id: 1, learnerOrder: ["A", "B"] },
        diagnosis: { kind: "repointed-before-saving", stepNumber: 1 },
        attempt: ["aim p:A -> X"],
        boundary: true,
        configKey: "head-insert",
        requestHint,
      }),
    )
    await waitFor(() => expect(result.current.text).toBe("mind the tail"))
    expect(requestHint.mock.calls[0][0]).toMatchObject({
      stageId: "linked-lists",
      skill: "llInsert",
      discipline: "linked-list",
      learnerOrder: ["A", "B"],
      diagnosis: { kind: "repointed-before-saving", stepNumber: 1 },
      attempt: ["aim p:A -> X"],
      boundary: true,
      configKey: "head-insert",
      mode: "hint",
      attemptIndex: 0,
    })
  })
})
