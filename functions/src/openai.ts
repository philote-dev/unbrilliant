import OpenAI, { toFile } from "openai"

export interface CompletionRequest {
  system: string
  user: string
  model: string
}

export interface Completer {
  complete(req: CompletionRequest): Promise<string>
}

export function createClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey })
}

export function openAICompleter(client: OpenAI): Completer {
  return {
    async complete({ system, user, model }) {
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      })
      return res.choices[0]?.message?.content ?? ""
    },
  }
}

export interface SpeechRequest {
  text: string
  model: string
  voice: string
  instructions?: string
}

export interface Speaker {
  speak(req: SpeechRequest): Promise<Buffer>
}

export function openAISpeaker(client: OpenAI): Speaker {
  return {
    async speak({ text, model, voice, instructions }) {
      const res = await client.audio.speech.create({
        model,
        voice,
        input: text,
        response_format: "mp3",
        ...(instructions ? { instructions } : {}),
      })
      return Buffer.from(await res.arrayBuffer())
    },
  }
}

export interface TranscriptionRequest {
  audio: Buffer
  filename: string
  model: string
}

export interface Transcriber {
  transcribe(req: TranscriptionRequest): Promise<string>
}

export function openAITranscriber(client: OpenAI): Transcriber {
  return {
    async transcribe({ audio, filename, model }) {
      const file = await toFile(audio, filename)
      const res = await client.audio.transcriptions.create({ file, model })
      return res.text ?? ""
    },
  }
}

export interface RealtimeTokenResult {
  value: string
  expiresAt: number
}

export interface RealtimeTokenMinter {
  mint(model: string): Promise<RealtimeTokenResult>
}

// Mints a short-lived ephemeral token so a browser can open a Realtime
// transcription session over WebRTC. Uses a raw REST call rather than the chat
// SDK, so it stays decoupled from SDK drift; fetch is injectable for tests.
export function openAIRealtimeTokenMinter(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): RealtimeTokenMinter {
  return {
    async mint(model) {
      const res = await fetchImpl(
        "https://api.openai.com/v1/realtime/transcription_sessions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input_audio_transcription: { model },
            turn_detection: { type: "server_vad" },
          }),
        },
      )
      if (!res.ok) {
        throw new Error(`realtime token mint failed: ${res.status}`)
      }
      const data = (await res.json()) as {
        client_secret?: { value?: string; expires_at?: number }
      }
      const value = data.client_secret?.value
      if (!value) {
        throw new Error("realtime token mint returned no client_secret")
      }
      return { value, expiresAt: data.client_secret?.expires_at ?? 0 }
    },
  }
}
