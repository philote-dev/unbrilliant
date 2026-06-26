# Poly live voice (Realtime) + guardrail tuning Plan

**Goal:** Turn the Poly self-explanation checkpoint into a seamless spoken conversation: Poly speaks the question, the mic opens on its own, the learner's words appear live as they talk (streaming transcription), and a single "Done" sends the answer. Typing stays available as a pull-up keyboard sheet. Tighten the response guardrails while we are in here.

**Decisions locked (from the Jun 26 grilling):**
- Live transcription engine: OpenAI Realtime API (stay 100% OpenAI). The browser streams mic audio over WebRTC using a short-lived token minted server-side; the real key never reaches the client.
- Send model: words stream live, the learner taps "Done" to send (never auto-sends on a pause).
- Keyboard is secondary: a grabber pill at the bottom ("Type instead"); drag up or tap to switch to typing; a way back to voice.
- Auto-listen sequencing: Poly speaks first (mic off), the mic opens the instant TTS playback ends (no self-capture).
- Guardrails: tighten, do not rebuild (scoring more generous to analogies, probes warmer and more specific, verifier a touch stricter).

**Tech stack:** Firebase callable (`onCall`) to mint the ephemeral token, OpenAI Realtime transcription (`gpt-4o-transcribe`, server VAD), browser WebRTC (`RTCPeerConnection` + `oai-events` data channel), React 19, `motion` (already a dep) for the orb + bottom-sheet drag, Vitest.

---

## Architecture

```
Browser (PolyCheckpoint)
  1. tap into checkpoint -> Poly speaks (existing polySpeak TTS)
  2. on TTS end -> request ephemeral token  --callable-->  polyRealtimeToken (Cloud Function)
                                                              mints POST /v1/realtime/transcription_sessions
                                                              with server-side OPENAI_API_KEY -> client_secret
  3. browser opens WebRTC to OpenAI realtime with the ephemeral token
       - mic audio track  -> OpenAI
       - data channel "oai-events" <- conversation.item.input_audio_transcription.delta / .completed
  4. live captions render from deltas; "Done" stops the session
  5. accumulated transcript -> existing polyScore / polyProbe (unchanged) -> dots + spoken affirm/probe
```

Security: identical posture to the rest of the seam. The OpenAI key stays a Functions secret. The browser only ever holds a short-lived `client_secret` (expires in ~1 min, transcription-scoped). No raw key in the bundle.

Realtime specifics (verified against current docs, reconfirm exact endpoints during impl):
- Mint: `POST https://api.openai.com/v1/realtime/transcription_sessions` with body `{ input_audio_transcription: { model: "gpt-4o-transcribe" }, turn_detection: { type: "server_vad" } }` and `Authorization: Bearer <OPENAI_API_KEY>`. Response includes `client_secret: { value, expires_at }`.
- Connect (browser): create `RTCPeerConnection`, `createDataChannel("oai-events")`, add the mic track, `createOffer()`, POST the offer SDP to the realtime calls endpoint with `Authorization: Bearer <client_secret.value>` and `Content-Type: application/sdp`, set the SDP answer.
- Events: `conversation.item.input_audio_transcription.delta` (append-only text fragments; do not insert spaces unconditionally) and `conversation.item.input_audio_transcription.completed` (final per segment). `gpt-4o-transcribe` streams real deltas; `whisper-1` would not.

---

## Experience and design (works within Willow's existing language)

No new visual identity: reuse Willow's dark surface, lilac accent (`bg-lilac-soft` / `text-lilac-strong`), Geist type, tactile buttons, and the existing coverage dots. The newness is the interaction, not the palette.

State machine (per checkpoint turn):
- `speaking`: Poly's question plays (TTS). Mic off. A calm "Poly is speaking" cue.
- `listening`: mic open. The signature moment (below). "Done" is the primary action.
- `scoring`: brief thinking state; dots resolve.
- `result`: affirm or probe; Poly speaks it, then back to `listening` for the next turn, or `done` (Continue).
Parallel `inputMode`: `voice` (default) or `keyboard`.

