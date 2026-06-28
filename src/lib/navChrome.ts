import type { Screen } from "@/lib/navigation"

/**
 * Pure nav-chrome state. Visibility of the primary nav is derived from a
 * persisted manual preference, whether the current route is immersive (the
 * lesson flow), and a transient in-lesson reveal. No React, no I/O: the provider
 * owns persistence and route wiring, this owns the rules.
 */
export interface NavChromeState {
  /** Desktop rail preference, persisted. Governs non-immersive screens. */
  manualCollapsed: boolean
  /** Whether the current route hides nav for focus (the lesson flow). */
  immersive: boolean
  /** Transient open during immersion; never persisted, reset on exit. */
  reveal: boolean
}

export type NavChromeAction =
  | { type: "enterImmersive" }
  | { type: "exitImmersive" }
  | { type: "open" }
  | { type: "close" }
  | { type: "toggle" }

/** The lesson flow is immersive: normal lessons, playtests, and completion. */
export function isImmersive(screen: Screen): boolean {
  return (
    screen.name === "lesson" ||
    screen.name === "playtest" ||
    screen.name === "complete"
  )
}

export function initNavChrome(opts: {
  manualCollapsed: boolean
  immersive: boolean
}): NavChromeState {
  return { manualCollapsed: opts.manualCollapsed, immersive: opts.immersive, reveal: false }
}

export function navChromeReducer(
  state: NavChromeState,
  action: NavChromeAction,
): NavChromeState {
  switch (action.type) {
    case "enterImmersive":
      return state.immersive ? state : { ...state, immersive: true, reveal: false }
    case "exitImmersive":
      return !state.immersive ? state : { ...state, immersive: false, reveal: false }
    case "open":
      return state.immersive
        ? { ...state, reveal: true }
        : { ...state, manualCollapsed: false }
    case "close":
      return state.immersive
        ? { ...state, reveal: false }
        : { ...state, manualCollapsed: true }
    case "toggle":
      return state.immersive
        ? { ...state, reveal: !state.reveal }
        : { ...state, manualCollapsed: !state.manualCollapsed }
    default:
      return state
  }
}

/** Whether the desktop rail is currently collapsed (hidden). */
export function railCollapsed(state: NavChromeState): boolean {
  return state.immersive ? !state.reveal : state.manualCollapsed
}
