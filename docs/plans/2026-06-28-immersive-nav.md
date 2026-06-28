# Immersive Navigation (collapse animation + auto-hide in lessons) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the nav a smooth open/close animation and make it auto-hide during the whole lesson flow for maximum immersion, with shells that behave correctly on both widescreen (collapsible left rail) and mobile (bottom pill that condenses to a corner icon).

**Architecture:** A single pure state machine (`navChrome`) derives nav-chrome visibility from three inputs - a persisted manual preference, the current route's immersion, and a transient in-lesson reveal. A thin `NavChromeProvider` (mounted inside `AppShell`, under the existing `NavigationProvider`) runs the reducer, derives immersion from the route, persists the manual preference, and feeds both shells. The desktop rail animates its width (Framer Motion) and exposes a reopen icon + edge-peek sliver while collapsed; the mobile bottom pill condenses to a bottom-right three-line icon during the lesson flow.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Framer Motion (`motion/react`), Vitest + Testing Library. No new dependencies.

---

## Design summary (approved)

**State model.** Nav chrome = function of:
- `manualCollapsed` - desktop rail preference, persisted to `localStorage` (`willow.sidebar.collapsed`). Governs non-immersive screens.
- `immersive` - derived from route. The whole lesson flow is immersive: the `lesson` route (which also hosts the retrieval warm-up) and the `complete` route.
- `reveal` - a transient open during immersion (clicking the reopen icon / sliver). Reset on exit.

Derived: `railCollapsed = immersive ? !reveal : manualCollapsed`. Entering a lesson force-collapses; leaving **restores the pre-lesson state** (because `manualCollapsed` is never touched during immersion); opening mid-lesson is transient.

**Desktop (lg+).** Open/close is a width-collapse: the rail's width animates `260px <-> 0` and the centered content reflows as one (~220-240ms ease-out; `prefers-reduced-motion` => instant). Whenever the rail is collapsed (manual or immersive): a three-line reopen icon (top-left) and an **edge peek** - cursor at the far left edge reveals a thin sliver hint; click the sliver (or the icon) to open. In a lesson, the rail is collapsed on entry; reopen is transient; leaving restores.

**Mobile (<lg).** Tab screens keep the full bottom pill. During the lesson flow only, the pill **condenses to a bottom-right three-line icon**: enter lesson -> condensed icon; tap icon -> pill expands in place; tap anywhere in the lesson (not on the pill) -> re-condense; navigating away restores the full pill. The icon's placement vs the lesson's bottom CTA is a **demo decision** (Task 7): three variants built in the gallery, pick one.

**Out of scope.** The top-bar A/B/C exploration (separate prototype). The lesson top bar (close/progress/flame) stays as-is.

---

## File structure

- Create `src/lib/navChrome.ts` - pure types, reducer, selectors, `isImmersive(screen)`. No React.
- Create `src/lib/navChrome.test.ts` - reducer/selector unit tests (node project).
- Create `src/components/willow/NavChromeProvider.tsx` - context: runs the reducer, derives immersion from `useNavigation()`, persists `manualCollapsed`, exposes `{ collapsed, immersive, toggle, open, close }`.
- Create `src/components/willow/NavChromeProvider.test.tsx` - integration test for route-driven collapse + restore.
- Create `src/components/willow/MobileImmersiveNav.tsx` - the condensed three-line icon <-> bottom pill for immersive mobile.
- Modify `src/components/willow/AppShell.tsx` - wrap children in `NavChromeProvider`; mobile branch renders condensed vs pill from `immersive`.
- Modify `src/components/willow/desktop/DesktopShell.tsx` - consume the provider; animate rail width; render the collapsed reopen icon + edge-peek sliver. (Removes its current local `collapsed` state.)
- Modify `src/dev/NavLab.tsx` - add a "Mobile immersive nav" demo section with 3 placement variants.
- `src/components/willow/desktop/SideNav.tsx` - **unchanged** (already accepts `onCollapse`; the provider now supplies it).

---

## Task 1: Pure `navChrome` state machine

