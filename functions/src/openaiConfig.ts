import { defineSecret } from "firebase-functions/params"

export const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY")

// Overridable per environment via process.env (functions/.env, .env.local, or
// deploy env vars). Read as a plain env var to avoid the interactive param
// prompt the emulator shows for defineString.
export const DEFAULT_MODEL = "gpt-4o-mini"

export function resolveModel(): string {
  return process.env.OPENAI_MODEL ?? DEFAULT_MODEL
}

// Audio models for Poly voice. gpt-4o-mini-tts is steerable (accepts an
// `instructions` tone string); gpt-4o-mini-transcribe is the low-latency STT
// model. Overridable per environment like OPENAI_MODEL.
export const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts"
export const DEFAULT_STT_MODEL = "gpt-4o-mini-transcribe"
export const DEFAULT_TTS_VOICE = "alloy"

export function resolveTtsModel(): string {
  return process.env.OPENAI_TTS_MODEL ?? DEFAULT_TTS_MODEL
}

export function resolveSttModel(): string {
  return process.env.OPENAI_STT_MODEL ?? DEFAULT_STT_MODEL
}

export function resolveTtsVoice(): string {
  return process.env.OPENAI_TTS_VOICE ?? DEFAULT_TTS_VOICE
}

// Realtime transcription model for the live (streaming) voice path. gpt-4o-transcribe
// streams incremental deltas as the learner speaks; whisper-1 only returns a final
// transcript, so it is not used here.
export const DEFAULT_REALTIME_MODEL = "gpt-4o-transcribe"

export function resolveRealtimeModel(): string {
  return process.env.OPENAI_REALTIME_MODEL ?? DEFAULT_REALTIME_MODEL
}
