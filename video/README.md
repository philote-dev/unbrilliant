# Willow x Poly: product film

A ~3min (177s, 2:57) product film for Willow, rendered to a real MP4 with
[Remotion](https://remotion.dev). It leads with Willow's philosophy (learn
algorithmic thinking by doing), shows the interactive lessons, then introduces
Poly and its AI features, and closes on the Mastery Engine. It is an isolated
project: it has its own deps and never touches the app build.

It follows the Anthropic rhythm (e.g. "Claude now connects to Autodesk Fusion"):
a short **statement beat**, then the capability **shown fully** on the Willow
**web app**, repeated per feature. Cursor-style restraint (calm light canvas, one
lilac accent, hairline depth, smooth motion), unmistakably Willow (Geist, lilac).

The Poly features are Phase 2 (designed in `docs/plans/`, not all shipped yet),
so the film dramatizes how Poly *would* work in faithful UI. The live-voice
architecture beat is faithful to `docs/plans/2026-06-26-poly-voice-live.md`.

## Run it

```bash
cd video
npm install          # first time only
npm run gen:sfx      # (re)generate the UI sound effects into public/sfx/
npm run studio       # live preview + scrubbing at http://localhost:3000
npm run render       # writes out/willow-poly.mp4 (1920x1080, 30fps, ~177s)
npm run still -- out/frame.png --frame=1160   # render a single frame
```

## Scene map (30fps, total 5320 frames = ~2:57, ~1s calm buffer between beats)

| Frames | Beat | What |
| ------ | ---- | ---- |
| 0-200 | Hook | "Most learning apps just hand you the answer." -> "Willow makes you figure it out." |
| 230-405 | Reveal | official mark + wordmark, "Learn algorithmic thinking by doing." |
| 435-1015 | Interactivity | montage: Graphs (a subway map), Linked lists (a music queue), Hash tables (a warehouse) |
| 1045-1285 | Meet Poly | the Poly avatar lands, "Now meet Poly. Your AI tutor." |
| 1315-1490 | 01 Poly Hints / say | "Make a wrong move, Poly points it out. Never the answer." |
| 1490-1850 | 01 show | natural eased drag, a wrong move, zoom into Poly Hints typing a no-spoiler nudge |
| 1880-2055 | 02 Poly Guide / say | "Explain it back. Poly probes the gaps." |
| 2055-2595 | 02 show | covered/partial/missing, sweep-scroll, Poly's nudge types out and holds to read |
| 2625-2800 | 03 Poly Voice / say | "Or just talk it through." |
| 2800-3180 | 03 show | tap to enter voice mode; reply up top, the lilac voice orb centered, your question at the bottom |
| 3210-3850 | 03 architecture | "Under the hood": secure TTS out, mic streams over WebRTC to OpenAI Realtime, the same scorer; the key-stays-server card lands last |
| 3880-4480 | Mastery Engine / willow | grow ("Mastery you actually develop.") -> fade to autumn + "Needs review" (held) -> heal |
| 4510-4955 | Mastery Engine / curve | the forgetting curve morphs into the spaced-reinforcement curve; "Built on real learning science." |
| 4985-5175 | End card | mark + wordmark + "Think it through." + CTA |
| 5175-5320 | Brand sting | hard cut to lilac, the white willow mark settles in |

The "say" beats are full-frame text; the "show" beats are the Willow web app in a
browser window, shown full. Text streams in letter-by-letter (`StreamText`); the
pointer moves on an eased, curved path (`cursorPath`); the mark is the real
artwork (`public/willow-mark.svg`), recolored white for the sting.

## Audio: UI sound design (no music)

The film carries a minimal UI sound design and **no music bed**. The effects are
**procedurally synthesized** (pure Node, no deps) by `scripts/gen-sfx.mjs` into
`public/sfx/`. The cut deliberately wires only two of them in `WillowPoly.tsx`
(the `ONE_SHOTS` and `LOOPS` tables), at low volume: `click` on cursor taps and on
each reveal in the under-the-hood beat, and a `typing` texture while text streams.
The other generated effects (`pop`, `swell`, `chime`, `whoosh`, `orb`) are left
unwired.

Regenerate them anytime with `npm run gen:sfx`.

Music is still optional: drop an `.mp3` into `public/` and set `MUSIC_FILE` in
`src/config.ts`; it is mixed in with a gentle fade in/out over the whole film.

## Tweak without touching scenes (`src/config.ts`)

- **Music**: off by default. Set `MUSIC_FILE = "your-track.mp3"` (royalty-free: Uppbeat, Pixabay Music).
- **CTA**: change `CTA` to the real URL.

## Structure

- `src/WillowPoly.tsx` sequences the beats and the sound design; `src/Root.tsx` registers the composition (duration tracks `TOTAL`).
- `src/scenes/TextCard.tsx` the statement beat; `src/scenes/DemoScene.tsx` wraps the web app.
- `src/scenes/S3Interactivity.tsx` the lessons montage; `src/scenes/S4MeetPoly.tsx` Poly's intro; `src/scenes/S5VoiceArch.tsx` the live-voice diagram.
- `src/lessons/{SubwayMini,QueueMini,WarehouseMini}.tsx` the montage hero visuals.
- `src/components/PolyAvatar.tsx` the Poly mascot (rounded square, one-corner eye), used for every Poly badge and the voice bubble.
- `src/components/WebShell.tsx` the browser + sidebar app shell; `src/components/Cursor.tsx` the pointer.
- `src/ui/web/*` the full desktop demos (stack construct / hints, teach-back / guide, voice).
- `src/scenes/S1Hook`, `S2Reveal`, `S6Willow`, `S7End`, `S8Sting`, `S9Science` the non-demo scenes.
- `scripts/gen-sfx.mjs` + `public/sfx/*.wav` the sound design.
- `src/theme.ts` Willow's light tokens; `src/font.ts` loads Geist.

## Notes

- A 9:16 social cut would mean a second `<Composition>` and stacked layouts; the current scenes are 16:9 desktop.
- Willow growth frames (`public/willow-g1..g7.webp`) are copied from the app's `public/`.
