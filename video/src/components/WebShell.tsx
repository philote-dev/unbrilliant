import type { ReactNode } from "react";

import { COLORS, SHADOW } from "../theme";
import { WillowLogo } from "./WillowLogo";

export const SHELL_W = 1480;
export const SHELL_H = 884;

/** The Willow web app inside a calm browser window: title bar with a URL pill,
 * a slim left sidebar, and a main content area. The demos render full inside. */
export const WebShell: React.FC<{
  url: string;
  active?: NavId;
  children: ReactNode;
}> = ({ url, active = "learn", children }) => (
  <div
    style={{
      width: SHELL_W,
      height: SHELL_H,
      borderRadius: 20,
      background: COLORS.surface,
      boxShadow: SHADOW.device,
      border: `1px solid ${COLORS.border}`,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}
  >
    <div
      style={{
        height: 50,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: 14,
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.surfaceMuted,
      }}
    >
      <div style={{ display: "flex", gap: 9 }}>
        {["#E2A0A0", "#E6CE8E", "#A9CBA3"].map((c) => (
          <span key={c} style={{ width: 13, height: 13, borderRadius: 999, background: c }} />
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 999,
            padding: "8px 22px",
            fontSize: 16,
            color: COLORS.faint,
          }}
        >
          <Lock /> {url}
        </div>
      </div>
      <div style={{ width: 60 }} />
    </div>

    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      <Sidebar active={active} />
      <div style={{ flex: 1, position: "relative", background: COLORS.surface, minWidth: 0, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  </div>
);

type NavId = "home" | "learn" | "progress" | "profile";

function glyph(path: ReactNode) {
  return ({ on }: { on: boolean }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={on ? COLORS.lilacInk : COLORS.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {path}
    </svg>
  );
}

const HomeGlyph = glyph(<><path d="M4 11l8-7 8 7" /><path d="M6 10v9h12v-9" /></>);
const BookGlyph = glyph(<><path d="M5 5a2 2 0 0 1 2-2h11v16H7a2 2 0 0 0-2 2z" /><path d="M5 19a2 2 0 0 1 2-2h11" /></>);
const ChartGlyph = glyph(<><path d="M5 19V5" /><path d="M5 19h14" /><path d="M9 16v-5M13 16V8M17 16v-7" /></>);
const UserGlyph = glyph(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>);

const NAV: { id: NavId; label: string; icon: React.FC<{ on: boolean }> }[] = [
  { id: "home", label: "Home", icon: HomeGlyph },
  { id: "learn", label: "Learn", icon: BookGlyph },
  { id: "progress", label: "Progress", icon: ChartGlyph },
  { id: "profile", label: "Profile", icon: UserGlyph },
];

const Sidebar: React.FC<{ active: NavId }> = ({ active }) => (
  <div
    style={{
      width: 232,
      flexShrink: 0,
      borderRight: `1px solid ${COLORS.border}`,
      background: COLORS.surfaceMuted,
      display: "flex",
      flexDirection: "column",
      padding: "24px 16px",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 22px" }}>
      <WillowLogo height={30} color={COLORS.lilac} />
      <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.6, color: COLORS.ink }}>Willow</span>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {NAV.map((n) => {
        const on = n.id === active;
        const Icon = n.icon;
        return (
          <div
            key={n.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "11px 13px",
              borderRadius: 12,
              background: on ? COLORS.lilacSoft : "transparent",
              color: on ? COLORS.lilacInk : COLORS.muted,
              fontWeight: on ? 700 : 500,
              fontSize: 17,
            }}
          >
            <Icon on={on} />
            {n.label}
          </div>
        );
      })}
    </div>
    <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 10, padding: "10px 8px" }}>
      <span style={{ width: 30, height: 30, borderRadius: 999, background: COLORS.lilacFill, display: "inline-block" }} />
      <span style={{ fontSize: 15, color: COLORS.muted }}>Sam</span>
    </div>
  </div>
);

const Lock: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.faint} strokeWidth="2">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
