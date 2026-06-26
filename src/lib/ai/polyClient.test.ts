import { describe, it, expect, vi, beforeEach } from "vitest"
import { httpsCallable } from "firebase/functions"

const { mockCallable } = vi.hoisted(() => ({ mockCallable: vi.fn() }))

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(() => mockCallable),
}))
vi.mock("@/lib/firebase", () => ({ functions: {} }))

import { polyHealthCheck } from "./polyClient"

describe("polyHealthCheck client", () => {
  beforeEach(() => mockCallable.mockReset())

  it("returns the callable's result data", async () => {
    mockCallable.mockResolvedValue({
      data: { ok: true, model: "m", reply: "pong", uid: null },
    })
    const res = await polyHealthCheck()
    expect(vi.mocked(httpsCallable)).toHaveBeenCalledWith(
      expect.anything(),
      "polyHealthCheck",
    )
    expect(res).toEqual({ ok: true, model: "m", reply: "pong", uid: null })
  })
})

describe("requestHint client", () => {
  beforeEach(() => mockCallable.mockReset())

  it("calls the polyHint callable and returns its data", async () => {
    const { requestHint } = await import("./polyClient")
    const { httpsCallable } = await import("firebase/functions")
    mockCallable.mockResolvedValue({ data: { hint: "a nudge" } })

    const res = await requestHint({
      stageId: "stacks-and-queues",
      skill: "stackConstruct",
      discipline: "stack",
      learnerOrder: ["A", "B", "C"],
    })

    expect(res).toEqual({ hint: "a nudge" })
    expect(vi.mocked(httpsCallable)).toHaveBeenCalledWith(expect.anything(), "polyHint")
  })
})

describe("checkpoint client helpers", () => {
  beforeEach(() => mockCallable.mockReset())

  it("scoreExplanation calls polyScore and returns its data", async () => {
    const { scoreExplanation } = await import("./polyClient")
    const { httpsCallable } = await import("firebase/functions")
    mockCallable.mockResolvedValue({
      data: { scores: [{ id: "P1", verdict: "covered" }], weakest: null },
    })
    const res = await scoreExplanation({ conceptId: "stacks", explanation: "x" })
    expect(res.weakest).toBeNull()
    expect(vi.mocked(httpsCallable)).toHaveBeenCalledWith(expect.anything(), "polyScore")
  })

  it("requestProbe calls polyProbe and returns its data", async () => {
    const { requestProbe } = await import("./polyClient")
    const { httpsCallable } = await import("firebase/functions")
    mockCallable.mockResolvedValue({ data: { question: "a probe?" } })
    const res = await requestProbe({ conceptId: "stacks", propositionId: "P1", explanation: "x" })
    expect(res.question).toBe("a probe?")
    expect(vi.mocked(httpsCallable)).toHaveBeenCalledWith(expect.anything(), "polyProbe")
  })
})

describe("voice client helpers", () => {
  beforeEach(() => mockCallable.mockReset())

  it("speak calls polySpeak and returns its data", async () => {
    const { speak } = await import("./polyClient")
    const { httpsCallable } = await import("firebase/functions")
    mockCallable.mockResolvedValue({ data: { audio: "QUJD", mime: "audio/mpeg" } })
    const res = await speak({ text: "hello" })
    expect(res).toEqual({ audio: "QUJD", mime: "audio/mpeg" })
    expect(vi.mocked(httpsCallable)).toHaveBeenCalledWith(expect.anything(), "polySpeak")
  })

  it("transcribe calls polyTranscribe and returns its data", async () => {
    const { transcribe } = await import("./polyClient")
    const { httpsCallable } = await import("firebase/functions")
    mockCallable.mockResolvedValue({ data: { text: "spoken" } })
    const res = await transcribe({ audio: "QUJD", mime: "audio/webm" })
    expect(res).toEqual({ text: "spoken" })
    expect(vi.mocked(httpsCallable)).toHaveBeenCalledWith(expect.anything(), "polyTranscribe")
  })

  it("realtimeToken calls polyRealtimeToken and returns its data", async () => {
    const { realtimeToken } = await import("./polyClient")
    const { httpsCallable } = await import("firebase/functions")
    mockCallable.mockResolvedValue({
      data: { token: "ek_x", expiresAt: 123, model: "gpt-4o-transcribe" },
    })
    const res = await realtimeToken()
    expect(res).toEqual({ token: "ek_x", expiresAt: 123, model: "gpt-4o-transcribe" })
    expect(vi.mocked(httpsCallable)).toHaveBeenCalledWith(
      expect.anything(),
      "polyRealtimeToken",
    )
  })
})
