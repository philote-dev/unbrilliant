import type { RealtimeTokenResponse } from "@/lib/ai/polyClient"

/**
 * Realtime transcription over WebRTC. The browser streams mic audio straight to
 * OpenAI using a short-lived ephemeral token minted by our server, and receives
 * incremental transcript events on a data channel. The pure reducer below folds
 * those events into display text; the WebRTC glue is browser-only and exercised
 * through the demo and via component injection (not unit-tested).
 */

const DELTA = "conversation.item.input_audio_transcription.delta"
const COMPLETED = "conversation.item.input_audio_transcription.completed"

export interface RealtimeEvent {
  type: string
  item_id?: string
  delta?: string
  transcript?: string
}

export interface TranscriptState {
  order: string[]
  interim: Record<string, string>
  final: Record<string, string>
}

export const emptyTranscript: TranscriptState = { order: [], interim: {}, final: {} }

/**
 * Fold one realtime event into transcript state. Deltas append within an item
 * without inserting spaces (per the API contract); `completed` promotes that
 * item's text to final. Pure and order-preserving.
 */
export function accumulateTranscript(
  state: TranscriptState,
  event: RealtimeEvent,
): TranscriptState {
  if (event.type !== DELTA && event.type !== COMPLETED) return state
  const id = event.item_id ?? "default"
  const order = state.order.includes(id) ? state.order : [...state.order, id]

  if (event.type === DELTA) {
    return {
      order,
      final: state.final,
      interim: { ...state.interim, [id]: (state.interim[id] ?? "") + (event.delta ?? "") },
    }
  }

  const transcript = event.transcript ?? state.interim[id] ?? ""
  const interim = { ...state.interim }
  delete interim[id]
  return { order, interim, final: { ...state.final, [id]: transcript } }
}

export function transcriptText(state: TranscriptState): {
  finalText: string
  interimText: string
} {
  const finalText = state.order.map((id) => state.final[id]).filter(Boolean).join(" ")
  const interimText = state.order.map((id) => state.interim[id]).filter(Boolean).join(" ")
  return { finalText, interimText }
}

export function fullTranscript(state: TranscriptState): string {
  const { finalText, interimText } = transcriptText(state)
  return [finalText, interimText].filter(Boolean).join(" ").trim()
}

export interface RealtimeTranscriber {
  start(): Promise<void>
  stop(): void
}

export interface RealtimeTranscriberOptions {
  onUpdate(text: { finalText: string; interimText: string }): void
  onError?(err: unknown): void
  getToken: () => Promise<RealtimeTokenResponse>
}

const OPENAI_REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls"

/**
 * Live mic transcription via OpenAI Realtime over WebRTC. `start()` mints a
 * token, opens the peer connection, and streams the mic; transcript updates
 * arrive through `onUpdate`. `start()` throws on mic denial or a token failure
 * so the caller can fall back to typing. `stop()` tears everything down and is
 * idempotent. Browser-only; not unit-tested (see the reducer above).
 */
export function createRealtimeTranscriber(
  opts: RealtimeTranscriberOptions,
): RealtimeTranscriber {
  const getToken = opts.getToken
  let pc: RTCPeerConnection | null = null
  let stream: MediaStream | null = null
  let state: TranscriptState = emptyTranscript

  const teardown = () => {
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
    try {
      pc?.close()
    } catch {
      // ignore
    }
    pc = null
  }

  return {
    async start() {
      const session = await getToken()
      if (!session.token) throw new Error("no realtime token")

      // Echo cancellation + noise suppression keep Poly's own spoken question
      // (playing through the speakers) out of the transcript when the learner is
      // not on headphones.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      const connection = new RTCPeerConnection()
      pc = connection

      const channel = connection.createDataChannel("oai-events")
      channel.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data as string) as RealtimeEvent
          state = accumulateTranscript(state, event)
          opts.onUpdate(transcriptText(state))
        } catch {
          // ignore non-JSON keepalives
        }
      }

      for (const track of stream.getAudioTracks()) {
        connection.addTrack(track, stream)
      }

      const offer = await connection.createOffer()
      await connection.setLocalDescription(offer)

      const answer = await fetch(OPENAI_REALTIME_CALLS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp ?? "",
      })
      if (!answer.ok) {
        teardown()
        throw new Error(`realtime connect failed: ${answer.status}`)
      }
      await connection.setRemoteDescription({ type: "answer", sdp: await answer.text() })
    },
    stop() {
      teardown()
    },
  }
}
