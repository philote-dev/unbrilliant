import { describe, it, expect, vi } from "vitest"
import { openAICompleter } from "./openai"

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
