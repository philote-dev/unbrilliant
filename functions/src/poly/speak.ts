import { logger } from "firebase-functions"
import { onCall } from "firebase-functions/https"
import { Speaker, createClient, openAISpeaker } from "../openai"
import { OPENAI_API_KEY, resolveTtsModel, resolveTtsVoice } from "../openaiConfig"

export interface SpeakArgs {
  text: string
}

export interface SpeakResult {
  audio: string | null // base64-encoded audio bytes
  mime: string | null
}

// Poly's spoken lines are short questions/probes; cap input so a malformed or
// hostile request can't run up TTS cost or latency.
const MAX_TEXT = 600

const POLY_INSTRUCTIONS =
  "Speak warmly and encouragingly, like a friendly, upbeat tutor. Keep it natural and kind."

export async function synthesizeSpeech(
  speaker: Speaker,
  model: string,
  voice: string,
  args: SpeakArgs,
): Promise<SpeakResult> {
  const text = (args?.text ?? "").trim().slice(0, MAX_TEXT)
  if (!text) return { audio: null, mime: null }
  const buf = await speaker.speak({ text, model, voice, instructions: POLY_INSTRUCTIONS })
  return { audio: buf.toString("base64"), mime: "audio/mpeg" }
}

export const polySpeak = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (request): Promise<SpeakResult> => {
    try {
      const speaker = openAISpeaker(createClient(OPENAI_API_KEY.value()))
      return await synthesizeSpeech(
        speaker,
        resolveTtsModel(),
        resolveTtsVoice(),
        request.data as SpeakArgs,
      )
    } catch (err) {
      logger.error("polySpeak failed", err)
      return { audio: null, mime: null }
    }
  },
)
