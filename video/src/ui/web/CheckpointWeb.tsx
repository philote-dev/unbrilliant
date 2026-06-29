import { spring } from "remotion";

import { ramp } from "../../anim";
import { BASE_FPS, useDesignFrame } from "../../timing";
import { CheckIcon, SendIcon } from "../../components/icons";
import { PolyAvatar } from "../../components/PolyAvatar";
import { StreamText } from "../../components/StreamText";
import { COLORS, RADIUS } from "../../theme";

const ANSWER = "you can only reach the newest one, it sits on top of the rest";
const PROBE = "What happens to the first item you pushed?";

type Verdict = "covered" | "partial" | "missing";
const VERDICT: Record<Verdict, { fill: string; ink: string; label: string }> = {
  covered: { fill: COLORS.successFill, ink: "#3F7A4C", label: "Covered" },
  partial: { fill: COLORS.warningFill, ink: "#8A6D1A", label: "Partial" },
  missing: { fill: "#EBEEF3", ink: COLORS.muted, label: "Missing" },
};

const ScoreRow: React.FC<{ text: string; verdict: Verdict; appear: number; highlight?: boolean }> = ({
  text,
  verdict,
  appear,
  highlight,
}) => {
  const v = VERDICT[verdict];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        padding: "18px 22px",
        borderRadius: 16,
        background: highlight ? COLORS.lilacSoft : COLORS.surface,
        border: `1.5px solid ${highlight ? COLORS.lilac : COLORS.border}`,
        opacity: appear,
        transform: `translateY(${(1 - appear) * 14}px)`,
      }}
    >
      <span style={{ fontSize: 23, color: COLORS.ink }}>{text}</span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
          background: v.fill,
          color: v.ink,
          fontSize: 18,
          fontWeight: 700,
          padding: "7px 16px",
          borderRadius: 999,
        }}
      >
        {verdict === "covered" ? <CheckIcon size={17} color={v.ink} /> : null}
        {verdict === "partial" ? <span style={{ fontSize: 19, lineHeight: 1 }}>~</span> : null}
        {verdict === "missing" ? <span style={{ fontSize: 19, lineHeight: 1 }}>-</span> : null}
        {v.label}
      </span>
    </div>
  );
};

/** Desktop teach-back ("Poly Guide"): explain back, three-way scoring, then
 * Poly streams a nudge at the weakest gap. The chat auto-scrolls. */
export const CheckpointWeb: React.FC = () => {
  const frame = useDesignFrame();
  const typed = Math.round(ramp(frame, [40, 175], [0, ANSWER.length]));
  const submitted = frame >= 188;
  const caretOn = Math.floor(frame / 8) % 2 === 0;
  // Sweep scroll: quick eased jumps when a new line lands, not a slow creep.
  const sweep1 = spring({ fps: BASE_FPS, frame: frame - 275, config: { damping: 22, mass: 0.7 } });
  const sweep2 = spring({ fps: BASE_FPS, frame: frame - 322, config: { damping: 22, mass: 0.7 } });
  const scroll = sweep1 * 55 + sweep2 * 150;

  return (
    <div style={{ height: "100%", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: 880,
            padding: "54px 20px 60px",
            display: "flex",
            flexDirection: "column",
            gap: 22,
            transform: `translateY(${-scroll}px)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <PolyDot />
            <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: 1.4, color: COLORS.lilacInk }}>POLY GUIDE</span>
          </div>

          <div style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.3, color: COLORS.ink }}>
            In your own words, why can you only take the most recent item off a stack?
          </div>

          {!submitted ? (
            <div
              style={{
                minHeight: 130,
                borderRadius: RADIUS.card,
                border: `2px solid ${COLORS.lilac}`,
                background: COLORS.surfaceMuted,
                padding: "20px 24px",
                fontSize: 25,
                lineHeight: 1.5,
                color: COLORS.ink,
                position: "relative",
              }}
            >
              {ANSWER.slice(0, typed)}
              <span style={{ opacity: caretOn ? 1 : 0, color: COLORS.lilac, fontWeight: 700 }}>|</span>
              <div
                style={{
                  position: "absolute",
                  right: 18,
                  bottom: 18,
                  width: 52,
                  height: 52,
                  borderRadius: 999,
                  background: COLORS.lilac,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: typed > ANSWER.length - 2 ? 1 : 0.4,
                }}
              >
                <SendIcon size={24} />
              </div>
            </div>
          ) : (
            <>
              <div style={{ alignSelf: "flex-end", maxWidth: 560, background: COLORS.lilacSoft, border: `1px solid ${COLORS.lilac}`, borderRadius: 18, borderBottomRightRadius: 5, padding: "14px 20px", fontSize: 22, color: COLORS.ink }}>
                {ANSWER}
              </div>

              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.6, color: COLORS.muted }}>WHAT POLY HEARD</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <ScoreRow text="Last in, first out" verdict="covered" appear={ramp(frame, [205, 227], [0, 1])} />
                <ScoreRow text="Only the top is reachable" verdict="partial" appear={ramp(frame, [233, 255], [0, 1])} />
                <ScoreRow text="Why that removal order follows" verdict="missing" appear={ramp(frame, [261, 283], [0, 1])} highlight={frame >= 300} />
              </div>

              {frame >= 315 ? (
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start", opacity: ramp(frame, [315, 332], [0, 1]) }}>
                  <PolyDot />
                  <div style={{ background: COLORS.surfaceMuted, border: `1px solid ${COLORS.border}`, borderRadius: 18, borderTopLeftRadius: 5, padding: "14px 20px", fontSize: 22, lineHeight: 1.45, color: COLORS.ink, minHeight: 28 }}>
                    <StreamText text={PROBE} start={322} />
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* edge fades for the chat feel */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 70, background: `linear-gradient(${COLORS.surface}, rgba(255,255,255,0))`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 90, background: `linear-gradient(rgba(255,255,255,0), ${COLORS.surface})`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 0 22px", color: COLORS.faint, fontSize: 17, textAlign: "center" }}>
        Side-quest. This never changes your mastery.
      </div>
    </div>
  );
};

const PolyDot: React.FC = () => <PolyAvatar size={36} style={{ flexShrink: 0 }} />;
