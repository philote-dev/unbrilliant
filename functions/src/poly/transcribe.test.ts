import { describe, expect, it, vi } from "vitest"
import { transcribeAudio } from "./transcribe"
import type { Transcriber } from "../openai"

function fakeTranscriber(text: string): Transcriber {
  return { transcribe: vi.fn().mockResolvedValue(text) }
}

const b64 = (bytes: number[]) => Buffer.from(bytes).toString("base64")

describe("transcribeAudio", () => {
  it("decodes base64 audio, derives a filename from the mime, and returns trimmed text", async () => {
    const t = fakeTranscriber("  spoken answer  ")
    const out = await transcribeAudio(t, "m", { audio: b64([1, 2, 3]), mime: "audio/webm;codecs=opus" })
    expect(out).toEqual({ text: "spoken answer" })
    const arg = (t.transcribe as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(arg.filename).toBe("speech.webm")
    expect(arg.model).toBe("m")
  })

  it("returns null text for empty audio without calling the transcriber", async () => {
    const t = fakeTranscriber("x")
    const out = await transcribeAudio(t, "m", { audio: "", mime: "audio/webm" })
    expect(out).toEqual({ text: null })
    expect(t.transcribe).not.toHaveBeenCalled()
  })

  it("rejects oversized audio without calling the transcriber", async () => {
    const t = fakeTranscriber("x")
    const huge = "A".repeat(12 * 1024 * 1024) // > 8MB decoded
    const out = await transcribeAudio(t, "m", { audio: huge, mime: "audio/webm" })
    expect(out).toEqual({ text: null })
    expect(t.transcribe).not.toHaveBeenCalled()
  })
})
