// src/lib/ai/voice.ts
import {
  speak as defaultSpeak,
  transcribe as defaultTranscribe,
  type SpeakRequest,
  type SpeakResponse,
  type TranscribeRequest,
  type TranscribeResponse,
} from "@/lib/ai/polyClient"

export function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const s = String(reader.result)
      resolve(s.slice(s.indexOf(",") + 1)) // strip the "data:...;base64," prefix
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

type SpeakFn = (req: SpeakRequest) => Promise<SpeakResponse>
type TranscribeFn = (req: TranscribeRequest) => Promise<TranscribeResponse>

/**
 * Fetch TTS audio for `text` and play it. Resolves when playback ends. Any
 * failure (no audio returned, autoplay blocked, playback error) resolves
 * quietly so voice never blocks the lesson.
 */
export async function speakText(text: string, speak: SpeakFn = defaultSpeak): Promise<void> {
  let url: string | null = null
  try {
    const res = await speak({ text })
    if (!res.audio || !res.mime) return
    url = URL.createObjectURL(base64ToBlob(res.audio, res.mime))
    const audio = new Audio(url)
    await audio.play()
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve()
      audio.onerror = () => resolve()
    })
  } catch {
    // swallow: autoplay policy / network / decode errors fall back to text
  } finally {
    if (url) URL.revokeObjectURL(url)
  }
}

export interface VoiceRecorder {
  start(): Promise<void>
  stop(): Promise<string> // resolves with the transcript ("" on failure)
  cancel(): void
}

/**
 * Mic recorder that transcribes on stop. Throws from start() if mic permission
 * is denied (the caller catches and falls back to typing). stop() fails soft to
 * "" so a transcription error degrades to an empty answer, never a crash.
 */
export function createRecorder(transcribe: TranscribeFn = defaultTranscribe): VoiceRecorder {
  let stream: MediaStream | null = null
  let recorder: MediaRecorder | null = null
  let chunks: Blob[] = []

  const release = () => {
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
    recorder = null
    chunks = []
  }

  return {
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunks = []
      recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      recorder.start()
    },
    async stop() {
      const rec = recorder
      if (!rec) return ""
      const blob = await new Promise<Blob>((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || "audio/webm" }))
        rec.stop()
      })
      release()
      try {
        const audio = await blobToBase64(blob)
        const res = await transcribe({ audio, mime: blob.type })
        return res.text ?? ""
      } catch {
        return ""
      }
    },
    cancel() {
      try {
        recorder?.stop()
      } catch {
        // ignore
      }
      release()
    },
  }
}
