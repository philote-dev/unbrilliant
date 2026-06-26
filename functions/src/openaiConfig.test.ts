import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  DEFAULT_MODEL,
  DEFAULT_REALTIME_MODEL,
  DEFAULT_STT_MODEL,
  DEFAULT_TTS_MODEL,
  DEFAULT_TTS_VOICE,
  resolveModel,
  resolveRealtimeModel,
  resolveSttModel,
  resolveTtsModel,
  resolveTtsVoice,
} from "./openaiConfig"

function clearOpenAIEnv() {
  delete process.env.OPENAI_MODEL
  delete process.env.OPENAI_TTS_MODEL
  delete process.env.OPENAI_STT_MODEL
  delete process.env.OPENAI_TTS_VOICE
  delete process.env.OPENAI_REALTIME_MODEL
}

beforeEach(clearOpenAIEnv)
afterEach(clearOpenAIEnv)

describe("openaiConfig resolvers", () => {
  it("fall back to the defaults when no env override is set", () => {
    expect(resolveModel()).toBe(DEFAULT_MODEL)
    expect(resolveTtsModel()).toBe(DEFAULT_TTS_MODEL)
    expect(resolveSttModel()).toBe(DEFAULT_STT_MODEL)
    expect(resolveTtsVoice()).toBe(DEFAULT_TTS_VOICE)
    expect(resolveRealtimeModel()).toBe(DEFAULT_REALTIME_MODEL)
  })

  it("prefer env overrides when present", () => {
    process.env.OPENAI_TTS_MODEL = "tts-1"
    process.env.OPENAI_STT_MODEL = "whisper-1"
    process.env.OPENAI_TTS_VOICE = "coral"
    process.env.OPENAI_REALTIME_MODEL = "gpt-4o-mini-transcribe"
    expect(resolveTtsModel()).toBe("tts-1")
    expect(resolveSttModel()).toBe("whisper-1")
    expect(resolveTtsVoice()).toBe("coral")
    expect(resolveRealtimeModel()).toBe("gpt-4o-mini-transcribe")
  })
})
