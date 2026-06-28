import { describe, it, expect, vi } from "vitest"

/**
 * motion/react is mocked so AnimatePresence is a passthrough fragment and motion
 * elements are plain DOM elements. This keeps the test deterministic without
 * timers: exits are synchronous and we never need to wait for animation frames.
 */
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>()
  const React = await import("react")

  const AnimatePresence = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)

  const makeMotion =
    (tag: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ children, ...props }: any) => {
      const {
        initial: _i,
        animate: _a,
        exit: _e,
        transition: _t,
        layout: _l,
        layoutId: _lid,
        ...rest
      } = props
      return React.createElement(tag, rest, children)
    }

  return {
    ...actual,
    useReducedMotion: () => true,
    AnimatePresence,
    motion: new Proxy(
      {},
      {
        get: (_target, tag: string) => makeMotion(tag),
      },
    ),
  }
})

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { NavigationProvider } from "@/lib/navigation"
import { NavChromeProvider } from "@/components/willow/NavChromeProvider"
import { MobileImmersiveNav } from "./MobileImmersiveNav"

function mount() {
  return render(
    <NavigationProvider initial={{ name: "lesson", lessonId: "arrays" }}>
      <NavChromeProvider>
        <MobileImmersiveNav />
      </NavChromeProvider>
    </NavigationProvider>,
  )
}

describe("MobileImmersiveNav", () => {
  it("starts condensed, expands the nav pill on tap, and re-condenses on outside tap", async () => {
    mount()
    // Condensed: the three-line opener is visible, the nav is not.
    expect(screen.getByRole("button", { name: /show navigation/i })).toBeInTheDocument()
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()

    // Tap the three-line icon to expand.
    await userEvent.click(screen.getByRole("button", { name: /show navigation/i }))
    expect(screen.getByRole("navigation")).toBeInTheDocument()

    // Tap the scrim to re-condense.
    await userEvent.click(screen.getByRole("button", { name: /close navigation/i }))
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /show navigation/i })).toBeInTheDocument()
  })
})
