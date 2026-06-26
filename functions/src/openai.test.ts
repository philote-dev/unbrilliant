import { describe, it, expect, vi } from "vitest"
import { openAICompleter, openAISpeaker, openAITranscriber } from "./openai"

describe("openAICompleter", () => {
  it("sends system+user messages to chat.completions and returns the content", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "  hello  " } }],
    })
    const fakeClient = { chat: { completions: { create } } }
    const completer = openAICompleter(fakeClient as never)

    const out = await completer.complete({ system: "S", user: "U", model: "m" })

    expect(create).toHaveBeenCalledWith({
      model: "m",
      messages: [
        { role: "system", content: "S" },
        { role: "user", content: "U" },
      ],
    })
    expect(out).toBe("  hello  ")
  })

  it("returns an empty string when the model returns no content", async () => {
    const create = vi.fn().mockResolvedValue({ choices: [] })
    const completer = openAICompleter({ chat: { completions: { create } } } as never)
    expect(await completer.complete({ system: "S", user: "U", model: "m" })).toBe("")
  })
})

describe("openAISpeaker", () => {
  it("calls audio.speech.create and returns the bytes as a Buffer", async () => {
    const create = vi.fn().mockResolvedValue({
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    })
    const speaker = openAISpeaker({ audio: { speech: { create } } } as never)

    const out = await speaker.speak({
      text: "hi",
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      instructions: "Speak warmly.",
    })

    expect(create).toHaveBeenCalledWith({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: "hi",
      instructions: "Speak warmly.",
    })
    expect(Buffer.isBuffer(out)).toBe(true)
    expect([...out]).toEqual([1, 2, 3])
  })

  it("omits instructions when none are provided", async () => {
    const create = vi.fn().mockResolvedValue({
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    })
    const speaker = openAISpeaker({ audio: { speech: { create } } } as never)

    await speaker.speak({
      text: "hi",
      model: "gpt-4o-mini-tts",
      voice: "alloy",
    })

    const arg = create.mock.calls[0][0]
    expect(arg).not.toHaveProperty("instructions")
    expect(arg.model).toBe("gpt-4o-mini-tts")
    expect(arg.voice).toBe("alloy")
    expect(arg.input).toBe("hi")
  })
})

describe("openAITranscriber", () => {
  it("sends a file built from the buffer and returns the transcript text", async () => {
    const create = vi.fn().mockResolvedValue({ text: " hello world " })
    const transcriber = openAITranscriber({
      audio: { transcriptions: { create } },
    } as never)

    const out = await transcriber.transcribe({
      audio: Buffer.from([4, 5, 6]),
      filename: "speech.webm",
      model: "gpt-4o-mini-transcribe",
    })

    expect(create).toHaveBeenCalledTimes(1)
    const arg = create.mock.calls[0][0]
    expect(arg.model).toBe("gpt-4o-mini-transcribe")
    expect(arg.file).toBeDefined()
    expect(arg.file.name).toBe("speech.webm")
    expect(out).toBe(" hello world ")
  })

  it("returns an empty string when the model returns no text", async () => {
    const create = vi.fn().mockResolvedValue({ text: undefined })
    const transcriber = openAITranscriber({
      audio: { transcriptions: { create } },
    } as never)

    const out = await transcriber.transcribe({
      audio: Buffer.from([7, 8, 9]),
      filename: "speech.webm",
      model: "gpt-4o-mini-transcribe",
    })

    expect(out).toBe("")
  })
})
