# Phase 2 Chunk 5: Poly voice layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a voice modality to Poly's self-explanation checkpoint: Poly speaks its questions (TTS out) and the learner can answer by speaking (STT in), with the transcript feeding the exact same scorer/prober as typed text.

**Architecture:** Voice is a thin modality wrapper on the existing text checkpoint loop, not a rewrite. Two new Firebase callables (`polySpeak`, `polyTranscribe`) keep the OpenAI key server-side, mirroring the existing `polyScore`/`polyProbe` pattern (a pure core function plus an `onCall` wrapper). The browser captures/plays audio via `MediaRecorder` and `Audio`, but those browser-only bits live in an injectable `voice.ts` module so the component stays testable with fakes. Every voice path fails soft: any TTS, mic, or transcription failure silently falls back to the text loop, preserving the "works with AI off" guarantee.

**Tech Stack:** Firebase Cloud Functions v7 (`onCall`), OpenAI Node SDK v6 (`audio.speech.create`, `audio.transcriptions.create`, `toFile`), React 19, Vitest (node + jsdom projects), Testing Library.

---

## Context the engineer needs

Read these before starting; they are the patterns this plan extends:

- `functions/src/openai.ts` - the `Completer` interface + `openAICompleter(client)` factory. Voice adds `Speaker` and `Transcriber` the same way (an interface + a factory that wraps the real `OpenAI` client), so the callables can be unit-tested with a fake.
- `functions/src/openaiConfig.ts` - `OPENAI_API_KEY` secret + `resolveModel()` reading `process.env`. Voice adds parallel resolvers for the TTS/STT models and voice.
- `functions/src/poly/score.ts` and `functions/src/poly/probe.ts` - the canonical callable shape: an exported pure async core (`scoreExplanation(completer, model, args)`) plus an `onCall({ secrets: [OPENAI_API_KEY] }, ...)` wrapper that builds the real client, calls the core, and returns a safe fallback inside `catch`. Copy this shape exactly.
- `functions/src/openai.test.ts` - how the factories are tested with a hand-rolled fake client (`{ chat: { completions: { create } } }`). Voice tests use `{ audio: { speech: { create } } }` and `{ audio: { transcriptions: { create } } }`.
- `src/lib/ai/polyClient.ts` - `httpsCallable` wrappers (`scoreExplanation`, `requestProbe`). Voice adds `speak` and `transcribe` the same way.
- `src/lessons/stacksQueues/PolyCheckpoint.tsx` - the checkpoint UI. It already injects `scoreExplanation`, `requestProbe`, `saveExplanation` with real defaults so tests pass fakes. Voice follows that convention with `speakText` and `createRecorder` injectables plus a `voice` flag.
- `src/lessons/stacksQueues/PolyCheckpoint.test.tsx` - the `deps()` helper + Testing Library style the voice tests must match.
- `src/lessons/stacksQueues/Stage.tsx:48-75` - where the live lesson renders `PolyCheckpoint` at the two concept boundaries.
- `src/screens/PolyLab.tsx:419-493` - the demo `CheckpointPanel` (mock vs live modes); voice gets a toggle here so it can be demoed without a key.
- `vitest.config.ts` - two projects: `node` (`src/**/*.test.ts`) and `dom` (`src/**/*.test.tsx`, jsdom, setup `src/test/setup.ts`).

### Key facts about the OpenAI audio APIs (SDK v6)

TTS (returns an HTTP response whose bytes are the audio):

```javascript
const res = await client.audio.speech.create({
  model: "gpt-4o-mini-tts",
  voice: "alloy",
  input: "text to speak",
  instructions: "Speak warmly and encouragingly.", // steerable on gpt-4o-mini-tts
})
const buffer = Buffer.from(await res.arrayBuffer()) // default format is mp3 (audio/mpeg)
```

