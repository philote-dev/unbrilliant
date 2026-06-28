# Willow x Poly film: re-cut toward the Willow philosophy + UI SFX

Re-cut of the Remotion product film (`video/`) to lead with Willow's "learn by
doing" philosophy, give Poly its own introduction, append a live-voice
architecture beat, and add a real (procedurally synthesized) UI sound design.

The `video/` project is untracked on `main` and isolated from the app build. Work
in place. No git commits unless explicitly asked. Verification is `npm run
typecheck` plus rendered stills/MP4 from the Remotion composition.

## New narrative order

1. Hook (`S1Hook`, unchanged): "Most learning apps just hand you the answer." -> "Willow makes you figure it out."
2. Reveal (`S2Reveal`, trimmed): Willow wordmark + "Learn algorithmic thinking by doing." The "meet Poly" line is REMOVED from here.
3. Interactivity montage (NEW `S3Interactivity`): three themed interactive lessons, faithful hero visuals, ~2.5-3s each.
   - Graphs as a subway map
   - Linked lists as a Spotify-style music queue
   - Hash tables as a warehouse stow station
4. Meet Poly (NEW `S4MeetPoly`): dedicated brand beat, "Now meet Poly, your AI tutor." Uses the new PolyAvatar. This is the gateway into the Poly section.
5. Poly Hints (`TextCard` "01 · Poly Hints" + `StackConstructWeb`): "Make a wrong move, Poly points it out. Never the answer." (Renamed from "Poly Guide".)
6. Poly Guide (`TextCard` "02 · Poly Guide" + `CheckpointWeb`): "Explain it back. Poly probes the gaps." (Renamed from "Learning Science".)
7. Poly Voice (`TextCard` "03 · Poly Voice" + `VoiceWeb`) then appended architecture beat (NEW `S_VoiceArch`): "Or just talk it through."
8. Mastery Engine, part 1 (`S6Willow`): tree grow/fade/heal. Pivot caption "Mastery you actually develop."
9. Mastery Engine, part 2 (`S9Science`): forgetting curve -> spaced reinforcement. Eyebrow "Mastery Engine", headline "Built on real learning science."
10. End card (`S7End`).
11. Brand sting (`S8Sting`): white willow mark on lilac, logo SHRUNK.

## Live-voice architecture (accurate, from docs)

Per `docs/plans/2026-06-26-poly-voice-live.md` and `docs/architecture.md`, the
feature is "live voice", not "live TTS":

- Poly SPEAKS via discrete server-side TTS (`polySpeak`, base64 MP3). Key stays a Functions secret.
- Learner's voice STREAMS IN live: browser opens WebRTC to OpenAI Realtime (`gpt-4o-transcribe`, server VAD), using a short-lived `client_secret` minted by `polyRealtimeToken`. The real key never reaches the client.
- Live captions render from `...input_audio_transcription.delta`/`.completed` events; "Done" sends.
- The transcript feeds the SAME scorer (`polyScore`/`polyProbe`) as typed text.

Elegant depiction: two lanes (Poly speaks -> speakers; you speak -> WebRTC -> OpenAI Realtime -> live words), a server/lock holding the key while the browser holds only a short-lived token, both lanes converging into "the same scorer." A few real labels, lots of calm whitespace.

## Tasks

### Independent new components (subagent implementers)

- T1 PolyAvatar: `video/src/components/PolyAvatar.tsx`. Rounded-square lilac mark; one corner is an eye (white circle that rounds that corner) with an inner black pupil; minimal. Props: `size`, optional `color`, optional `breathing`/pupil offset for the big voice version. Replaces every lilac-circle-with-spark Poly badge.
- T2 SFX synthesis: `video/scripts/gen-sfx.mjs` writes mono 16-bit WAVs to `video/public/sfx/`: `click`, `pop`, `whoosh`, `swell`, `typing` (loopable), `orb` (loopable hum), `chime`. Pure Node, no deps. Run it; commit the wavs into `video/public/sfx/`.
- T3 Mini-lessons: `video/src/lessons/SubwayMini.tsx`, `QueueMini.tsx`, `WarehouseMini.tsx`. Faithful, simplified hero visuals (palettes/labels below). Each fills a given box, self-animates a small reveal.
- T4 Interactivity montage scene `video/src/scenes/S3Interactivity.tsx`: sequences the three minis in floating rounded "screens" with calm captions + cross-transitions.
- T5 Meet Poly scene `video/src/scenes/S4MeetPoly.tsx`: uses PolyAvatar, "Now meet Poly, your AI tutor."
- T6 Voice architecture scene `video/src/scenes/S_VoiceArch.tsx`: the elegant diagram above.

### Coupled integration (controller, with stills verification)

- T7 Swap PolyAvatar into `StackConstructWeb`, `CheckpointWeb`, `VoiceWeb` (badges + big orb face).
- T8 Renames: hints header -> "Poly Hints"; checkpoint header "LEARNING SCIENCE" -> "POLY GUIDE"; TextCard labels 01/02/03; `S9Science` eyebrow -> "Mastery Engine", headline -> "Built on real learning science"; `S6Willow` caption "Mastery you actually earn." -> "Mastery you actually develop."
- T9 Checkpoint text: PROBE drop "One nudge:" -> "What happens to the first item you pushed?"; extend hold so the last nudge is readable.
- T10 Voice polish: smoother entry->voice transition; center orb; lower the top reply text a little.
- T11 Reveal trim ("meet Poly" out) + sting logo smaller (~190px).
- T12 Wire `WillowPoly.tsx` (new order, durations, gaps, TOTAL) + `Root.tsx` (`durationInFrames={TOTAL}`) + `SoundDesign.tsx` (one-shots/loops at absolute frames).
- T13 Verify: `npm run typecheck`, render stills at each new beat, render full MP4, update `video/README.md`, final code-quality review.

## Faithful mini-lesson visual specs

Subway/graphs (`SubwayMini`): warm paper `#f7f2ea` rounded field; lines with white casing under color: red `#ef5350`, blue `#1aa7e0`, green `#16b08a`; stations = white circles, near-black ring `#16181d`, interchange = thicker ring; a dashed "gap" segment C-D with a lilac `#8b7fd6` dashed drag line mid-gesture; roundel + "City Metro" + amber "1 gap" badge.

Spotify queue/linked lists (`QueueMini`): dark `#121212`; header "Queue" + "Playing Liked Songs"; track rows with 40px gradient album art (e.g. `#7c3aed`->`#2563eb`), head track green `#1db954` title + 3 pulsing playing bars; a "NEW" green pill track ("Ferris Wheel"); green elbow pointer arrow being re-aimed into the new track.

Warehouse/hash tables (`WarehouseMini`): squid-ink `#232f3e`; safety orange `#ff9900`; scanner cyan `#08aae3`; kraft box gradient `#ddbd87`->`#b78d52` with tape strip; SCAN pill "Σ ivy = 42 · mod 8 = ?"; 2-col bin grid with orange index badges; one bin armed with dashed orange "DROP" while the box is mid-drag toward it.

## Sound design map (absolute frames, set during T12)

- `swell` at hook->reveal, meet-poly, and sting reveals.
- `whoosh` at each DemoScene/montage screen entrance.
- `click` at every Cursor tap (hints grab/drop, voice mic, checkpoint send).
- `pop` at montage item reveals, "Needs review" pill, score-row appearances.
- `typing` loop across typewriter/StreamText spans (checkpoint answer, hint, probe, voice reply).
- `orb` loop while Poly is speaking in voice mode.
- `chime` at first "Covered" dot and the end card.

Keep SFX low (each well under the old music level) so it reads as polish, not noise.