**Files:**
- Create: `src/lib/navChrome.ts`
- Test: `src/lib/navChrome.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/navChrome.test.ts
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
    expect(next.manualCollapsed).toBe(false) // untouched
    expect(railCollapsed(next)).toBe(true) // collapsed for immersion
  })

  it("opening during immersion is transient (reveal), not the manual preference", () => {
    const inLesson = navChromeReducer(open, { type: "enterImmersive" })
    const revealed = navChromeReducer(inLesson, { type: "open" })
    expect(revealed.reveal).toBe(true)
    expect(revealed.manualCollapsed).toBe(false)
    expect(railCollapsed(revealed)).toBe(false) // shown
  })

  it("leaving immersion restores the pre-lesson state and clears reveal", () => {
    const inLesson = navChromeReducer(open, { type: "enterImmersive" })
    const revealed = navChromeReducer(inLesson, { type: "open" })
    const back = navChromeReducer(revealed, { type: "exitImmersive" })
    expect(back.immersive).toBe(false)
    expect(back.reveal).toBe(false)
    expect(railCollapsed(back)).toBe(false) // restored to pre-lesson (open)
  })

  it("a learner who manually collapsed stays collapsed after a lesson", () => {
    const collapsed = navChromeReducer(open, { type: "toggle" }) // manualCollapsed = true
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/navChrome.test.ts`
Expected: FAIL - cannot find module `./navChrome`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/navChrome.ts
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

