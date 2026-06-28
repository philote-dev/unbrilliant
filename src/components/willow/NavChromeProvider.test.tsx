import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { NavigationProvider, useNavigation } from "@/lib/navigation"
import { NavChromeProvider, useNavChrome } from "./NavChromeProvider"

// Node.js 22+ has a built-in localStorage that requires --localstorage-file.
// Stub it with a simple in-memory map for the jsdom test environment.
const store = new Map<string, string>()
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
  get length() { return store.size },
  key: (i: number) => [...store.keys()][i] ?? null,
})

function Probe() {
  const { collapsed, immersive, toggle } = useNavChrome()
  const { navigate, back } = useNavigation()
  return (
    <div>
      <span data-testid="collapsed">{String(collapsed)}</span>
      <span data-testid="immersive">{String(immersive)}</span>
      <button onClick={toggle}>toggle</button>
      <button onClick={() => navigate({ name: "lesson", lessonId: "arrays" })}>go-lesson</button>
      <button onClick={back}>back</button>
    </div>
  )
}

function mount() {
  return render(
    <NavigationProvider initial={{ name: "home" }}>
      <NavChromeProvider>
        <Probe />
      </NavChromeProvider>
    </NavigationProvider>,
  )
}

describe("NavChromeProvider", () => {
  beforeEach(() => store.clear())
  afterAll(() => vi.unstubAllGlobals())

  it("collapses on entering a lesson and restores the pre-lesson state on leaving", async () => {
    mount()
    expect(screen.getByTestId("collapsed").textContent).toBe("false")
    expect(screen.getByTestId("immersive").textContent).toBe("false")

    await userEvent.click(screen.getByText("go-lesson"))
    expect(screen.getByTestId("immersive").textContent).toBe("true")
    expect(screen.getByTestId("collapsed").textContent).toBe("true")

    await userEvent.click(screen.getByText("back"))
    expect(screen.getByTestId("immersive").textContent).toBe("false")
    expect(screen.getByTestId("collapsed").textContent).toBe("false")
  })

  it("persists the manual preference across mounts", async () => {
    const first = mount()
    await userEvent.click(screen.getByText("toggle"))
    expect(screen.getByTestId("collapsed").textContent).toBe("true")
    expect(localStorage.getItem("willow.sidebar.collapsed")).toBe("1")
    first.unmount()

    mount()
    expect(screen.getByTestId("collapsed").textContent).toBe("true")
  })
})
