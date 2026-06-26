import { logger } from "firebase-functions"
import { onCall } from "firebase-functions/https"
import { Transcriber, createClient, openAITranscriber } from "../openai"
import { OPENAI_API_KEY, resolveSttModel } from "../openaiConfig"

export interface TranscribeArgs {
  audio: string // base64-encoded audio bytes
  mime: string
}

export interface TranscribeResult {
  text: string | null
}

// A self-explanation is short; cap decoded audio so a bad request can't push a
// huge file to the STT model.
const MAX_BYTES = 8 * 1024 * 1024

function extFromMime(mime: string): string {
  const m = (mime ?? "").toLowerCase()
  if (m.includes("webm")) return "webm"
  if (m.includes("ogg")) return "ogg"
  if (m.includes("wav")) return "wav"
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "mp4"
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3"
  return "webm"
}

export async function transcribeAudio(
  transcriber: Transcriber,
  model: string,
  args: TranscribeArgs,
): Promise<TranscribeResult> {
  if (!args?.audio) return { text: null }
  const buf = Buffer.from(args.audio, "base64")
  if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return { text: null }
  const filename = `speech.${extFromMime(args.mime)}`
  const text = await transcriber.transcribe({ audio: buf, filename, model })
  return { text: text.trim() || null }
}

export const polyTranscribe = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (request): Promise<TranscribeResult> => {
    try {
      const transcriber = openAITranscriber(createClient(OPENAI_API_KEY.value()))
      return await transcribeAudio(transcriber, resolveSttModel(), request.data as TranscribeArgs)
    } catch (err) {
      logger.error("polyTranscribe failed", err)
      return { text: null }
    }
  },
)
