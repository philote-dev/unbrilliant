# Landing + branding pivot to algorithmic thinking (with "Willow" load-in) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- Date: 2026-06-24
- Spec: `docs/plans/specs/2026-06-24-landing-algorithmic-thinking-pivot-design.md`
- Branch: recommend a fresh `feat/landing-algorithmic-thinking-pivot` off the current branch.

**Goal:** Reposition Willow's outward-facing copy so it reads as an algorithmic-thinking app whose first live track is Data Structures, and add a calm branded "Willow" load-in that plays once per session before the first-run vision landing.

**Architecture:** A pure session-gate helper (`shouldShowSplash` / `markSplashShown`, backed by `sessionStorage`) decides whether the load-in plays; a self-contained `Splash` component owns the one-shot `motion/react` timeline and a single idempotent `onDone`; `VisionHome` renders `<Splash>` on the vision path then reveals the existing landing and moves focus to its heading. Everything else is a targeted copy pass plus a dev-gallery story and one Playwright assertion set.

**Tech Stack:** React 19, TypeScript (strict, `import type`), Vite 8, Tailwind CSS v4 (semantic tokens only), `motion/react` (Framer Motion), Vitest, Playwright.

---

## Architecture decisions (resolved)

1. **Positioning A.** The landing headline names the mission ("algorithmic thinking"); data structures becomes "where we start". A faint `Data Structures · Algorithms · Probability` roadmap row under the CTA makes the breadth read instantly. The CTA stays "Choose a course"; the landing stays mark-only (the wordmark is the splash's job).
2. **Animation A (calm cross-fade).** The word "Willow" fades, scales, and de-blurs in (about 0.72s), holds (about 0.77s), then lifts and fades out (about 0.53s); then `VisionHome` swaps to the landing, whose existing entrance (tree spring, copy stagger) plays on mount. Total splash beat about 2.02s. Built with `motion/react`.
3. **Dedicated component + pure gate.** New `src/components/willow/Splash.tsx` (self-contained timeline, calls `onDone`) and new `src/features/home/splash.ts` (`shouldShowSplash(storage)` / `markSplashShown(storage)`, key `"willow.splashShown"` in `sessionStorage`). `VisionHome` reads the gate once on mount; when true it renders `<Splash onDone=...>`, otherwise the landing directly. No router screen; no phase state folded into `VisionHome`.
4. **Splash behavior.** Vision path only, once per session. Tap, click, or any key skips to the handoff. `prefers-reduced-motion` (via `useReducedMotion`) renders no beat: the component calls `onDone` on mount and renders nothing. On handoff, `VisionHome` moves focus to the landing heading; the wordmark carries `aria-label="Willow"`.
5. **Em-dash guard scope (important).** `src/features/home/`, `src/components/willow/Splash.tsx`, `src/screens/*.tsx`, `index.html`, `README.md`, and this plan file under `docs/**/*.md` are all scanned by `src/__tests__/no-em-dash.test.ts`. `src/features/progress/` and `src/dev/` are excluded but still keep them clean. Never use U+2014 anywhere. The interpunct `·` is fine.
6. **Leave alone.** `src/lessons/catalog.ts` titles/subtitles, `src/screens/SignIn.tsx`, code comments, and test/dev fixtures. No new courses, lessons, logo redesign, or product mechanics. `catalog.test.ts` stays green.

---

## Ordered tasks

### T1. Pure session gate (`shouldShowSplash` / `markSplashShown`)

**Files:**
- Create: `src/features/home/splash.ts`
- Test: `src/features/home/splash.test.ts`

- [ ] **Step 1: Write the failing test**

`src/features/home/splash.test.ts`:

```ts
import { describe, it, expect } from "vitest"

import { markSplashShown, shouldShowSplash } from "./splash"

/** Minimal in-memory stand-in for the `getItem` / `setItem` slice we use. */
function fakeStorage(): Pick<Storage, "getItem" | "setItem"> {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v)
    },
  }
}

describe("splash session gate", () => {
  it("shows on a fresh session", () => {
    expect(shouldShowSplash(fakeStorage())).toBe(true)
  })

  it("does not show after it is marked shown", () => {
    const s = fakeStorage()
    markSplashShown(s)
    expect(shouldShowSplash(s)).toBe(false)
  })

  it("reading is idempotent (does not mark it shown)", () => {
    const s = fakeStorage()
    expect(shouldShowSplash(s)).toBe(true)
    expect(shouldShowSplash(s)).toBe(true)
  })

  it("independent storages do not leak", () => {
    const a = fakeStorage()
    const b = fakeStorage()
    markSplashShown(a)
    expect(shouldShowSplash(a)).toBe(false)
    expect(shouldShowSplash(b)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/features/home/splash.test.ts`
Expected: FAIL with a resolve error like `Failed to resolve import "./splash"` (the module does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

`src/features/home/splash.ts`:

```ts
/**
 * The once-per-session gate for the branded load-in. Pure and storage-injected
 * so it is unit-testable without rendering. The real call sites pass
 * `sessionStorage`; the splash plays at most once per browser session.
 */
const SPLASH_KEY = "willow.splashShown"

type SplashStorage = Pick<Storage, "getItem" | "setItem">

/** True the first time this session; false once `markSplashShown` has run. */
export function shouldShowSplash(storage: SplashStorage): boolean {
  try {
    return storage.getItem(SPLASH_KEY) !== "1"
  } catch {
    // Storage can throw (private mode). Degrade to never showing the beat.
    return false
  }
}

/** Record that the load-in has played for this session. */
export function markSplashShown(storage: SplashStorage): void {
  try {
    storage.setItem(SPLASH_KEY, "1")
  } catch {
    // Storage unavailable: no-op. The splash simply will not gate this session.
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/features/home/splash.test.ts`
Expected: PASS. `Test Files  1 passed (1)`, `Tests  4 passed (4)`.

- [ ] **Step 5: Commit**

```bash
git add src/features/home/splash.ts src/features/home/splash.test.ts
git commit -m "feat(home): session-gated splash helper"
```

---

### T2. The `Splash` load-in component

**Files:**
- Create: `src/components/willow/Splash.tsx`

No new unit test: per the spec we do not assert `motion/react` frame-by-frame. Behavior (plays, skips, reduced-motion handoff) is proven by the Playwright set in T6 and reviewed in the gallery in T5. This task is verified by typecheck.

- [ ] **Step 1: Write the component**

`src/components/willow/Splash.tsx`:

```tsx
import { useCallback, useEffect, useRef } from "react"
import { motion, useReducedMotion } from "motion/react"

/**
 * The calm "Willow" load-in. Plays once before the first-run vision landing: the
 * wordmark fades, scales, and de-blurs in, holds, then lifts and fades out, and
 * calls `onDone`. Tap, click, or any key skips straight to the handoff. Under
 * `prefers-reduced-motion` there is no beat: it calls `onDone` on mount and
 * renders nothing. Owns one timeline and a single, idempotent `onDone`.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion() ?? false
  const done = useRef(false)

  const finish = useCallback(() => {
    if (done.current) return
    done.current = true
    onDone()
  }, [onDone])

  // Reduced motion: snap straight to the landing, no splash beat.
  useEffect(() => {
    if (reduce) finish()
  }, [reduce, finish])

  // Any key skips. (Pointer skip is handled by the overlay's onClick.)
  useEffect(() => {
    if (reduce) return
    const onKey = () => finish()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [reduce, finish])

  if (reduce) return null

  return (
    <motion.div
      data-testid="willow-splash"
      role="presentation"
      onClick={finish}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
    >
      <motion.span
        aria-label="Willow"
        className="text-5xl font-semibold tracking-tight text-lilac-strong"
        initial={{ opacity: 0, scale: 0.92, filter: "blur(5px)", y: 0 }}
        animate={{
          opacity: [0, 1, 1, 0],
          scale: [0.92, 1, 1, 1],
          filter: ["blur(5px)", "blur(0px)", "blur(0px)", "blur(0px)"],
          y: [0, 0, 0, -22],
        }}
        transition={{
          duration: 2.02,
          times: [0, 0.36, 0.74, 1],
          ease: ["easeOut", "linear", "easeIn"],
        }}
        onAnimationComplete={finish}
      >
        Willow
      </motion.span>
    </motion.div>
  )
}
```

- [ ] **Step 2: Verify it typechecks and existing tests stay green**

Run: `npm run build`
Expected: `tsc -b` passes (no type errors) and `vite build` prints `built in ...`.

Run: `npm test`
Expected: all green, including the `no em dash` entry for `/src/components/willow/Splash.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/willow/Splash.tsx
git commit -m "feat(home): Willow load-in splash component"
```

---

### T3. Wire the splash into `VisionHome`

**Files:**
- Modify: `src/screens/Home.tsx` (imports near lines 1-25; `VisionHome` at lines 43-99)

This task adds the gate, the splash render, and the focus handoff. It keeps the current landing copy unchanged (the copy pass is T4), so the diff is purely structural.

- [ ] **Step 1: Add the imports**

At the top of `src/screens/Home.tsx`, add a React import line and the two splash imports. After this step the first import lines read:

```tsx
import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowRight } from "lucide-react"
import { motion } from "motion/react"

import { useNavigation } from "@/lib/navigation"
import { Button } from "@/components/ui/button"
import { WillowLogo, WillowMark } from "@/components/willow/Logo"
import { Splash } from "@/components/willow/Splash"
```

And alongside the existing `homeMode` import add:

```tsx
import { homeMode } from "@/features/home/homeMode"
import { markSplashShown, shouldShowSplash } from "@/features/home/splash"
```

- [ ] **Step 2: Replace the `VisionHome` function body**

Replace the entire `VisionHome` function (currently lines 43-99) with this. Note: copy strings are unchanged here on purpose; the heading gains `ref` + `tabIndex={-1}` so it can receive focus on handoff.

```tsx
function VisionHome() {
  const { navigate } = useNavigation()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [showSplash, setShowSplash] = useState(() => shouldShowSplash(sessionStorage))
  const splashRan = useRef(showSplash)

  const handleSplashDone = useCallback(() => {
    markSplashShown(sessionStorage)
    setShowSplash(false)
  }, [])

  // After a splash handoff, move focus to the heading so keyboard and screen
  // reader users land on the landing, not back at the top of the document.
  useEffect(() => {
    if (!showSplash && splashRan.current) {
      splashRan.current = false
      headingRef.current?.focus()
    }
  }, [showSplash])

  if (showSplash) return <Splash onDone={handleSplashDone} />

  return (
    <div className="flex min-h-svh flex-1 flex-col items-center justify-center px-6 pb-24 text-center lg:min-h-0 lg:pb-0">
      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 170, damping: 15 }}
      >
        <WillowMark className="size-28" />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mt-6 text-sm font-semibold uppercase tracking-wide text-lilac-strong"
      >
        Learn by doing
      </motion.p>
      <motion.h1
        ref={headingRef}
        tabIndex={-1}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-2 text-[32px] font-bold leading-tight text-foreground outline-none"
      >
        Build real intuition for data structures.
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="mt-3 max-w-xs text-[15px] text-muted-foreground"
      >
        Tap, predict, and watch each rule unfold. One interactive lesson at a time.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-10 w-full max-w-xs"
      >
        <Button
          variant="tactile"
          size="lg"
          className="w-full"
          onClick={() => navigate({ name: "courses" })}
        >
          Choose a course
          <ArrowRight className="size-5" />
        </Button>
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 3: Verify build + tests**

Run: `npm run build`
Expected: typecheck and build succeed.

Run: `npm test`
Expected: all green (Home.tsx stays em-dash clean).

- [ ] **Step 4: Manual smoke (optional but recommended)**

Run: `npm run dev`, open the app in a fresh tab. Expected: the "Willow" word fades in, holds, lifts away, then the landing appears; a reload in the same tab shows the landing with no beat; clicking or pressing a key during the beat skips to the landing.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Home.tsx
git commit -m "feat(home): play the splash before the vision landing"
```

---

### T4. Copy pass to algorithmic-thinking positioning

**Files:**
- Modify: `src/screens/Home.tsx` (`VisionHome` landing copy + new roadmap row)
- Modify: `index.html` (title + description + Open Graph + Twitter)
- Modify: `src/screens/ChooseCourse.tsx` (subcopy; render on mobile too)
- Modify: `src/screens/Settings.tsx` (footer tagline)
- Modify: `src/screens/Profile.tsx` (two footer taglines)
- Modify: `README.md` (intro line)

- [ ] **Step 1: Home headline**

In `src/screens/Home.tsx`, change the `<motion.h1>` text:

Before:
```tsx
        Build real intuition for data structures.
```
After:
```tsx
        Build real intuition for algorithmic thinking.
```

- [ ] **Step 2: Home subcopy**

In the same file, change the subcopy `<motion.p>` text:

Before:
```tsx
        Tap, predict, and watch each rule unfold. One interactive lesson at a time.
```
After:
```tsx
        Tap, predict, and watch each idea click into place. We start with data
        structures, one interactive lesson at a time.
```

- [ ] **Step 3: Home roadmap row**

In the same file, immediately after the CTA `<motion.div>` (the block that closes with `</motion.div>` right before the landing's closing `</div>`), add a faint roadmap row. Data Structures is emphasized in lilac-strong; the rest is faint:

```tsx
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="mt-6 text-xs font-medium text-faint"
      >
        <span className="text-lilac-strong">Data Structures</span> · Algorithms ·
        Probability
      </motion.p>
```

- [ ] **Step 4: App metadata in `index.html`**

Replace the `<title>` line and add metadata. The `<head>` becomes:

```html
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Willow: learn algorithmic thinking by doing</title>
    <meta
      name="description"
      content="Learn algorithmic thinking by doing. Tap, predict, and build real intuition, no memorizing and no jargon. Starting with data structures."
    />
    <meta property="og:title" content="Willow: learn algorithmic thinking by doing" />
    <meta
      property="og:description"
      content="Learn algorithmic thinking by doing. Tap, predict, and build real intuition, no memorizing and no jargon. Starting with data structures."
    />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="/favicon.svg" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="Willow: learn algorithmic thinking by doing" />
    <meta
      name="twitter:description"
      content="Learn algorithmic thinking by doing. Tap, predict, and build real intuition, no memorizing and no jargon. Starting with data structures."
    />
    <meta name="twitter:image" content="/favicon.svg" />
  </head>
```

(The real share image is out of scope; `/favicon.svg` is the placeholder slot.)

- [ ] **Step 5: Choose-a-course subcopy (and show on mobile)**

In `src/screens/ChooseCourse.tsx`, replace the desktop-only subcopy (currently lines 24-26):

Before:
```tsx
      <p className="mt-1 hidden text-sm text-muted-foreground lg:block">
        Pick a track and start building real intuition.
      </p>
```
After:
```tsx
      <p className="mt-1 text-sm text-muted-foreground">
        Learn to think in algorithms, by doing. Start with data structures and grow from there.
      </p>
```

- [ ] **Step 6: Footer taglines (3 places)**

Replace every occurrence of this exact line in `src/screens/Settings.tsx` (line 53) and `src/screens/Profile.tsx` (lines 25 and 52):

Before:
```tsx
        Willow · learn-by-doing data structures
```
After:
```tsx
        Willow · algorithmic thinking, by doing
```

- [ ] **Step 7: README intro**

In `README.md`, replace the first body line:

Before:
```md
A mobile-first, **deterministic, no-AI** "learn data structures by doing" web app.
```
After:
```md
A mobile-first, **deterministic, no-AI** "learn algorithmic thinking by doing" web app. The first track, Data Structures, is live; Algorithms and Probability are on the way.
```

- [ ] **Step 8: Verify build + tests (em-dash guard included)**

Run: `npm test`
Expected: all green. The `no em dash (U+2014)` suite passes for `src/screens/Home.tsx`, `src/screens/ChooseCourse.tsx`, `src/screens/Settings.tsx`, `src/screens/Profile.tsx`, `index.html`, `README.md`, and this plan doc. `catalog.test.ts` stays green (catalog untouched).

Run: `npm run build`
Expected: typecheck + build succeed.

- [ ] **Step 9: Commit**

```bash
git add src/screens/Home.tsx index.html src/screens/ChooseCourse.tsx src/screens/Settings.tsx src/screens/Profile.tsx README.md
git commit -m "feat(branding): reposition copy to algorithmic thinking"
```

---

### T5. Dev-gallery Splash story (with replay)

**Files:**
- Modify: `src/dev/GalleryApp.tsx`

`src/dev/` is excluded from the em-dash guard but keep it clean. The `Splash` uses `position: fixed`; inside `PhoneFrame` (which sets `transform`, making it the containing block) the overlay is clipped to the 390px frame.

- [ ] **Step 1: Import `Splash`**

Add near the other `@/components/willow/...` imports in `src/dev/GalleryApp.tsx`:

```tsx
import { Splash } from "@/components/willow/Splash"
```

- [ ] **Step 2: Extend the `Selection` union**

Add a `splash` variant:

```tsx
  | { kind: "metrics"; id: "a" | "b" | "c" | "d" }
  | { kind: "page"; id: "progress" }
  | { kind: "splash" }
```

- [ ] **Step 3: Extend `selectionKey` and `selectionTitle`**

In `selectionKey`, add before the final `return`:

```tsx
  if (sel.kind === "page") return `page:${sel.id}`
  if (sel.kind === "splash") return "splash"
  return `lab:${sel.id}`
```

In `selectionTitle`, add before the final `return`:

```tsx
  if (sel.kind === "page") return "Progress page"
  if (sel.kind === "splash") return "Splash (load-in)"
  return LABS.find((l) => l.id === sel.id)?.title ?? sel.id
```

- [ ] **Step 4: Extend the `hint` ternary**

Replace the `hint` assignment in `Gallery` so the splash gets its own hint:

```tsx
  const hint =
    selected.kind === "lab"
      ? "Tap a state chip to jump; the stage stays live so you can also play from there."
      : selected.kind === "metrics"
        ? "Presentational metric tiles, shown at phone width on the themed surface."
        : selected.kind === "page"
          ? "The assembled Progress page (mock data): populated and new-user, both tabs."
          : selected.kind === "splash"
            ? "The branded load-in. Replay to watch the timeline; it is clipped to the phone frame."
            : "Live screen rendered in a phone frame."
```

- [ ] **Step 5: Add a "Brand" sidebar group**

After the existing `Progress page` `NavGroup` block in the sidebar, add:

```tsx
          <NavGroup title="Brand">
            <NavItem
              active={key === "splash"}
              onClick={() => setSelected({ kind: "splash" })}
            >
              Splash
            </NavItem>
          </NavGroup>
```

- [ ] **Step 6: Render `SplashLab` from the main switch**

In the main render ternary, add a branch after the `page` branch:

```tsx
            ) : selected.kind === "page" ? (
              <ProgressPageLab />
            ) : selected.kind === "splash" ? (
              <SplashLab />
```

- [ ] **Step 7: Add the `SplashLab` component**

Add near `ProgressPageLab` (end of the file):

```tsx
/* ------------------------------- splash load-in ---------------------------- */

/**
 * The branded load-in in isolation. The Splash is `position: fixed`, so it is
 * clipped to the PhoneFrame (the frame is the containing block via `transform`).
 * Replay remounts it. The real hook honors the viewer's reduced-motion setting,
 * so a reduced-motion machine sees the instant handoff instead of the beat.
 */
function SplashLab() {
  const [runId, setRunId] = useState(0)
  const [done, setDone] = useState(false)
  return (
    <div className="flex h-full flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => {
          setDone(false)
          setRunId((n) => n + 1)
        }}
        className="shrink-0 rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700"
      >
        Replay
      </button>
      <PhoneFrame className="h-[860px] shrink-0">
        <div className="relative flex min-h-full items-center justify-center p-6 text-center">
          {done ? (
            <p className="text-sm text-muted-foreground">Handed off to the landing.</p>
          ) : (
            <Splash key={runId} onDone={() => setDone(true)} />
          )}
        </div>
      </PhoneFrame>
    </div>
  )
}
```

- [ ] **Step 8: Verify typecheck + gallery**

Run: `npm run build`
Expected: `tsc -b` typechecks `src/dev/GalleryApp.tsx` cleanly.

Run: `npm run gallery`, open the "Brand > Splash" entry. Expected: the beat plays inside the phone frame; "Replay" re-runs it; clicking the frame or pressing a key skips to "Handed off to the landing."

- [ ] **Step 9: Commit**

```bash
git add src/dev/GalleryApp.tsx
git commit -m "chore(gallery): add Splash load-in story"
```

---

### T6. End-to-end coverage (splash session + reduced motion)

**Files:**
- Create: `e2e/splash.spec.ts`
- Modify: `playwright.config.ts` (let the `mobile` project also match `splash.spec.ts`)

Inferred wiring: the two Playwright projects use `testMatch`. `mobile` matches `/tracer\.spec\.ts/` and `desktop` matches `/desktop-.*\.spec\.ts/`, so a new `splash.spec.ts` would not run under either. The smallest change is to broaden the `mobile` project's `testMatch` to include `splash`. (Alternative: add a dedicated `splash` project. The broadened regex is less config churn and the mobile viewport renders the vision path fine.)

- [ ] **Step 1: Add the spec**

`e2e/splash.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test"

/**
 * The splash assertion set. We never test the motion frame-by-frame: we assert
 * the load-in is present on a fresh session and that the landing takes over, that
 * a same-session reload skips the beat, and that reduced motion renders the
 * landing with no beat at all.
 */
const HEADING = "Build real intuition for algorithmic thinking."

async function expectLanding(page: Page) {
  await expect(page.getByRole("heading", { name: HEADING })).toBeVisible()
}

test("a fresh session plays the splash, then hands off to the landing", async ({
  page,
}) => {
  await page.goto("/")
  const splash = page.getByTestId("willow-splash")
  await expect(splash).toBeVisible()
  // Tap to skip straight to the landing (no timing-dependent assertions).
  await splash.click()
  await expectLanding(page)
  await expect(splash).toHaveCount(0)
})

test("within the same session, a reload skips the splash", async ({ page }) => {
  await page.goto("/")
  await page.getByTestId("willow-splash").click()
  await expectLanding(page)
  await page.reload()
  await expectLanding(page)
  await expect(page.getByTestId("willow-splash")).toHaveCount(0)
})

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" })

  test("snaps to the landing with no splash beat", async ({ page }) => {
    await page.goto("/")
    await expectLanding(page)
    await expect(page.getByTestId("willow-splash")).toHaveCount(0)
  })
})
```

- [ ] **Step 2: Let the mobile project pick up the new spec**

In `playwright.config.ts`, broaden the `mobile` project's `testMatch`:

Before:
```ts
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 500, height: 900 } },
      testMatch: /tracer\.spec\.ts/,
    },
```
After:
```ts
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 500, height: 900 } },
      testMatch: /(?:tracer|splash)\.spec\.ts/,
    },
```

- [ ] **Step 3: Run the e2e suite**

Run: `npm run e2e`
Expected: the three new `splash.spec.ts` tests pass, and the existing `tracer.spec.ts` and `desktop-smoke.spec.ts` still pass. The tracer and desktop smoke each start at `/`, where the splash now auto-completes in about 2s (or is cleared by Playwright's actionability wait before the first click), so they remain green without edits.

- [ ] **Step 4: Commit**

```bash
git add e2e/splash.spec.ts playwright.config.ts
git commit -m "test(e2e): cover the splash session and reduced-motion paths"
```

---

## Recommended scoped commits

The tree may carry unrelated WIP; touch only the files listed per task. Commit in this order (each is independently green; the dependency chain is 1 -> 2 -> 3 -> 4, then 5 needs 2, and 6 needs 3 + 4):

1. **feat(home): session-gated splash helper** - `src/features/home/splash.ts`, `splash.test.ts`. (T1)
2. **feat(home): Willow load-in splash component** - `src/components/willow/Splash.tsx`. (T2)
3. **feat(home): play the splash before the vision landing** - `src/screens/Home.tsx`. (T3)
4. **feat(branding): reposition copy to algorithmic thinking** - `src/screens/Home.tsx`, `index.html`, `src/screens/ChooseCourse.tsx`, `src/screens/Settings.tsx`, `src/screens/Profile.tsx`, `README.md`. (T4)
5. **chore(gallery): add Splash load-in story** - `src/dev/GalleryApp.tsx`. (T5)
6. **test(e2e): cover the splash session and reduced-motion paths** - `e2e/splash.spec.ts`, `playwright.config.ts`. (T6)

---

## Test plan

- **Pure unit (T1):** `src/features/home/splash.test.ts`. `shouldShowSplash` is true on a fresh storage, false after `markSplashShown`, idempotent on repeated reads, and isolated across independent storages. Run: `npm test -- src/features/home/splash.test.ts`.
- **E2E (T6), one assertion set:** fresh session shows `willow-splash` then the landing heading; a same-session reload skips the beat; the reduced-motion path renders the landing with `willow-splash` absent. Run: `npm run e2e`.
- **Copy guard:** the `no em dash (U+2014)` suite (part of `npm test`) covers the new and edited shipped files and this plan doc.
- **Regression:** `catalog.test.ts` and the existing `tracer` / `desktop-smoke` e2e stay green. Run: `npm test`, `npm run e2e`.
- **Build + lint:** `npm run build` (`tsc -b && vite build`) and `npm run lint` (oxlint) are clean.
- **Do not test:** `motion/react` frame-by-frame output, or exact marketing wording beyond the em-dash guard.

---

## Risks / things to verify while reading code

- **Splash overlay intercepts input on `/`.** It is `fixed inset-0 z-50 bg-background`, so until it auto-completes (about 2s) or is skipped, the `/` controls sit behind it. Playwright's actionability wait absorbs this for the existing tracer and desktop smoke (they click after the overlay clears), so no tracer edits are needed. If a future test needs `/` instantly, click the splash first or seed `sessionStorage["willow.splashShown"] = "1"`.
- **Read the gate once.** `VisionHome` reads `shouldShowSplash(sessionStorage)` in a `useState` initializer (once per mount), and writes `markSplashShown` only in `onDone`. Do not call `shouldShowSplash` in render body, or it could re-trigger on re-render.
- **StrictMode.** `main.tsx` and the gallery wrap in `StrictMode`. The `useState` initializer is a pure read (safe to double-invoke in dev); `onDone` is guarded by a `done` ref so the timeline + skip cannot double-fire the handoff.
- **`useReducedMotion` can be `null` first render.** Use `useReducedMotion() ?? false`. In the browser and under Playwright `reducedMotion: "reduce"`, the value is correct on first render, so the no-beat path renders `null` and calls `onDone` on mount.
- **Focus handoff.** Focus moves to the heading only when a splash actually preceded it (`splashRan` ref), so a same-session reload (no beat) does not steal focus. The heading needs `tabIndex={-1}` and the `ref` to be programmatically focusable.
- **Em-dash guard includes this plan.** `docs/**/*.md` is scanned. Keep the plan, copy, and code comments free of U+2014. `·` is allowed.
- **Playwright `testMatch`.** Without the T6 config change the new spec silently does not run. Confirm `npm run e2e` lists the three splash tests.
- **ChooseCourse subcopy now renders on mobile.** Removing `hidden ... lg:block` adds a line under the mobile "Choose a course" heading; confirm it reads well at about 390px.

---

## Acceptance criteria (verifier)

- On a brand-new session at `/` (vision path), the "Willow" load-in plays once, then the landing appears with the new headline "Build real intuition for algorithmic thinking." and the new subcopy. A reload in the same session shows the landing with no beat. Tap, click, or any key skips the beat. With `prefers-reduced-motion: reduce`, the landing shows immediately and the `willow-splash` element is never present.
- After the handoff, keyboard focus is on the landing heading; the load-in exposes the accessible name "Willow".
- The landing shows the faint roadmap row `Data Structures · Algorithms · Probability` under the CTA, with Data Structures in lilac-strong and the rest faint. The CTA still reads "Choose a course"; no wordmark is added to the landing.
- Copy is updated everywhere in scope: `index.html` title + description + Open Graph + Twitter tags; ChooseCourse subcopy (visible on mobile and desktop); the three Settings/Profile footer taglines read "Willow · algorithmic thinking, by doing"; the README intro names algorithmic thinking with Data Structures as the live track. `src/lessons/catalog.ts`, `src/screens/SignIn.tsx`, comments, and fixtures are unchanged.
- The dev gallery has a "Brand > Splash" story that plays the load-in in a phone frame with a working Replay control.
- `npm test`, `npm run build`, `npm run lint`, and `npm run e2e` all pass; no U+2014 anywhere in shipped files, edited docs, or this plan; strict TS (`import type`, no unused) is clean.

---

## Self-Review

- **Spec coverage:** Positioning A copy (T4) including the roadmap row (T4 Step 3); Animation A timeline (T2); dedicated component + pure gate with the exact key (T1, T2); vision-only, once-per-session, skip, reduced-motion, focus, and accessible name (T2 + T3); CTA unchanged and mark-only landing (T3 + T4); metadata with OG/Twitter and favicon placeholder (T4 Step 4); ChooseCourse, footer taglines, README (T4); dev-gallery story with replay (T5); unit gate test + one Playwright set (T1, T6); leave-alone list honored (no catalog/SignIn/fixture edits). No deferred items (manifesto, OG image asset, completion forward-line) are included, per scope.
- **Placeholder scan:** No TBD/TODO; every code and test step contains complete, paste-ready content and exact commands with expected output.
- **Type/name consistency:** `shouldShowSplash` / `markSplashShown` and the `SplashStorage` slice (T1) are imported and used unchanged in T3; the `"willow.splashShown"` key is defined once (T1); the `Splash` component and its `onDone` prop are consistent across T2, T3, and T5; the `data-testid="willow-splash"` hook in T2 matches every `getByTestId` in T6; the landing heading string in T4 equals the `HEADING` constant in T6.
