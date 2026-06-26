import { afterEach, describe, expect, it } from "vitest"
import {
  DEFAULT_MODEL,
  DEFAULT_STT_MODEL,
  DEFAULT_TTS_MODEL,
  DEFAULT_TTS_VOICE,
  resolveModel,
  resolveSttModel,
  resolveTtsModel,
  resolveTtsVoice,
} from "./openaiConfig"

afterEach(() => {
  delete process.env.OPENAI_MODEL
  delete process.env.OPENAI_TTS_MODEL
  delete process.env.OPENAI_STT_MODEL
  delete process.env.OPENAI_TTS_VOICE
})

describe("openaiConfig resolvers", () => {
  it("fall back to the defaults when no env override is set", () => {
    expect(resolveModel()).toBe(DEFAULT_MODEL)
    expect(resolveTtsModel()).toBe(DEFAULT_TTS_MODEL)
    expect(resolveSttModel()).toBe(DEFAULT_STT_MODEL)
    expect(resolveTtsVoice()).toBe(DEFAULT_TTS_VOICE)
  })

  it("prefer env overrides when present", () => {
    process.env.OPENAI_TTS_MODEL = "tts-1"
    process.env.OPENAI_STT_MODEL = "whisper-1"
    process.env.OPENAI_TTS_VOICE = "coral"
    expect(resolveTtsModel()).toBe("tts-1")
    expect(resolveSttModel()).toBe("whisper-1")
    expect(resolveTtsVoice()).toBe("coral")
  })
})
