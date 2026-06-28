import { describe, expect, it } from "vitest"

import {
  initNavChrome,
  isImmersive,
  navChromeReducer,
  railCollapsed,
  type NavChromeState,
} from "./navChrome"

describe("isImmersive", () => {
  it("treats the lesson flow (lesson + complete) as immersive, nothing else", () => {
    expect(isImmersive({ name: "lesson", lessonId: "arrays" })).toBe(true)
    expect(isImmersive({ name: "complete", lessonId: "arrays" })).toBe(true)
    expect(isImmersive({ name: "home" })).toBe(false)
    expect(isImmersive({ name: "settings" })).toBe(false)
    expect(isImmersive({ name: "course", courseId: "data-structures" })).toBe(false)
  })
})

describe("navChromeReducer", () => {
  const open: NavChromeState = { manualCollapsed: false, immersive: false, reveal: false }

  it("manual toggle flips the persisted preference off-immersion", () => {
    const next = navChromeReducer(open, { type: "toggle" })
    expect(next.manualCollapsed).toBe(true)
    expect(railCollapsed(next)).toBe(true)
  })

  it("entering immersion collapses without touching the manual preference", () => {
    const next = navChromeReducer(open, { type: "enterImmersive" })
    expect(next.immersive).toBe(true)
    expect(next.manualCollapsed).toBe(false)
    expect(railCollapsed(next)).toBe(true)
  })

  it("opening during immersion is transient (reveal), not the manual preference", () => {
    const inLesson = navChromeReducer(open, { type: "enterImmersive" })
    const revealed = navChromeReducer(inLesson, { type: "open" })
    expect(revealed.reveal).toBe(true)
    expect(revealed.manualCollapsed).toBe(false)
    expect(railCollapsed(revealed)).toBe(false)
  })

  it("leaving immersion restores the pre-lesson state and clears reveal", () => {
    const inLesson = navChromeReducer(open, { type: "enterImmersive" })
    const revealed = navChromeReducer(inLesson, { type: "open" })
    const back = navChromeReducer(revealed, { type: "exitImmersive" })
    expect(back.immersive).toBe(false)
    expect(back.reveal).toBe(false)
    expect(railCollapsed(back)).toBe(false)
  })

  it("a learner who manually collapsed stays collapsed after a lesson", () => {
    const collapsed = navChromeReducer(open, { type: "toggle" })
    const inLesson = navChromeReducer(collapsed, { type: "enterImmersive" })
    const back = navChromeReducer(inLesson, { type: "exitImmersive" })
    expect(railCollapsed(back)).toBe(true)
  })

  it("close during immersion hides a revealed rail again", () => {
    const inLesson = navChromeReducer(open, { type: "enterImmersive" })
    const revealed = navChromeReducer(inLesson, { type: "open" })
    const hidden = navChromeReducer(revealed, { type: "close" })
    expect(hidden.reveal).toBe(false)
    expect(railCollapsed(hidden)).toBe(true)
  })

  it("initNavChrome seeds reveal=false from the given inputs", () => {
    expect(initNavChrome({ manualCollapsed: true, immersive: true })).toEqual({
      manualCollapsed: true,
      immersive: true,
      reveal: false,
    })
  })

  it("enterImmersive is a no-op (same reference) when already immersive", () => {
    const inLesson = navChromeReducer(open, { type: "enterImmersive" })
    expect(navChromeReducer(inLesson, { type: "enterImmersive" })).toBe(inLesson)
  })

  it("exitImmersive is a no-op (same reference) when not immersive", () => {
    expect(navChromeReducer(open, { type: "exitImmersive" })).toBe(open)
  })

  it("toggle off-immersion works symmetrically (open -> collapsed -> open)", () => {
    const collapsed = navChromeReducer(open, { type: "toggle" })
    expect(collapsed.manualCollapsed).toBe(true)
    const reopened = navChromeReducer(collapsed, { type: "toggle" })
    expect(reopened.manualCollapsed).toBe(false)
    expect(railCollapsed(reopened)).toBe(false)
  })
})
