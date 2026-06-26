import { describe, it, expect } from "vitest"
import {
  accumulateTranscript,
  emptyTranscript,
  fullTranscript,
  transcriptText,
} from "./realtimeTranscriber"

const delta = (itemId: string, text: string) => ({
  type: "conversation.item.input_audio_transcription.delta",
  item_id: itemId,
  delta: text,
})
const completed = (itemId: string, transcript: string) => ({
  type: "conversation.item.input_audio_transcription.completed",
  item_id: itemId,
  transcript,
})

describe("accumulateTranscript", () => {
  it("appends deltas within an item without inserting spaces", () => {
    let s = emptyTranscript
    s = accumulateTranscript(s, delta("a", "Hel"))
    s = accumulateTranscript(s, delta("a", "lo"))
    expect(transcriptText(s).interimText).toBe("Hello")
    expect(transcriptText(s).finalText).toBe("")
  })

  it("promotes an item to final on completed and clears its interim", () => {
    let s = emptyTranscript
    s = accumulateTranscript(s, delta("a", "Hi"))
    s = accumulateTranscript(s, completed("a", "Hi there"))
    expect(transcriptText(s).finalText).toBe("Hi there")
    expect(transcriptText(s).interimText).toBe("")
    expect(fullTranscript(s)).toBe("Hi there")
  })

  it("joins multiple segments with a space, final before interim", () => {
    let s = emptyTranscript
    s = accumulateTranscript(s, completed("a", "first"))
    s = accumulateTranscript(s, delta("b", "second"))
    expect(transcriptText(s).finalText).toBe("first")
    expect(transcriptText(s).interimText).toBe("second")
    expect(fullTranscript(s)).toBe("first second")
  })

  it("falls back to accumulated deltas when completed has no transcript", () => {
    let s = emptyTranscript
    s = accumulateTranscript(s, delta("a", "partial"))
    s = accumulateTranscript(s, {
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "a",
    })
    expect(transcriptText(s).finalText).toBe("partial")
  })

  it("ignores unrelated events", () => {
    const s = accumulateTranscript(emptyTranscript, { type: "some.other.event" })
    expect(s).toEqual(emptyTranscript)
  })
})
