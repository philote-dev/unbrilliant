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

/** How `speakText` fetches the clip and plays it. Injectable for tests. */
export interface SpeakTextDeps {
  speak?: SpeakFn
  play?: (blob: Blob, signal?: AbortSignal) => Promise<void>
}

/**
 * Play a TTS audio blob, resolving when playback ends OR `signal` aborts. Aborting
 * pauses the element immediately, so a clip can never keep playing after the turn
 * that started it is gone (e.g. the learner has moved on to the next screen). The
 * `makeAudio` factory is injectable so the abort path is testable without a real
 * media element. Any failure resolves quietly so voice never blocks the lesson.
 */
export async function playAudioBlob(
  blob: Blob,
  signal?: AbortSignal,
  makeAudio: (url: string) => HTMLAudioElement = (url) => new Audio(url),
): Promise<void> {
  if (signal?.aborted) return
  let url = ""
  try {
    url = URL.createObjectURL(blob)
  } catch {
    // No object-URL support (non-browser): nothing to play.
  }
  const audio = makeAudio(url)
  try {
    await audio.play()
    if (signal?.aborted) {
      audio.pause()
      return
    }
    await new Promise<void>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const finish = () => {
        if (timer) clearTimeout(timer)
        signal?.removeEventListener("abort", onAbort)
        resolve()
      }
      const onAbort = () => {
        try {
          audio.pause()
        } catch {
          // ignore
        }
        finish()
      }
      audio.onended = finish
      audio.onerror = finish
      signal?.addEventListener("abort", onAbort)
      // Safety net: never hang the turn if "ended" never fires (some embedded
      // browsers). Cap at the clip duration when known, else a fixed ceiling.
      const capSeconds =
        Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 12
      timer = setTimeout(finish, capSeconds * 1000 + 500)
    })
  } catch {
    // swallow: autoplay policy / playback / decode errors fall back to text
  } finally {
    if (url) {
      try {
        URL.revokeObjectURL(url)
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Fetch TTS audio for `text` and play it. Resolves when playback ends. Pass a
 * `signal` to make the whole turn cancellable: once aborted it never starts (or
 * stops) playback, so a checkpoint that unmounts cannot leave Poly talking on the
 * next screen. Any failure (no audio, autoplay blocked, network) resolves quietly
 * so voice never blocks the lesson.
 */
export async function speakText(
  text: string,
  signal?: AbortSignal,
  deps: SpeakTextDeps = {},
): Promise<void> {
  const speak = deps.speak ?? defaultSpeak
  const play = deps.play ?? playAudioBlob
  if (signal?.aborted) return
  try {
    const res = await speak({ text })
    if (signal?.aborted || !res.audio || !res.mime) return
    await play(base64ToBlob(res.audio, res.mime), signal)
  } catch {
    // swallow: autoplay policy / network / decode errors fall back to text
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
      try {
        chunks = []
        recorder = new MediaRecorder(stream)
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data)
        }
        recorder.start()
      } catch (err) {
        release()
        throw err
      }
    },
    async stop() {
      const rec = recorder
      if (!rec) return ""
      try {
        const blob = await new Promise<Blob>((resolve, reject) => {
          rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || "audio/webm" }))
          rec.onerror = () => reject(new Error("recorder error"))
          rec.stop()
        })
        release()
        const audio = await blobToBase64(blob)
        const res = await transcribe({ audio, mime: blob.type })
        return res.text ?? ""
      } catch {
        release()
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
