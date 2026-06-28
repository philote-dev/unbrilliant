import { describe, expect, it, vi } from "vitest"
import { base64ToBlob, playAudioBlob, speakText } from "./voice"

describe("base64ToBlob", () => {
  it("decodes base64 into a Blob of the right size and type", () => {
    // base64 "QUJD" === bytes [65,66,67] === "ABC"
    const blob = base64ToBlob("QUJD", "audio/mpeg")
    expect(blob.size).toBe(3)
    expect(blob.type).toBe("audio/mpeg")
  })
})

describe("speakText (cancellation)", () => {
  const okClip = { audio: "QUJD", mime: "audio/mpeg" }

  it("never fetches or plays when the signal is already aborted", async () => {
    const speak = vi.fn()
    const play = vi.fn()
    const ctrl = new AbortController()
    ctrl.abort()
    await speakText("hi", ctrl.signal, { speak, play })
    expect(speak).not.toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()
  })

  it("does not play if it is aborted while the clip is still being fetched", async () => {
    let resolveSpeak!: (v: typeof okClip) => void
    const speak = vi.fn(
      () => new Promise<typeof okClip>((r) => (resolveSpeak = r)),
    )
    const play = vi.fn().mockResolvedValue(undefined)
    const ctrl = new AbortController()
    const pending = speakText("hi", ctrl.signal, { speak, play })
    ctrl.abort()
    resolveSpeak(okClip)
    await pending
    expect(play).not.toHaveBeenCalled()
  })

  it("plays the fetched clip and forwards the signal so playback can be cancelled", async () => {
    const speak = vi.fn().mockResolvedValue(okClip)
    const play = vi.fn().mockResolvedValue(undefined)
    const ctrl = new AbortController()
    await speakText("hi", ctrl.signal, { speak, play })
    expect(play).toHaveBeenCalledTimes(1)
    const [blob, signal] = play.mock.calls[0]
    expect(blob).toBeInstanceOf(Blob)
    expect(signal).toBe(ctrl.signal)
  })
})

describe("playAudioBlob (cancellation)", () => {
  it("pauses playback the moment the signal aborts", async () => {
    const audio = {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    } as unknown as HTMLAudioElement
    const ctrl = new AbortController()
    const pending = playAudioBlob(
      new Blob(["x"], { type: "audio/mpeg" }),
      ctrl.signal,
      () => audio,
    )
    // Let play() resolve and the abort listener attach before aborting.
    await Promise.resolve()
    await Promise.resolve()
    ctrl.abort()
    await pending
    expect(audio.pause).toHaveBeenCalled()
  })

  it("never constructs the audio element when already aborted", async () => {
    const makeAudio = vi.fn()
    const ctrl = new AbortController()
    ctrl.abort()
    await playAudioBlob(new Blob(["x"]), ctrl.signal, makeAudio)
    expect(makeAudio).not.toHaveBeenCalled()
  })
})