STT (accepts a `File`; for an in-memory buffer use the SDK's `toFile` helper):

```javascript
import OpenAI, { toFile } from "openai"
const file = await toFile(buffer, "speech.webm")
const res = await client.audio.transcriptions.create({ file, model: "gpt-4o-mini-transcribe" })
res.text // the transcript
```

### Transport decision (read once)

Audio crosses the callable boundary as base64 strings inside the normal JSON payload (no new transport, no signed URLs). Poly lines and short spoken answers are tens to hundreds of KB, well under the callable size limit. This keeps voice on the same "callable is the only AI seam" rule as the rest of Phase 2. The OpenAI Realtime (speech-to-speech) API is explicitly out of scope: the spec says voice feeds "the same scorer as typed text", which requires discrete transcribe-then-score, not a streamed audio dialog.

### What this plan does NOT change

- The scorer (`polyScore`) and prober (`polyProbe`) are untouched. Voice only changes how the question reaches the learner (spoken) and how the answer reaches `submit()` (transcribed into the same `answer` string).
- Storage is unchanged: a transcribed answer is stored as the same raw `explanation` text via the existing `saveExplanation` path. No audio is persisted.
- Mastery gating is untouched. Voice is non-gating, same as the rest of Poly.

---

## File structure

Created:
- `functions/src/poly/speak.ts` - `synthesizeSpeech` core + `polySpeak` callable.
- `functions/src/poly/speak.test.ts`
- `functions/src/poly/transcribe.ts` - `transcribeAudio` core + `polyTranscribe` callable.
- `functions/src/poly/transcribe.test.ts`
- `functions/src/openaiConfig.test.ts` - covers the new resolvers (and the existing `resolveModel`).
- `src/lib/ai/voice.ts` - browser glue: `speakText` (fetch TTS + play) and `createRecorder` (mic + transcribe), plus pure base64 helpers.
- `src/lib/ai/voice.test.ts` - pure helper round-trip tests.

Modified:
- `functions/src/openai.ts` - add `Speaker`/`Transcriber` interfaces + `openAISpeaker`/`openAITranscriber` factories.
- `functions/src/openai.test.ts` - add factory tests.
- `functions/src/openaiConfig.ts` - add TTS/STT model + voice constants and resolvers.
- `functions/src/index.ts` - export `polySpeak`, `polyTranscribe`.
- `src/lib/ai/polyClient.ts` - add `speak`/`transcribe` wrappers + types.
- `src/lessons/stacksQueues/PolyCheckpoint.tsx` - add voice affordances (props, auto-speak, mic record).
- `src/lessons/stacksQueues/PolyCheckpoint.test.tsx` - add voice behavior tests.
- `src/lessons/stacksQueues/Stage.tsx` - turn voice on for the live S&Q checkpoints (behind a constant).
- `src/screens/PolyLab.tsx` - add a voice toggle to the checkpoint demo (mock fakes + live).
- `docs/architecture.md` - one-line note that the AI seam now includes audio callables.

---

## Task 1: Audio config resolvers

**Files:**
- Modify: `functions/src/openaiConfig.ts`
- Test: `functions/src/openaiConfig.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// functions/src/openaiConfig.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd functions && npx vitest run src/openaiConfig.test.ts`
Expected: FAIL ("resolveTtsModel is not a function" / missing exports).

- [ ] **Step 3: Add the constants and resolvers**

Append to `functions/src/openaiConfig.ts` (keep the existing `OPENAI_API_KEY`, `DEFAULT_MODEL`, `resolveModel`):

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd functions && npx vitest run src/openaiConfig.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/src/openaiConfig.ts functions/src/openaiConfig.test.ts
git commit -m "feat(functions): add TTS/STT model + voice config resolvers"
```

---

## Task 2: Speaker and Transcriber factories

**Files:**
- Modify: `functions/src/openai.ts`
- Test: `functions/src/openai.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `functions/src/openai.test.ts`:

```ts
import { openAISpeaker, openAITranscriber } from "./openai"

describe("openAISpeaker", () => {
  it("calls audio.speech.create and returns the bytes as a Buffer", async () => {
    const create = vi.fn().mockResolvedValue({
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    })
    const speaker = openAISpeaker({ audio: { speech: { create } } } as never)

    const out = await speaker.speak({
      text: "hi",
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      instructions: "Speak warmly.",
    })

    expect(create).toHaveBeenCalledWith({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: "hi",
      instructions: "Speak warmly.",
    })
    expect(Buffer.isBuffer(out)).toBe(true)
    expect([...out]).toEqual([1, 2, 3])
  })
})

describe("openAITranscriber", () => {
  it("sends a file built from the buffer and returns the transcript text", async () => {
    const create = vi.fn().mockResolvedValue({ text: " hello world " })
    const transcriber = openAITranscriber({
      audio: { transcriptions: { create } },
    } as never)

    const out = await transcriber.transcribe({
      audio: Buffer.from([4, 5, 6]),
      filename: "speech.webm",
      model: "gpt-4o-mini-transcribe",
    })

    expect(create).toHaveBeenCalledTimes(1)
    const arg = create.mock.calls[0][0]
    expect(arg.model).toBe("gpt-4o-mini-transcribe")
    expect(arg.file).toBeDefined()
    expect(out).toBe(" hello world ")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd functions && npx vitest run src/openai.test.ts`
Expected: FAIL ("openAISpeaker is not a function").

- [ ] **Step 3: Add the interfaces and factories**

In `functions/src/openai.ts`, change the import line and append the new exports:

```ts
import OpenAI, { toFile } from "openai"
```

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd functions && npx vitest run src/openai.test.ts`
Expected: PASS (existing completer tests + 2 new).

- [ ] **Step 5: Commit**

```bash
git add functions/src/openai.ts functions/src/openai.test.ts
git commit -m "feat(functions): add Speaker and Transcriber OpenAI factories"
```

---

## Task 3: polySpeak callable (TTS)

**Files:**
- Create: `functions/src/poly/speak.ts`
- Test: `functions/src/poly/speak.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// functions/src/poly/speak.test.ts
import { describe, expect, it, vi } from "vitest"
import { synthesizeSpeech } from "./speak"
import type { Speaker } from "../openai"

function fakeSpeaker(bytes: number[]): Speaker {
  return { speak: vi.fn().mockResolvedValue(Buffer.from(bytes)) }
}

describe("synthesizeSpeech", () => {
  it("returns base64 audio + mime for non-empty text", async () => {
    const speaker = fakeSpeaker([1, 2, 3])
    const out = await synthesizeSpeech(speaker, "m", "alloy", { text: "hello" })
    expect(out).toEqual({ audio: Buffer.from([1, 2, 3]).toString("base64"), mime: "audio/mpeg" })
  })

  it("returns nulls and does not call the speaker for empty text", async () => {
    const speaker = fakeSpeaker([1])
    const out = await synthesizeSpeech(speaker, "m", "alloy", { text: "   " })
    expect(out).toEqual({ audio: null, mime: null })
    expect(speaker.speak).not.toHaveBeenCalled()
  })

  it("truncates very long text before synthesizing", async () => {
    const speaker = fakeSpeaker([9])
    await synthesizeSpeech(speaker, "m", "alloy", { text: "x".repeat(5000) })
    const arg = (speaker.speak as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(arg.text.length).toBeLessThanOrEqual(600)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd functions && npx vitest run src/poly/speak.test.ts`
Expected: FAIL ("Cannot find module './speak'").

- [ ] **Step 3: Write the implementation**

```ts
// functions/src/poly/speak.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd functions && npx vitest run src/poly/speak.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/src/poly/speak.ts functions/src/poly/speak.test.ts
git commit -m "feat(functions): add polySpeak TTS callable"
```

---

## Task 4: polyTranscribe callable (STT)

**Files:**
- Create: `functions/src/poly/transcribe.ts`
- Test: `functions/src/poly/transcribe.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// functions/src/poly/transcribe.test.ts
import { describe, expect, it, vi } from "vitest"
import { transcribeAudio } from "./transcribe"
import type { Transcriber } from "../openai"

function fakeTranscriber(text: string): Transcriber {
  return { transcribe: vi.fn().mockResolvedValue(text) }
}

const b64 = (bytes: number[]) => Buffer.from(bytes).toString("base64")

describe("transcribeAudio", () => {
  it("decodes base64 audio, derives a filename from the mime, and returns trimmed text", async () => {
    const t = fakeTranscriber("  spoken answer  ")
    const out = await transcribeAudio(t, "m", { audio: b64([1, 2, 3]), mime: "audio/webm;codecs=opus" })
    expect(out).toEqual({ text: "spoken answer" })
    const arg = (t.transcribe as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(arg.filename).toBe("speech.webm")
    expect(arg.model).toBe("m")
  })

  it("returns null text for empty audio without calling the transcriber", async () => {
    const t = fakeTranscriber("x")
    const out = await transcribeAudio(t, "m", { audio: "", mime: "audio/webm" })
    expect(out).toEqual({ text: null })
    expect(t.transcribe).not.toHaveBeenCalled()
  })

  it("rejects oversized audio without calling the transcriber", async () => {
    const t = fakeTranscriber("x")
    const huge = "A".repeat(12 * 1024 * 1024) // > 8MB decoded
    const out = await transcribeAudio(t, "m", { audio: huge, mime: "audio/webm" })
    expect(out).toEqual({ text: null })
    expect(t.transcribe).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd functions && npx vitest run src/poly/transcribe.test.ts`
Expected: FAIL ("Cannot find module './transcribe'").

- [ ] **Step 3: Write the implementation**

```ts
// functions/src/poly/transcribe.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd functions && npx vitest run src/poly/transcribe.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/src/poly/transcribe.ts functions/src/poly/transcribe.test.ts
git commit -m "feat(functions): add polyTranscribe STT callable"
```

---

## Task 5: Export the callables and verify the build

**Files:**
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Add the exports**

Replace `functions/src/index.ts` with:

```ts
export { polyHealthCheck } from "./healthCheck"
export { polyHint } from "./poly/hint"
export { polyScore } from "./poly/score"
export { polyProbe } from "./poly/probe"
export { polySpeak } from "./poly/speak"
export { polyTranscribe } from "./poly/transcribe"
```

- [ ] **Step 2: Build and test the whole functions workspace**

Run: `npm --prefix functions run build && npm --prefix functions test`
Expected: `tsc` succeeds with no errors; all functions tests PASS.

- [ ] **Step 3: Commit**

```bash
git add functions/src/index.ts
git commit -m "feat(functions): export polySpeak and polyTranscribe"
```

---

## Task 6: Client callable wrappers

**Files:**
- Modify: `src/lib/ai/polyClient.ts`
- Test: `src/lib/ai/polyClient.test.ts` (extend)

The existing test uses one hoisted `mockCallable` (returned for every `httpsCallable(...)`), sets `mockCallable.mockResolvedValue({ data })` per test, and asserts the callable name passed to `httpsCallable`. Match that style exactly.

- [ ] **Step 1: Write the failing test**

Add this `describe` block to `src/lib/ai/polyClient.test.ts` (it reuses the file's existing `mockCallable` hoist and `firebase/functions` mock):

```ts
describe("voice client helpers", () => {
  beforeEach(() => mockCallable.mockReset())

  it("speak calls polySpeak and returns its data", async () => {
    const { speak } = await import("./polyClient")
    const { httpsCallable } = await import("firebase/functions")
    mockCallable.mockResolvedValue({ data: { audio: "QUJD", mime: "audio/mpeg" } })
    const res = await speak({ text: "hello" })
    expect(res).toEqual({ audio: "QUJD", mime: "audio/mpeg" })
    expect(vi.mocked(httpsCallable)).toHaveBeenCalledWith(expect.anything(), "polySpeak")
  })

  it("transcribe calls polyTranscribe and returns its data", async () => {
    const { transcribe } = await import("./polyClient")
    const { httpsCallable } = await import("firebase/functions")
    mockCallable.mockResolvedValue({ data: { text: "spoken" } })
    const res = await transcribe({ audio: "QUJD", mime: "audio/webm" })
    expect(res).toEqual({ text: "spoken" })
    expect(vi.mocked(httpsCallable)).toHaveBeenCalledWith(expect.anything(), "polyTranscribe")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/polyClient.test.ts`
Expected: FAIL ("speak is not exported" / undefined).

- [ ] **Step 3: Add the wrappers and types**

Append to `src/lib/ai/polyClient.ts`:

```ts
export interface SpeakRequest {
  text: string
}
export interface SpeakResponse {
  audio: string | null
  mime: string | null
}
export interface TranscribeRequest {
  audio: string
  mime: string
}
export interface TranscribeResponse {
  text: string | null
}

export async function speak(req: SpeakRequest): Promise<SpeakResponse> {
  const callable = httpsCallable<SpeakRequest, SpeakResponse>(functions, "polySpeak")
  const res = await callable(req)
  return res.data
}

export async function transcribe(req: TranscribeRequest): Promise<TranscribeResponse> {
  const callable = httpsCallable<TranscribeRequest, TranscribeResponse>(
    functions,
    "polyTranscribe",
  )
  const res = await callable(req)
  return res.data
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/polyClient.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/polyClient.ts src/lib/ai/polyClient.test.ts
git commit -m "feat: add speak/transcribe client wrappers for Poly voice"
```

---

## Task 7: Browser voice module (speakText + createRecorder)

**Files:**
- Create: `src/lib/ai/voice.ts`
- Test: `src/lib/ai/voice.test.ts`

This module isolates the browser-only APIs (`Audio`, `URL`, `MediaRecorder`, `getUserMedia`) so the component can be tested with fakes. Only the pure base64 helpers are unit-tested here; the `Audio`/`MediaRecorder` glue is exercised through the component (Task 8) via injection and through the demo (Task 9).

- [ ] **Step 1: Write the failing test (pure helpers only)**

```ts
// src/lib/ai/voice.test.ts
import { describe, expect, it } from "vitest"
import { base64ToBlob } from "./voice"

describe("base64ToBlob", () => {
  it("decodes base64 into a Blob of the right size and type", () => {
    // base64 "QUJD" === bytes [65,66,67] === "ABC"
    const blob = base64ToBlob("QUJD", "audio/mpeg")
    expect(blob.size).toBe(3)
    expect(blob.type).toBe("audio/mpeg")
  })
})
```

(Note: `Blob` and `atob` exist in jsdom, so this `.test.ts` still runs under the node project only if Blob is available; place it as `voice.test.ts` and run via the node project. If the node env lacks `Blob`/`atob`, rename to `voice.test.tsx` so it runs under jsdom. Verify in Step 2 and pick the extension that runs green.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/voice.test.ts`
Expected: FAIL ("Cannot find module './voice'"). If it errors with "Blob is not defined", rename the test to `src/lib/ai/voice.test.tsx` and rerun; expect the module-not-found failure.

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/voice.test.ts` (or `.test.tsx` if renamed)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/voice.ts src/lib/ai/voice.test.ts
git commit -m "feat: add browser voice module (speakText + mic recorder)"
```

---

## Task 8: Voice affordances in PolyCheckpoint

**Files:**
- Modify: `src/lessons/stacksQueues/PolyCheckpoint.tsx`
- Test: `src/lessons/stacksQueues/PolyCheckpoint.test.tsx`

Behavior added (only active when `voice` is true; default false keeps the text loop byte-for-byte identical):
- When a new question is shown (phase `asking`), Poly speaks it via `speakText`. A speaker button replays it.
- A mic button records the answer; on stop, the transcript fills the existing `answer` textarea. The learner reviews and taps Submit (one code path into `submit()`). The textarea stays visible and editable, so a bad transcription is fixable and the feature stays accessible.
- If `start()` throws (mic denied) or transcription returns "", show a small "Voice unavailable, type instead" note and leave the text path working.

- [ ] **Step 1: Write the failing tests**

Add to `src/lessons/stacksQueues/PolyCheckpoint.test.tsx`. Extend `deps()` to allow the new injectables, and add three tests:

```ts
import { vi } from "vitest"

// A fake recorder whose stop() yields a canned transcript.
function fakeRecorder(transcript: string) {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(transcript),
    cancel: vi.fn(),
  }
}

it("speaks the question when voice is enabled", async () => {
  const speakText = vi.fn().mockResolvedValue(undefined)
  const props = deps({ voice: true, speakText, createRecorder: () => fakeRecorder("") })
  render(<PolyCheckpoint {...props} />)
  await waitFor(() => expect(speakText).toHaveBeenCalledWith("In your own words, explain stacks."))
})

it("records speech, fills the transcript into the answer, and scores it", async () => {
  const rec = fakeRecorder("last in first out")
  const props = deps({
    voice: true,
    speakText: vi.fn().mockResolvedValue(undefined),
    createRecorder: () => rec,
  })
  render(<PolyCheckpoint {...props} />)
  await userEvent.click(screen.getByRole("button", { name: /record|speak your answer|mic/i }))
  await userEvent.click(screen.getByRole("button", { name: /stop/i }))
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: /your explanation/i })).toHaveValue(
      "last in first out",
    ),
  )
  await userEvent.click(screen.getByRole("button", { name: /submit/i }))
  await waitFor(() => expect(props.scoreExplanation).toHaveBeenCalled())
})

it("shows a fallback note and keeps typing when the mic is denied", async () => {
  const rec = {
    start: vi.fn().mockRejectedValue(new Error("denied")),
    stop: vi.fn(),
    cancel: vi.fn(),
  }
  const props = deps({
    voice: true,
    speakText: vi.fn().mockResolvedValue(undefined),
    createRecorder: () => rec,
  })
  render(<PolyCheckpoint {...props} />)
  await userEvent.click(screen.getByRole("button", { name: /record|speak your answer|mic/i }))
  await waitFor(() => expect(screen.getByText(/type instead/i)).toBeInTheDocument())
  expect(screen.getByRole("textbox", { name: /your explanation/i })).toBeEnabled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lessons/stacksQueues/PolyCheckpoint.test.tsx`
Expected: FAIL (no mic/record button; `voice`/`speakText`/`createRecorder` props not accepted).

- [ ] **Step 3: Implement the voice affordances**

In `src/lessons/stacksQueues/PolyCheckpoint.tsx`:

(a) Add imports:

```ts
import { useEffect, useRef, useState } from "react"
import { Sparkles, Mic, Square, Volume2 } from "lucide-react"
import { speakText as defaultSpeakText, createRecorder as defaultCreateRecorder, type VoiceRecorder } from "@/lib/ai/voice"
```

(b) Extend `PolyCheckpointProps`:

```ts
  voice?: boolean
  speakText?: (text: string) => Promise<void>
  createRecorder?: () => VoiceRecorder
```

(c) Add to the destructured params (with defaults):

```ts
  voice = false,
  speakText = defaultSpeakText,
  createRecorder = defaultCreateRecorder,
```

(d) Add local state + a recorder ref near the other `useState` calls:

```ts
  const [recording, setRecording] = useState(false)
  const [voiceError, setVoiceError] = useState(false)
  const recorderRef = useRef<VoiceRecorder | null>(null)
```

(e) Speak the question when voice is on and we are asking. Add after the state:

```ts
  useEffect(() => {
    if (!voice || phase !== "asking") return
    void speakText(question)
    // Re-speak only when the question text changes (new probe / first ask).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, voice])
```

(f) Add the record handlers:

```ts
  async function startRecording() {
    setVoiceError(false)
    const rec = createRecorder()
    recorderRef.current = rec
    try {
      await rec.start()
      setRecording(true)
    } catch {
      recorderRef.current = null
      setVoiceError(true)
    }
  }

  async function stopRecording() {
    const rec = recorderRef.current
    recorderRef.current = null
    setRecording(false)
    if (!rec) return
    const text = await rec.stop()
    if (text) setAnswer(text)
    else setVoiceError(true)
  }
```

(g) In the `asking`/`thinking` branch (the `<>` block with the textarea), add a replay-audio button by the question and a mic control above Submit. Insert this row directly above the `<Button ... Submit>`:

```tsx
            {voice && (
              <div className="mb-3 flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="default"
                  disabled={phase === "thinking"}
                  onClick={recording ? stopRecording : startRecording}
                >
                  {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
                  {recording ? "Stop" : "Speak your answer"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  aria-label="Replay question"
                  disabled={phase === "thinking"}
                  onClick={() => void speakText(question)}
                >
                  <Volume2 className="size-4" />
                </Button>
              </div>
            )}
            {voice && voiceError && (
              <p className="mb-3 text-center text-xs text-muted-foreground">
                Voice unavailable, type instead.
              </p>
            )}
```

Keep the existing textarea and Submit button exactly as they are (the transcript flows into `answer`, then `submit()` runs unchanged).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lessons/stacksQueues/PolyCheckpoint.test.tsx`
Expected: PASS (the original 4 text tests stay green plus the 3 new voice tests).

- [ ] **Step 5: Commit**

```bash
git add src/lessons/stacksQueues/PolyCheckpoint.tsx src/lessons/stacksQueues/PolyCheckpoint.test.tsx
git commit -m "feat: add voice (TTS question + spoken answer) to PolyCheckpoint"
```

---

## Task 9: Wire voice into the live lesson and the demo

**Files:**
- Modify: `src/lessons/stacksQueues/Stage.tsx`
- Modify: `src/screens/PolyLab.tsx`

- [ ] **Step 1: Turn voice on for the live S&Q checkpoints**

In `src/lessons/stacksQueues/Stage.tsx`, add a constant near `CHECKPOINTS` and pass it through. Voice fails soft, so enabling it cannot break the lesson:

```ts
// Poly voice on the S&Q checkpoints (the Friday demo target). Fails soft to the
// text loop if TTS, the mic, or transcription is unavailable.
const CHECKPOINT_VOICE = true
```

Then in the `due` render, add the prop:

```tsx
      <PolyCheckpoint
        conceptId={due.conceptId}
        conceptName={due.conceptName}
        uid={user?.uid ?? null}
        voice={CHECKPOINT_VOICE}
        onDone={() => setDoneCheckpoints((prev) => [...prev, due.id])}
      />
```

Run the existing Stage tests to confirm no regression (the `PolyCheckpoint` mock in `Stage.test.tsx` ignores extra props):

Run: `npx vitest run src/lessons/stacksQueues/Stage.test.tsx src/lessons/stacksQueues/Stage.checkpoint.test.tsx`
Expected: PASS.

- [ ] **Step 2: Add a voice toggle to the demo checkpoint panel**

In `src/screens/PolyLab.tsx` `CheckpointPanel`, add a `voice` toggle. In mock mode inject fakes so the flow works with no key; in live mode use the real defaults.

Add near the other state in `CheckpointPanel`:

```tsx
  const [voice, setVoice] = useState(false)
```

Build mock voice deps (place beside the existing `injected`):

```tsx
  const mockVoice =
    mode === "mock"
      ? {
          speakText: async () => {},
          createRecorder: () => ({
            start: async () => {},
            stop: async () =>
              concept === "stack" ? "last in first out, only the top" : "first in first out",
            cancel: () => {},
          }),
        }
      : {}
```

Add a toggle button in the controls row (next to Replay):

```tsx
        <Button
          variant={voice ? "tactile" : "secondary"}
          size="default"
          onClick={() => setVoice((v) => !v)}
        >
          {voice ? "Voice on" : "Voice off"}
        </Button>
```

Pass voice into the rendered checkpoint:

```tsx
          <PolyCheckpoint
            key={`${conceptId}-${mode}-${runId}-${voice ? "v" : "t"}`}
            conceptId={conceptId}
            conceptName={conceptName}
            uid={uid}
            voice={voice}
            onDone={() => setCompleted(true)}
            {...injected}
            {...mockVoice}
          />
```

(The `voice` key segment forces a clean remount when toggling, matching how `mode`/`runId` already re-key the demo.)

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc -b && npm run lint`
Expected: no type errors; lint clean. (The demo `mockVoice` useMemo/closure may need an `eslint-disable-next-line react-hooks/exhaustive-deps` only if you wrap it in `useMemo`; as a plain object it does not.)

- [ ] **Step 4: Commit**

```bash
git add src/lessons/stacksQueues/Stage.tsx src/screens/PolyLab.tsx
git commit -m "feat: enable Poly voice on S&Q checkpoints + demo toggle"
```

---

## Task 10: Docs note

**Files:**
- Modify: `docs/architecture.md`

- [ ] **Step 1: Add the audio seam to the AI section**

Find the section that describes the callable AI seam (added in earlier Phase 2 chunks) and add one line noting the audio callables. Example addition:

```markdown
- **Poly voice (Chunk 5):** two more callables, `polySpeak` (OpenAI TTS, returns
  base64 mp3) and `polyTranscribe` (OpenAI STT from base64 audio), let Poly speak
  its checkpoint questions and accept spoken answers. The transcript feeds the
  same scorer as typed text; the OpenAI key stays server-side (same secret). All
  voice paths fall back to the text loop on any failure.
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: note the Poly voice audio callables in the architecture"
```

---

## Task 11: Full verification before PR

- [ ] **Step 1: Functions build + tests**

Run: `npm --prefix functions run build && npm --prefix functions test`
Expected: build clean; all functions tests PASS.

- [ ] **Step 2: Root typecheck, lint, unit/component tests**

Run: `npx tsc -b && npm run lint && npm test`
Expected: no type errors; lint clean; all tests PASS (node + dom projects), including the new voice tests and the unchanged text-loop tests.

- [ ] **Step 3: Manual smoke in the gallery (voice demo)**

Run the gallery, open Poly AI, go to the checkpoint panel, flip "Voice on" in mock mode. Confirm: the speaker control appears, "Speak your answer" -> "Stop" fills the transcript into the textarea, Submit scores it, the dots render, and a probe/affirm follows. Then flip mock -> live only if the emulator + a real key are configured.

- [ ] **Step 4: Confirm the AI-off guarantee**

In the demo, leave Voice off and confirm the text loop is unchanged. In voice mode, simulate failure (mock recorder `start` rejecting, or `stop` returning "") and confirm the "type instead" note appears and typing still works.

---

## Manual setup notes (one-time, outside the code)

- No new secret. `OPENAI_API_KEY` already covers audio. Optional env overrides (set in `functions/.env` for the emulator or as deploy env vars): `OPENAI_TTS_MODEL`, `OPENAI_STT_MODEL`, `OPENAI_TTS_VOICE`.
- Voices to try for the warm Poly persona: `alloy` (default, neutral), `coral` (bright), `sage` (calm). Swap via `OPENAI_TTS_VOICE`; tone is also shaped by the `instructions` string in `speak.ts`.
- Mic capture needs `localhost` or HTTPS (dev is `localhost`, fine) and a one-time browser permission prompt. Browser autoplay policy may block the first spoken question until a user gesture; the replay speaker button covers that case.

---

## Out of scope (do not build here)

- OpenAI Realtime / speech-to-speech streaming. The spec requires the transcript to feed the same scorer, which is discrete STT, not a streamed audio dialog.
- Voice on the hint flow (`usePolyHint`). The spec scopes voice to Poly checkpoints; hints stay text.
- Persisting audio. Only the transcript is stored, via the existing `saveExplanation` text path.
- Personalization (analogy-mode hints, etc.). Phase 3.
- E2E (Playwright) coverage of mic capture. Driving a real microphone in CI is out of scope; voice is verified by the component tests (injected fakes) plus the gallery demo.

---

## Self-review checklist (run before handing off)

1. **Spec coverage:** TTS out (Tasks 2, 3, 7), STT in (Tasks 2, 4, 7), one provider/one key (Tasks 1, 3, 4 reuse `OPENAI_API_KEY`), transcript feeds the same scorer (Task 7 routes into the unchanged `submit()`), fails soft / works AI-off (Tasks 7, 9; Task 11 Step 4). All covered.
2. **Placeholder scan:** no TBD/TODO; every code step has full code.
3. **Type consistency:** `Speaker`/`Transcriber` (Task 2) are consumed by `synthesizeSpeech`/`transcribeAudio` (Tasks 3, 4); `SpeakResponse`/`TranscribeResponse` (Task 6) are consumed by `voice.ts` (Task 7) and the component (Task 8); `VoiceRecorder` (Task 7) is the type injected in Task 8 and faked in its tests. Names line up across tasks.