/** The lesson flow is immersive: the lesson route (incl. retrieval warm-up) and completion. */
export function isImmersive(screen: Screen): boolean {
  return screen.name === "lesson" || screen.name === "complete"
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
      // In a lesson, opening is transient; otherwise it's the saved preference.
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/navChrome.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc -b
git add src/lib/navChrome.ts src/lib/navChrome.test.ts
git commit -m "feat(nav): pure navChrome state machine for immersive nav chrome"
```

---

## Task 2: `NavChromeProvider` (route-driven, persisted)

**Files:**
- Create: `src/components/willow/NavChromeProvider.tsx`
- Test: `src/components/willow/NavChromeProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/willow/NavChromeProvider.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { NavigationProvider, useNavigation } from "@/lib/navigation"
import { NavChromeProvider, useNavChrome } from "./NavChromeProvider"

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
  beforeEach(() => localStorage.clear())

  it("collapses on entering a lesson and restores the pre-lesson state on leaving", async () => {
    mount()
    expect(screen.getByTestId("collapsed").textContent).toBe("false")
    expect(screen.getByTestId("immersive").textContent).toBe("false")

    await userEvent.click(screen.getByText("go-lesson"))
    expect(screen.getByTestId("immersive").textContent).toBe("true")
    expect(screen.getByTestId("collapsed").textContent).toBe("true")

    await userEvent.click(screen.getByText("back"))
    expect(screen.getByTestId("immersive").textContent).toBe("false")
    expect(screen.getByTestId("collapsed").textContent).toBe("false") // restored
  })

  it("persists the manual preference across mounts", async () => {
    const first = mount()
    await userEvent.click(screen.getByText("toggle")) // collapse manually
    expect(screen.getByTestId("collapsed").textContent).toBe("true")
    expect(localStorage.getItem("willow.sidebar.collapsed")).toBe("1")
    first.unmount()

    mount()
    expect(screen.getByTestId("collapsed").textContent).toBe("true")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/willow/NavChromeProvider.test.tsx`
Expected: FAIL - cannot find module `./NavChromeProvider`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/willow/NavChromeProvider.tsx
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react"

import { useNavigation } from "@/lib/navigation"
import {
  initNavChrome,
  isImmersive,
  navChromeReducer,
  railCollapsed,
} from "@/lib/navChrome"

const COLLAPSE_KEY = "willow.sidebar.collapsed"

function readManualCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1"
  } catch {
    return false
  }
}

interface NavChromeValue {
  /** Desktop rail collapsed (derived from manual pref + immersion + reveal). */
  collapsed: boolean
  /** Whether the current route is immersive (the lesson flow). */
  immersive: boolean
  toggle: () => void
  open: () => void
  close: () => void
}

const NavChromeContext = createContext<NavChromeValue | null>(null)

/**
 * Owns nav-chrome state for one app instance: runs the pure reducer, derives
 * immersion from the current route, and persists only the manual preference.
 * Mounted inside AppShell (which is always under NavigationProvider).
 */
export function NavChromeProvider({ children }: { children: ReactNode }) {
  const { screen } = useNavigation()
  const [state, dispatch] = useReducer(
    navChromeReducer,
    { manualCollapsed: readManualCollapsed(), immersive: isImmersive(screen) },
    initNavChrome,
  )

  const immersiveNow = isImmersive(screen)
  useEffect(() => {
    dispatch({ type: immersiveNow ? "enterImmersive" : "exitImmersive" })
  }, [immersiveNow])

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, state.manualCollapsed ? "1" : "0")
    } catch {
      // localStorage may be unavailable; toggling still works for the session.
    }
  }, [state.manualCollapsed])

  const value: NavChromeValue = {
    collapsed: railCollapsed(state),
    immersive: state.immersive,
    toggle: () => dispatch({ type: "toggle" }),
    open: () => dispatch({ type: "open" }),
    close: () => dispatch({ type: "close" }),
  }

  return <NavChromeContext value={value}>{children}</NavChromeContext>
}

export function useNavChrome(): NavChromeValue {
  const ctx = useContext(NavChromeContext)
  if (!ctx) throw new Error("useNavChrome must be used within NavChromeProvider")
  return ctx
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/willow/NavChromeProvider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/willow/NavChromeProvider.tsx src/components/willow/NavChromeProvider.test.tsx
git commit -m "feat(nav): NavChromeProvider derives collapse from route + persists preference"
```

---

## Task 3: Wire the provider into `AppShell` (mobile branch picks condensed vs pill)

**Files:**
- Modify: `src/components/willow/AppShell.tsx`
- Create: `src/components/willow/MobileImmersiveNav.tsx` (placeholder used here; full behavior in Task 6)

- [ ] **Step 1: Create a minimal `MobileImmersiveNav` so AppShell compiles**

```tsx
// src/components/willow/MobileImmersiveNav.tsx
import { Menu } from "lucide-react"

/**
 * Mobile lesson-flow nav: the bottom pill condensed to a corner three-line icon.
 * Full expand/condense behavior is added in Task 6; this is the minimal shell.
 */
export function MobileImmersiveNav() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto flex max-w-md justify-end px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          aria-label="Show navigation"
          className="pointer-events-auto flex size-12 items-center justify-center rounded-2xl border border-border bg-card/90 text-foreground shadow-card backdrop-blur-md"
        >
          <Menu className="size-5" />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `AppShell.tsx` with the provider-wrapped version**

```tsx
// src/components/willow/AppShell.tsx
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { BottomNav } from "@/components/willow/BottomNav"
import { MobileImmersiveNav } from "@/components/willow/MobileImmersiveNav"
import { NavChromeProvider, useNavChrome } from "@/components/willow/NavChromeProvider"
import { DesktopShell } from "@/components/willow/desktop/DesktopShell"
import { useIsDesktop } from "@/hooks/useMediaQuery"

/**
 * The single layout seam. At `lg`+ it renders the DesktopShell (collapsible
 * SideNav + centered capped main). Below `lg` it renders the mobile-first column
 * with a bottom nav that becomes a condensed corner icon during the lesson flow.
 * NavChromeProvider sits here so both shells share one nav-chrome state.
 */
export function AppShell({
  children,
  bottomNav = false,
  className,
}: {
  children: ReactNode
  bottomNav?: boolean
  className?: string
}) {
  return (
    <NavChromeProvider>
      <AppShellInner bottomNav={bottomNav} className={className}>
        {children}
      </AppShellInner>
    </NavChromeProvider>
  )
}

function AppShellInner({
  children,
  bottomNav,
  className,
}: {
  children: ReactNode
  bottomNav: boolean
  className?: string
}) {
  const isDesktop = useIsDesktop()
  const { immersive } = useNavChrome()

  if (isDesktop) {
    return <DesktopShell className={className}>{children}</DesktopShell>
  }

  return (
    <div className="relative mx-auto flex min-h-svh w-full max-w-md flex-col bg-background">
      <div className={cn("flex flex-1 flex-col", className)}>{children}</div>

      {immersive ? (
        <MobileImmersiveNav />
      ) : bottomNav ? (
        <div className="fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto max-w-md px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <BottomNav />
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Action pinned just above the bottom nav (e.g. the tactile Start pill). */
export function PinnedAction({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktop()

  if (isDesktop) {
    return (
      <div className="sticky bottom-6 z-30 mx-auto mt-8 w-full max-w-md">
        {children}
      </div>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30">
      <div className="mx-auto max-w-md px-5 pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+5.5rem))]">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background via-background/90 to-transparent" />
        <div className="pointer-events-auto relative">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run the suite to verify nothing regressed**

Run: `npx vitest run`
Expected: PASS (916+ tests). `PinnedAction` is unchanged; `AppShell` still renders children.

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc -b
git add src/components/willow/AppShell.tsx src/components/willow/MobileImmersiveNav.tsx
git commit -m "feat(nav): AppShell hosts NavChromeProvider and swaps mobile nav for immersion"
```

---

## Task 4: Desktop width-collapse animation in `DesktopShell`

**Files:**
- Modify: `src/components/willow/desktop/DesktopShell.tsx`

- [ ] **Step 1: Replace `DesktopShell.tsx`**

```tsx
// src/components/willow/desktop/DesktopShell.tsx
import type { ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { SideNav } from "@/components/willow/desktop/SideNav"
import { CollapsedReveal } from "@/components/willow/desktop/CollapsedReveal"
import { useNavChrome } from "@/components/willow/NavChromeProvider"

/** Matches --willow-sidebar-w (260px). Animated to 0 when collapsed. */
const RAIL_W = 260

/**
 * The `lg`+ layout: a collapsible left SideNav beside a centered, capped main
 * column. The rail's width animates between RAIL_W and 0 so the content reflows
 * as one. While collapsed, CollapsedReveal provides a reopen icon and an
 * edge-peek sliver. Collapse state comes from NavChromeProvider (manual pref +
 * route immersion). Below `lg`, AppShell renders the mobile column instead.
 */
export function DesktopShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const { collapsed, open, close } = useNavChrome()
  const reduce = useReducedMotion()

  return (
    <div className="flex min-h-svh w-full bg-background">
      <motion.div
        className="relative shrink-0 overflow-hidden"
        initial={false}
        animate={{ width: collapsed ? 0 : RAIL_W }}
        transition={reduce ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden={collapsed}
      >
        <div style={{ width: RAIL_W }} className="h-full">
          <SideNav onCollapse={close} />
        </div>
      </motion.div>

      {collapsed && <CollapsedReveal onOpen={open} reduce={!!reduce} />}

      <main className="relative flex min-w-0 flex-1 flex-col">
        <div
          className={cn(
            "mx-auto flex w-full max-w-[var(--willow-content-max)] flex-1 flex-col px-8 py-8",
            className,
          )}
        >
          {children}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Create a temporary `CollapsedReveal` stub so it compiles (full version in Task 5)**

```tsx
// src/components/willow/desktop/CollapsedReveal.tsx
import { Menu } from "lucide-react"

export function CollapsedReveal({ onOpen }: { onOpen: () => void; reduce: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Show sidebar"
      title="Show sidebar"
      className="fixed left-4 top-4 z-50 flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-card transition-colors hover:bg-muted hover:text-foreground"
    >
      <Menu className="size-5" />
    </button>
  )
}
```

- [ ] **Step 3: Verify in the gallery (manual)**

Run dev gallery (already running on `:5174`, else `npm run gallery`). Open `gallery.html?frame=screen:home` at desktop width; click the rail's three-line (hide) - the rail should smoothly animate to 0 and content reflow; the top-left reopen icon appears; clicking it animates the rail back.

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc -b
git add src/components/willow/desktop/DesktopShell.tsx src/components/willow/desktop/CollapsedReveal.tsx
git commit -m "feat(nav): animate desktop rail width on collapse/expand"
```

---

## Task 5: Desktop collapsed affordances - reopen icon + edge-peek sliver

**Files:**
- Modify: `src/components/willow/desktop/CollapsedReveal.tsx`

- [ ] **Step 1: Replace `CollapsedReveal.tsx` with the full version**

```tsx
// src/components/willow/desktop/CollapsedReveal.tsx
import { Menu } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Shown whenever the desktop rail is collapsed. Two ways back: a persistent
 * three-line reopen icon (top-left), and an edge peek - a thin sliver hint that
 * slides in when the cursor reaches the far left edge; clicking it opens the rail.
 */
export function CollapsedReveal({
  onOpen,
  reduce,
}: {
  onOpen: () => void
  reduce: boolean
}) {
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Show sidebar"
        title="Show sidebar"
        className="fixed left-4 top-4 z-50 flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-card transition-colors hover:bg-muted hover:text-foreground"
      >
        <Menu className="size-5" />
      </button>

      {/* Edge-peek hover zone: a thin sliver hint at the far left edge. */}
      <div className="group fixed inset-y-0 left-0 z-40 w-3">
        <button
          type="button"
          onClick={onOpen}
          aria-label="Show sidebar"
          tabIndex={-1}
          className={cn(
            "absolute inset-y-0 left-0 my-auto h-24 w-1.5 -translate-x-2 rounded-r-full bg-lilac-strong/40 opacity-0",
            "group-hover:translate-x-0 group-hover:opacity-100 hover:bg-lilac-strong/60",
            reduce ? "transition-none" : "transition-all duration-200 ease-out",
          )}
        />
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify in the gallery (manual)**

At desktop width with the rail collapsed: moving the cursor to the far left edge reveals a short lilac sliver; clicking it opens the rail. The top-left icon also opens it. Toggle `prefers-reduced-motion` (OS or DevTools rendering emulation) and confirm the sliver appears instantly with no transition.

- [ ] **Step 3: Commit**

```bash
git add src/components/willow/desktop/CollapsedReveal.tsx
git commit -m "feat(nav): edge-peek sliver + reopen icon for the collapsed desktop rail"
```

---

## Task 6: Mobile condensed immersive nav (icon <-> pill, tap-outside re-condense)

**Files:**
- Modify: `src/components/willow/MobileImmersiveNav.tsx`
- Test: `src/components/willow/MobileImmersiveNav.test.tsx`

User story to satisfy: enter lesson -> condensed three-line icon (bottom-right); tap icon -> the bottom pill expands in place; tap anywhere in the lesson (not on the pill) -> re-condense; navigating to a new screen -> re-condense.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/willow/MobileImmersiveNav.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { NavigationProvider } from "@/lib/navigation"
import { MobileImmersiveNav } from "./MobileImmersiveNav"

function mount() {
  return render(
    <NavigationProvider initial={{ name: "lesson", lessonId: "arrays" }}>
      <MobileImmersiveNav />
    </NavigationProvider>,
  )
}

describe("MobileImmersiveNav", () => {
  it("starts condensed, expands the nav pill on tap, and re-condenses on outside tap", async () => {
    mount()
    // Condensed: the three-line opener is present, the nav pill is not.
    expect(screen.getByRole("button", { name: /show navigation/i })).toBeInTheDocument()
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /show navigation/i }))
    expect(screen.getByRole("navigation")).toBeInTheDocument()

    // Tapping outside the pill (the scrim) re-condenses.
    await userEvent.click(screen.getByRole("button", { name: /close navigation/i }))
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /show navigation/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/willow/MobileImmersiveNav.test.tsx`
Expected: FAIL - the stub has no expand/condense behavior (no "navigation" role appears).

- [ ] **Step 3: Replace `MobileImmersiveNav.tsx` with the full version**

```tsx
// src/components/willow/MobileImmersiveNav.tsx
import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Menu } from "lucide-react"

import { useNavigation } from "@/lib/navigation"
import { BottomNav } from "@/components/willow/BottomNav"

/**
 * Mobile lesson-flow nav. The bottom pill condenses to a bottom-right three-line
 * icon for immersion; tapping it expands the real BottomNav pill in place;
 * tapping anywhere else (the scrim) or navigating re-condenses.
 */
export function MobileImmersiveNav() {
  const { screen } = useNavigation()
  const reduce = useReducedMotion()
  const [expanded, setExpanded] = useState(false)

  // Re-condense when the route changes (advancing a beat, or leaving the lesson).
  useEffect(() => setExpanded(false), [screen])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
      <AnimatePresence>
        {expanded && (
          <motion.button
            key="scrim"
            type="button"
            aria-label="Close navigation"
            onClick={() => setExpanded(false)}
            className="pointer-events-auto fixed inset-0 -z-10"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0 }}
          />
        )}
      </AnimatePresence>

      <div className="mx-auto flex max-w-md justify-end px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <AnimatePresence initial={false} mode="popLayout">
          {expanded ? (
            <motion.div
              key="pill"
              className="pointer-events-auto w-full"
              initial={reduce ? false : { opacity: 0, scale: 0.92, x: 48 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, x: 48 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
            >
              <BottomNav />
            </motion.div>
          ) : (
            <motion.button
              key="fab"
              type="button"
              onClick={() => setExpanded(true)}
              aria-label="Show navigation"
              className="pointer-events-auto flex size-12 items-center justify-center rounded-2xl border border-border bg-card/90 text-foreground shadow-card backdrop-blur-md"
              initial={reduce ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
            >
              <Menu className="size-5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/willow/MobileImmersiveNav.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/willow/MobileImmersiveNav.tsx src/components/willow/MobileImmersiveNav.test.tsx
git commit -m "feat(nav): mobile immersive nav condenses the pill to a corner icon"
```

---

## Task 7: Demo the mobile icon placement variants (decision gate)

The bottom-right icon can clash with the lesson's full-width CTA. Build three variants in the gallery, screenshot at a phone viewport, and pick one before finalizing `MobileImmersiveNav`'s placement.

**Files:**
- Modify: `src/dev/NavLab.tsx`

- [ ] **Step 1: Add a "Mobile immersive nav" section to `NavLab` with three variants**

Append inside `NavLab`'s returned list (after the existing top-bar frames). Each variant is a phone-sized frame showing a stand-in lesson footer CTA plus the condensed icon in a different relationship to it.

```tsx
// Add to src/dev/NavLab.tsx (helpers + a new section)

function PhoneFrame({ label, note, children }: { label: string; note: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-sm font-bold text-lilac-strong">{label}</h3>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <div className="relative mx-auto h-[340px] w-[300px] overflow-hidden rounded-3xl border border-border bg-background shadow-card">
        <div className="px-5 pt-6">
          <h2 className="text-lg font-bold text-foreground">Predict the result</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tap the cell that leaves first.</p>
          <div className="mt-4 h-28 rounded-2xl border border-border bg-card" />
        </div>
        {children}
      </div>
    </section>
  )
}

function FabIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-12 items-center justify-center rounded-2xl border border-border bg-card/90 text-foreground shadow-card backdrop-blur-md",
        className,
      )}
    >
      <Menu className="size-5" />
    </span>
  )
}

function CtaPill({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-soft",
        className,
      )}
    >
      Continue
    </div>
  )
}

function MobilePlacementVariants() {
  return (
    <div className="grid grid-cols-1 gap-7 sm:grid-cols-3">
      <PhoneFrame label="Variant 1" note="Icon floats clear ABOVE the full-width CTA">
        <div className="absolute inset-x-4 bottom-4">
          <div className="mb-3 flex justify-end">
            <FabIcon />
          </div>
          <CtaPill />
        </div>
      </PhoneFrame>

      <PhoneFrame label="Variant 2" note="Icon inline at the end of the CTA row (CTA shrinks)">
        <div className="absolute inset-x-4 bottom-4 flex items-center gap-2">
          <CtaPill className="flex-1" />
          <FabIcon />
        </div>
      </PhoneFrame>

      <PhoneFrame label="Variant 3" note="Icon pinned bottom-right, semi-transparent over the CTA corner">
        <div className="absolute inset-x-4 bottom-4">
          <CtaPill />
        </div>
        <div className="absolute bottom-4 right-4">
          <FabIcon className="bg-card/70" />
        </div>
      </PhoneFrame>
    </div>
  )
}
```

Then render it inside the `NavLab` return, e.g. after the last `Frame`:

```tsx
      <Frame label="Mobile" note="Condensed nav icon vs the lesson CTA, three placements to choose from">
        <div className="p-5">
          <MobilePlacementVariants />
        </div>
      </Frame>
```

Ensure `Menu` is imported in `NavLab.tsx`:

```tsx
import { BarChart3, BookOpen, Home, Menu, Search, Settings, type LucideIcon } from "lucide-react"
```

- [ ] **Step 2: Screenshot for review**

Write a throwaway Playwright script (per `.agents/skills/willow-feature-design`) that opens the gallery, expands "User Experience", clicks "Nav layouts", and screenshots the `main` element at a tall viewport into `docs/reference/mobile-nav-variants.png`. View it, pick a variant.

- [ ] **Step 3: Apply the chosen placement to `MobileImmersiveNav`**

Adjust the wrapper in `MobileImmersiveNav.tsx` to match the chosen variant (default in Task 6 is Variant 1 - icon clear above the CTA via `justify-end` + bottom padding). If Variant 2/3 is chosen, update the container accordingly. Re-run `npx vitest run src/components/willow/MobileImmersiveNav.test.tsx` (the behavior test is placement-agnostic and should still pass).

- [ ] **Step 4: Commit**

```bash
git add src/dev/NavLab.tsx src/components/willow/MobileImmersiveNav.tsx
git commit -m "feat(nav): demo mobile placement variants; apply chosen placement"
```

---

## Task 8: Final verification + reference screenshots

**Files:** none (verification only).

- [ ] **Step 1: Typecheck, lint, full tests**

Run: `npx tsc -b && npm run lint && npm test`
Expected: tsc clean; lint shows only pre-existing warnings; all tests pass.

- [ ] **Step 2: Capture reference states**

Throwaway Playwright script capturing into `docs/reference/`:
- desktop rail expanded vs collapsed (`screen:home`)
- a lesson at desktop width (rail auto-collapsed) - `frame=lab:<a lesson preset>` or `screen` flow
- mobile lesson with the condensed icon, and expanded pill
- light + dark

Curate per `.cursor/rules/use-playwright.mdc` (one file per state; delete the throwaway script after).

- [ ] **Step 3: Commit any screenshot updates**

```bash
git add docs/reference
git commit -m "docs(nav): reference screenshots for immersive nav states"
```

---

## Verification checklist (maps to the design)

- [ ] Desktop rail collapse/expand is a smooth width animation; content reflows as one; reduced-motion is instant.
- [ ] Whenever collapsed: top-left reopen icon AND left-edge sliver both open the rail.
- [ ] Entering any lesson-flow screen (`lesson`, `complete`) auto-collapses the rail; opening it there is transient; leaving restores the pre-lesson state (open stays open, collapsed stays collapsed).
- [ ] Manual collapse persists across reloads; immersion does not overwrite it.
- [ ] Mobile tab screens keep the full pill; lesson-flow screens show the condensed corner icon.
- [ ] Mobile: tap icon -> pill expands; tap outside / navigate -> re-condense.
- [ ] Chosen mobile placement does not clash with the lesson CTA.
- [ ] Desktop reopen icon (top-left) does not collide with the lesson top bar's close (X) at common desktop widths; if it does at narrow widths, nudge its position.

## Notes / known follow-ups

- The "pill slides right and condenses" cross-route morph is approximated by the FAB's entrance animation (a true shared-element morph across a route change is out of scope; revisit only if the demo shows it's worth it).
- Top-bar nav direction (A/B/C) remains a separate prototype, untouched here.
