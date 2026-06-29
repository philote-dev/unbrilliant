import { AbsoluteFill, Audio, interpolate, Sequence, staticFile } from "remotion";

import { Ambient } from "./components/Ambient";
import { useToRenderFrames } from "./timing";
import { CTA, MUSIC_FILE, MUSIC_VOLUME } from "./config";
import { fontFamily } from "./font";
import { DemoScene } from "./scenes/DemoScene";
import { S1Hook } from "./scenes/S1Hook";
import { S2Reveal } from "./scenes/S2Reveal";
import { S3Interactivity } from "./scenes/S3Interactivity";
import { S4MeetPoly } from "./scenes/S4MeetPoly";
import { S5VoiceArch } from "./scenes/S5VoiceArch";
import { S6Willow } from "./scenes/S6Willow";
import { S7End } from "./scenes/S7End";
import { S8Sting } from "./scenes/S8Sting";
import { S9Science } from "./scenes/S9Science";
import { TextCard } from "./scenes/TextCard";
import { CheckpointWeb } from "./ui/web/CheckpointWeb";
import { StackConstructWeb } from "./ui/web/StackConstructWeb";
import { VoiceWeb } from "./ui/web/VoiceWeb";

/**
 * The film now leads with Willow's "learn by doing" philosophy: hook, brand,
 * an interactive-lessons montage, then Poly gets its own introduction before the
 * Poly feature beats (hints, guide, voice + live-voice architecture), and closes
 * on the Mastery Engine (the willow loop + the learning-science curve).
 * Anthropic rhythm: a statement, then the capability shown full on the web app,
 * with a ~1s calm buffer between major beats. Durations in frames (30fps).
 */
const D = {
  hook: 200,
  reveal: 175,
  interactivity: 580,
  meetPoly: 240,
  t1: 175,
  d1: 360,
  t2: 175,
  d2: 540,
  t3: 175,
  d3: 380,
  arch: 640,
  willow: 600,
  science: 445,
  end: 190,
  sting: 145,
} as const;

const GAP = 30; // ~1s calm hold between major beats

let acc = 0;
const at = (n: number) => {
  const from = acc;
  acc += n;
  return from;
};
const gap = () => {
  acc += GAP;
};

const FROM = {
  hook: at(D.hook),
  _g0: gap(),
  reveal: at(D.reveal),
  _g1: gap(),
  interactivity: at(D.interactivity),
  _g2: gap(),
  meetPoly: at(D.meetPoly),
  _g3: gap(),
  t1: at(D.t1),
  d1: at(D.d1),
  _g4: gap(),
  t2: at(D.t2),
  d2: at(D.d2),
  _g5: gap(),
  t3: at(D.t3),
  d3: at(D.d3),
  _g6: gap(),
  arch: at(D.arch),
  _g7: gap(),
  willow: at(D.willow),
  _g8: gap(),
  science: at(D.science),
  _g9: gap(),
  end: at(D.end),
  sting: at(D.sting),
};

export const TOTAL = acc;

// Generous playback window; every one-shot wav is < 3s and stops at its natural end.
const ONE_SHOT_FRAMES = 90;

/** One-shot SFX at an absolute (design) frame. */
const OneShot: React.FC<{ at: number; name: string; vol?: number }> = ({ at: a, name, vol = 0.4 }) => {
  const r = useToRenderFrames();
  return (
    <Sequence from={r(a)} durationInFrames={r(ONE_SHOT_FRAMES)} layout="none">
      <Audio src={staticFile(`sfx/${name}.wav`)} volume={vol} />
    </Sequence>
  );
};

/** Looped SFX texture across a (design-frame) span. */
const Loop: React.FC<{ from: number; dur: number; name: string; vol?: number }> = ({ from, dur, name, vol = 0.2 }) => {
  const r = useToRenderFrames();
  return (
    <Sequence from={r(from)} durationInFrames={r(dur)} layout="none">
      <Audio src={staticFile(`sfx/${name}.wav`)} volume={vol} loop />
    </Sequence>
  );
};

// Clicks and a soft typing texture only; everything else (whoosh, pops, swells,
// chimes, the orb hum) was cut. The under-the-hood beat gets a click per reveal.
const ONE_SHOTS: { at: number; name: string; vol?: number }[] = [
  { at: FROM.d1 + 40, name: "click", vol: 0.4 },
  { at: FROM.d1 + 92, name: "click", vol: 0.4 },
  { at: FROM.d3 + 52, name: "click", vol: 0.42 },
  { at: FROM.arch + 44, name: "click", vol: 0.3 },
  { at: FROM.arch + 84, name: "click", vol: 0.3 },
  { at: FROM.arch + 150, name: "click", vol: 0.3 },
  { at: FROM.arch + 212, name: "click", vol: 0.3 },
  { at: FROM.arch + 440, name: "click", vol: 0.32 },
];

