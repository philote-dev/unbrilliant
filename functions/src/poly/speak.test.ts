import { describe, expect, it, vi } from "vitest"
import { synthesizeSpeech } from "./speak"
import type { Speaker } from "../openai"

function fakeSpeaker(bytes: number[]): Speaker {
  return { speak: vi.fn().mockResolvedValue(Buffer.from(bytes)) }
}

describe("synthesizeSpeech", () => {
  it("returns base64 audio + mime for non-empty text", async () => {
    const speaker = fakeSpeaker([1, 2, 3])
    const out = await synthesizeSpeech(speaker, "m", "alloy", { text: "hello" })
    expect(out).toEqual({ audio: Buffer.from([1, 2, 3]).toString("base64"), mime: "audio/mpeg" })
  })

  it("returns nulls and does not call the speaker for empty text", async () => {
    const speaker = fakeSpeaker([1])
    const out = await synthesizeSpeech(speaker, "m", "alloy", { text: "   " })
    expect(out).toEqual({ audio: null, mime: null })
    expect(speaker.speak).not.toHaveBeenCalled()
  })

  it("truncates very long text before synthesizing", async () => {
    const speaker = fakeSpeaker([9])
    await synthesizeSpeech(speaker, "m", "alloy", { text: "x".repeat(5000) })
    const arg = (speaker.speak as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(arg.text.length).toBeLessThanOrEqual(600)
  })
})