Signature element (spend the boldness here, keep the rest quiet): a soft breathing lilac orb that pulses gently while listening, with the learner's words streaming beneath it. Finalized words render at full foreground; the in-flight interim delta renders dimmed (lower opacity), so you can see thought becoming text. Calm, alive, not busy. Reduced motion: the orb holds steady (no pulse), captions still update.

Live captions: centered, generous reading size, auto-growing, gentle fade as new text lands. Never a wall of controls; "Done" (tactile, lilac) is the one obvious action, disabled until there is some transcript.

Keyboard as a pull-up sheet: a slim grabber pill pinned to the bottom with a keyboard glyph and "Type instead". Drag it up (motion drag, spring) or tap it; the textarea sheet slides up, the realtime session stops, and focus moves to the field. A "Use voice" affordance at the top of the sheet (or drag down) returns to voice and reopens the mic. Submit in keyboard mode is the existing path.

Motion: orb breathing, sheet drag/spring, caption fade, dots settling. One orchestrated handoff (speak -> listen) over scattered effects. All gated by `prefers-reduced-motion`.

Accessibility floor: the live caption region is an `aria-live="polite"` log; the orb is decorative (`aria-hidden`); mic state announced; keyboard sheet fully operable without the drag (tap target works); textarea keeps its label; visible focus; respects reduced motion.

---

## File structure

Create:
- `functions/src/poly/realtimeToken.ts` - `createRealtimeToken` core + `polyRealtimeToken` callable.
- `functions/src/poly/realtimeToken.test.ts`
- `src/lib/ai/realtimeTranscriber.ts` - WebRTC glue + a pure `accumulateTranscript` reducer.
- `src/lib/ai/realtimeTranscriber.test.ts` - reducer tests (pure).

Modify:
- `functions/src/openai.ts` - add `RealtimeTokenMinter` + `openAIRealtimeTokenMinter` (raw `fetch` to the realtime REST endpoint; injectable for tests).
- `functions/src/openaiConfig.ts` - add `DEFAULT_REALTIME_MODEL` (`gpt-4o-transcribe`) + `resolveRealtimeModel()`.
- `functions/src/index.ts` - export `polyRealtimeToken`.
- `src/lib/ai/polyClient.ts` - add `realtimeToken()` wrapper + types.
- `src/lessons/stacksQueues/PolyCheckpoint.tsx` - the redesign (state machine, auto-listen, live captions + orb, Done, keyboard sheet, fallback). Injectable transcriber for tests.
- `src/lessons/stacksQueues/PolyCheckpoint.test.tsx` - voice-conversation tests with a fake transcriber.
- `functions/src/poly/score.ts`, `functions/src/poly/probe.ts`, `functions/src/poly/rubrics.ts` - guardrail tuning (prompts + tokens).
- `src/screens/PolyLab.tsx` - demo: live voice in Live mode; a scripted fake transcriber in Mock mode (keyless).

---

## Tasks (inline TDD; commit per task)

1. Backend config + token minter
   - `resolveRealtimeModel()` (+ test).
   - `RealtimeTokenMinter` interface + `openAIRealtimeTokenMinter` doing a `fetch` POST to mint; inject `fetch` so a fake verifies the request shape and parses `client_secret` (+ test).
2. `polyRealtimeToken` callable
   - `createRealtimeToken(minter, model)` core: returns `{ token, expiresAt, model }`, fail-soft `{ token: null }` in catch; `onCall` wrapper with `{ secrets: [OPENAI_API_KEY] }`. Export from `index.ts`. Tests with a fake minter.
   - Live check: from the running emulator, mint a token and confirm a 200 + non-null `client_secret` against the real key.
3. Client token wrapper + transcript reducer
   - `realtimeToken()` in `polyClient.ts` (+ test, existing mock style).
   - Pure `accumulateTranscript(state, event)` in `realtimeTranscriber.ts`: folds delta/completed events into `{ finalText, interimText }` (+ tests: deltas append without forced spaces, completed promotes interim to final, multiple segments concatenate).
