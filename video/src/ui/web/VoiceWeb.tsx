import { easeInOut, ramp } from "../../anim";
import { useDesignFrame } from "../../timing";
import { Cursor } from "../../components/Cursor";
import { MicIcon } from "../../components/icons";
import { PolyAvatar } from "../../components/PolyAvatar";
import { StreamText } from "../../components/StreamText";
import { COLORS } from "../../theme";

const REPLY = "Right. So if three people line up, who do you serve first?";
const QUESTION = "So a queue is first in, first out?";

const Waveform: React.FC<{ active: number; bars?: number; color?: string; height?: number; gap?: number; width?: number }> = ({
  active,
  bars = 9,
  color = "#fff",
  height = 84,
  gap = 9,
  width = 10,
}) => {
  const frame = useDesignFrame();
  return (
    <div style={{ display: "flex", alignItems: "center", gap, height }}>
      {Array.from({ length: bars }).map((_, i) => {
        const wobble = (Math.sin(frame * 0.32 + i * 0.9) * 0.5 + 0.5) * active;
        const h = 12 + wobble * (height - 12);
        return <div key={i} style={{ width, height: h, borderRadius: 999, background: color, opacity: 0.55 + active * 0.45 }} />;
      })}
    </div>
  );
};

/** Desktop Poly voice: tap to enter voice mode, then Poly (the avatar) replies in
 * the centered bubble while the learner's question sits at the bottom. */
export const VoiceWeb: React.FC = () => {
  const frame = useDesignFrame();

  // Smooth, eased crossfade from the entry screen into voice mode; the avatar
  // grows up out of the mic button rather than snapping.
  const entryOut = ramp(frame, [60, 96], [1, 0], { easing: easeInOut });
  const voiceIn = ramp(frame, [72, 110], [0, 1], { easing: easeInOut });
  const avatarIn = ramp(frame, [78, 120], [0, 1], { easing: easeInOut });

  // voice-mode timings
  const userShow = ramp(frame, [116, 136], [0, 1]);
  const polySpeak = ramp(frame, [150, 168, 300, 316], [0, 1, 1, 0]);
  const breathe = 1 + Math.sin(frame * 0.12) * 0.02;
  const orbScale = (0.7 + avatarIn * 0.3) * breathe + polySpeak * 0.05;
  const ringOn = 0.18 + polySpeak * 0.34;

  return (
    <div
      style={{
        height: "100%",
        position: "relative",
        background: `radial-gradient(900px 620px at 50% 52%, ${COLORS.lilacSoft} 0%, ${COLORS.surface} 72%)`,
        overflow: "hidden",
      }}
    >
      {/* entry: tap to enter voice mode */}
      {frame < 102 ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, opacity: entryOut }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: 2, color: COLORS.lilacInk }}>TALK IT THROUGH</div>
          <div style={{ fontSize: 30, color: COLORS.muted }}>Prefer to explain it out loud?</div>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 116,
                height: 116,
                borderRadius: 999,
                background: COLORS.lilac,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 22px 50px -18px rgba(139,127,214,0.85)",
                transform: `scale(${frame >= 52 && frame < 66 ? 0.92 : 1})`,
              }}
            >
              <MicIcon size={46} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.ink }}>Talk to Poly</div>
          </div>
          <Cursor
            path={[
              { frame: 14, x: 760, y: 650 },
              { frame: 52, x: 628, y: 452, curve: 40 },
              { frame: 102, x: 628, y: 452 },
            ]}
            taps={[52]}
          />
        </div>
      ) : null}

      {/* voice mode */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: "44px 40px 40px", opacity: voiceIn }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PolyAvatar size={30} />
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 1.4, color: COLORS.lilacInk }}>POLY</span>
        </div>

        {/* reply, lowered a little from the header */}
        <div style={{ marginTop: 58, maxWidth: 860, minHeight: 96, textAlign: "center", fontSize: 36, fontWeight: 600, lineHeight: 1.34, color: COLORS.ink }}>
          <StreamText text={REPLY} start={150} perLetter={1.5} wordGap={5} caret={false} />
        </div>

        {/* the bubble: the lilac orb with the voice signature, centered */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "relative", width: 260, height: 260, display: "flex", alignItems: "center", justifyContent: "center", opacity: avatarIn }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 999,
                background: `radial-gradient(circle at 50% 36%, ${COLORS.lilacFill} 0%, ${COLORS.lilac} 60%, ${COLORS.lilacInk} 100%)`,
                transform: `scale(${orbScale})`,
                boxShadow: "0 34px 84px -26px rgba(139,127,214,0.75)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: -22,
                borderRadius: 999,
                border: `2px solid ${COLORS.lilac}`,
                opacity: ringOn,
                transform: `scale(${1 + polySpeak * 0.08})`,
              }}
            />
            <div style={{ position: "relative" }}>
              <Waveform active={0.22 + polySpeak} bars={9} color="#fff" height={80} />
            </div>
          </div>
        </div>

        {/* user's question, pinned at the bottom */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: userShow, transform: `translateY(${(1 - userShow) * 12}px)` }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.2, color: COLORS.faint }}>YOU SAID</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 999,
              padding: "12px 22px",
              fontSize: 21,
              color: COLORS.muted,
            }}
          >
            <Waveform active={0.5} bars={4} color={COLORS.lilac} height={20} gap={4} width={5} />
            “{QUESTION}”
          </div>
        </div>
      </div>
    </div>
  );
};