const LOOPS: { from: number; dur: number; name: string; vol?: number }[] = [
  { from: FROM.d1 + 150, dur: 56, name: "typing", vol: 0.18 },
  { from: FROM.d2 + 40, dur: 138, name: "typing", vol: 0.18 },
  { from: FROM.d2 + 322, dur: 60, name: "typing", vol: 0.18 },
  { from: FROM.arch + 244, dur: 75, name: "typing", vol: 0.18 },
];

export const WillowPoly: React.FC = () => {
  // Scale design frames (authored at 30fps) to this composition's real frames.
  const r = useToRenderFrames();
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Ambient />

      <Sequence from={r(FROM.hook)} durationInFrames={r(D.hook)} name="01 Hook">
        <S1Hook dur={D.hook} />
      </Sequence>
      <Sequence from={r(FROM.reveal)} durationInFrames={r(D.reveal)} name="02 Reveal">
        <S2Reveal dur={D.reveal} />
      </Sequence>

      <Sequence from={r(FROM.interactivity)} durationInFrames={r(D.interactivity)} name="03 Interactivity">
        <S3Interactivity dur={D.interactivity} />
      </Sequence>
      <Sequence from={r(FROM.meetPoly)} durationInFrames={r(D.meetPoly)} name="04 Meet Poly">
        <S4MeetPoly dur={D.meetPoly} />
      </Sequence>

      <Sequence from={r(FROM.t1)} durationInFrames={r(D.t1)} name="05 Poly Hints / say">
        <TextCard
          dur={D.t1}
          n="01"
          label="Poly Hints"
          statement="Make a wrong move, Poly points it out. Never the answer."
        />
      </Sequence>
      <Sequence from={r(FROM.d1)} durationInFrames={r(D.d1)} name="05 Poly Hints / show">
        <DemoScene dur={D.d1} url="willow.app/learn/stacks-queues">
          <StackConstructWeb />
        </DemoScene>
      </Sequence>

      <Sequence from={r(FROM.t2)} durationInFrames={r(D.t2)} name="06 Poly Guide / say">
        <TextCard
          dur={D.t2}
          n="02"
          label="Poly Guide"
          statement="Explain it back. Poly probes the gaps."
        />
      </Sequence>
      <Sequence from={r(FROM.d2)} durationInFrames={r(D.d2)} name="06 Poly Guide / show">
        <DemoScene dur={D.d2} url="willow.app/learn/teach-back">
          <CheckpointWeb />
        </DemoScene>
      </Sequence>

      <Sequence from={r(FROM.t3)} durationInFrames={r(D.t3)} name="07 Poly Voice / say">
        <TextCard
          dur={D.t3}
          n="03"
          label="Poly Voice"
          statement="Or just talk it through. Poly listens, and asks the next good question."
        />
      </Sequence>
      <Sequence from={r(FROM.d3)} durationInFrames={r(D.d3)} name="07 Poly Voice / show">
        <DemoScene dur={D.d3} url="willow.app/learn/voice">
          <VoiceWeb />
        </DemoScene>
      </Sequence>
      <Sequence from={r(FROM.arch)} durationInFrames={r(D.arch)} name="07 Poly Voice / architecture">
        <S5VoiceArch dur={D.arch} />
      </Sequence>

      <Sequence from={r(FROM.willow)} durationInFrames={r(D.willow)} name="08 Mastery Engine / willow loop">
        <S6Willow dur={D.willow} />
      </Sequence>
      <Sequence from={r(FROM.science)} durationInFrames={r(D.science)} name="08 Mastery Engine / curve">
        <S9Science dur={D.science} />
      </Sequence>

      <Sequence from={r(FROM.end)} durationInFrames={r(D.end)} name="09 End card">
        <S7End dur={D.end} cta={CTA} />
      </Sequence>
      <Sequence from={r(FROM.sting)} durationInFrames={r(D.sting)} name="10 Brand sting">
        <S8Sting dur={D.sting} />
      </Sequence>

      {/* UI sound design (no music): tasteful clicks, whooshes, typing, hum, chimes */}
      {ONE_SHOTS.map((s, i) => (
        <OneShot key={`o${i}`} at={s.at} name={s.name} vol={s.vol} />
      ))}
      {LOOPS.map((l, i) => (
        <Loop key={`l${i}`} from={l.from} dur={l.dur} name={l.name} vol={l.vol} />
      ))}

      {MUSIC_FILE ? (
        <Audio
          src={staticFile(MUSIC_FILE)}
          volume={(f) =>
            interpolate(f, [0, r(30), r(TOTAL - 60), r(TOTAL)], [0, MUSIC_VOLUME, MUSIC_VOLUME, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          }
        />
      ) : null}
    </AbsoluteFill>
  );
};