4. WebRTC transcriber module
   - `createRealtimeTranscriber({ getToken, model, onUpdate(finalText, interimText), onError })` with `start()` / `stop()`; uses `getUserMedia`, `RTCPeerConnection`, the `oai-events` data channel, and the reducer. Fail-soft: `start()` throws on mic denial / token failure so the caller falls back; `stop()` tears down tracks + peer connection idempotently. Not unit-tested (browser-only); exercised via the demo and via injection in the component.
   - Live check in the gallery: confirm real deltas arrive end to end.
5. PolyCheckpoint redesign
   - State machine + `inputMode`; auto-listen after `speakText` resolves; live caption + orb; "Done" stops + scores; probe loop speaks then re-listens; keyboard pull-up sheet (motion) with switch + return; fallbacks (mic denied / token fail / no transcript -> keyboard with a gentle note). Inject `speakText`, `createRealtimeTranscriber`, `scoreExplanation`, `requestProbe`, `saveExplanation`.
   - Tests with a fake transcriber: speaks then listens; deltas render; Done scores; probe re-listens; keyboard switch stops the session and types; mic-fail falls back to keyboard.
6. Guardrail tuning (see below) with updated/added tests.
7. Demo wiring in `PolyLab` (Live = real; Mock = scripted fake transcriber that emits a few deltas then a completed, keyless).
8. Full verification: functions build + tests; root `tsc -b`, lint, `npm test`; live gallery smoke (Live) + screenshots; then PR.

---

## Guardrail tuning specifics

- Scorer (`score.ts` SYSTEM): make coverage generous. Mark `covered` when the learner conveys the idea in ANY wording (analogy, example, paraphrase); `partial` only when vague or half-stated; `missing` only when truly absent. Add an explicit "when in doubt, prefer covered; this is a non-gating side quest" line. Keep JSON-only output. Update `score.test.ts` to assert an analogy-style answer scores covered (via a stubbed completer).
- Prober (`probe.ts`): keep the warm opener, make the question more specific to the missing proposition and strictly one short question; never use the proposition's key terms. Verifier already guards; keep the regenerate-once-then-null policy. Adjust `probe.test.ts` expectations if wording assertions change.
- Verifier (`verifier.ts` + `rubrics.ts`): broaden `answerTokens` so near-synonyms of each proposition are caught (e.g. for the top-only access prop, add "topmost", "only the top"). Optionally normalize punctuation/whitespace in the scan. Add verifier tests for the new tokens.

Keep each change test-backed; the verifier, scorer, skill map, and rubrics all have existing suites.

---

## Fallback and degradation (the "works with AI off" guarantee holds)

- Token mint fails / WebRTC fails / mic denied: switch to keyboard mode with "Voice unavailable, type instead." The lesson always completes.
- TTS fails or autoplay is blocked: question still shows as text; a replay control is available; listening still starts.
- Scoring/probe fail: affirm and continue (existing behavior).
- Voice is non-gating throughout; nothing here touches the deterministic mastery engine.

## Out of scope

- Speech-to-speech (Poly does not converse with a realtime voice model; it speaks via discrete TTS and transcribes via realtime STT, feeding the same text scorer).
- Personalization / analogy-mode hints (Phase 3).
- Replacing the discrete `polyTranscribe` path (kept in the codebase as-is; the checkpoint now uses realtime, with keyboard as the fallback).

## Testing

- Function units: `resolveRealtimeModel`, the minter (fake `fetch`), `createRealtimeToken` (fake minter), tuned scorer/prober/verifier.
- Client units: `accumulateTranscript` reducer; `realtimeToken` wrapper; PolyCheckpoint conversation flow with a fake transcriber.
- Live: token mint via emulator against the real key; end-to-end deltas in the gallery (Live).
- Browser glue (WebRTC/getUserMedia/Audio): not unit-tested; covered by the demo + component injection, consistent with how `voice.ts` is handled.
