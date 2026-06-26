# Landing + branding pivot to algorithmic thinking (with "Willow" load-in)

- Date: 2026-06-24
- Branch: `feat/progress-metrics-gallery` (current); recommend a fresh `feat/landing-algorithmic-thinking-pivot` for the build
- Status: proposed (decisions locked via the visual-companion brainstorm; user approved)

## Goal

Reposition Willow's outward-facing surfaces so the product reads as an
**algorithmic-thinking** app whose **first live track happens to be Data
Structures**, not as a data-structures-only app. Add a calm branded **load-in**
where the word "Willow" arrives and then hands off to the first-run landing
(tree + "learn by doing" + the new headline). Do a comprehensive but light
wording pass everywhere the current copy implies "data structures only."

No new courses, no new lessons, no logo redesign, no new product mechanics.

## Locked decisions

1. **Positioning (Option A):** the landing headline names the mission
   ("algorithmic thinking"); data structures becomes "where we start." A faint
   `Data Structures · Algorithms · Probability` roadmap row on the landing makes
   the breadth read instantly.
2. **Load-in (Option A, calm cross-fade):** the word "Willow" fades + scales in,
   holds, lifts and fades out; then the vision landing fades in (tree springs,
   copy staggers up).
3. **Scope:** comprehensive wording pass (landing, app metadata, choose-a-course,
   footer taglines, README).
4. **Splash frequency:** once per browser **session** (`sessionStorage`). It only
   precedes the first-run vision landing; returning learners (who have entered a
   course) land on the dashboard and never see it.
5. **CTA:** unchanged ("Choose a course"); the learner still selects their course.
6. **Extras:** include the dev-gallery splash preview. Skip the manifesto line,
   the OG image, and the completion forward-line for now.

## The load-in (splash)

### Sequence (approximate)

```
0.00s  word "Willow" : opacity 0, scale .92, blur 5px
0.00-0.72s  fade + scale + de-blur in (ease-out)
0.72-1.50s  hold
1.50-2.02s  lift + fade out (translateY -22px, ease-in)
~1.8s   landing begins: tree spring (.7 -> 1.07 -> 1),
        then eyebrow / headline / subcopy / CTA / roadmap stagger up (~110ms apart)
```

### Behavior

- Shows only on the **vision** path (`homeMode(state) === "vision"`), gated to
  once per session.
- **Tap / click / key to skip** to the landing immediately.
- `prefers-reduced-motion`: **snap** straight to the landing, no motion (the word
  is not shown as a separate beat; landing renders immediately).
- After handoff, move focus to the landing heading so keyboard/SR users land in
  the right place; announce the wordmark (`aria-label="Willow"`).

### Architecture (chosen: dedicated component)

- New `src/components/willow/Splash.tsx`: a self-contained `motion/react`
  sequence that renders the "Willow" wordmark, runs the timeline, and calls
  `onDone()` (also called by skip and by the reduced-motion path).
- New pure helper for the session gate, unit-tested without rendering:

  ```ts
  // e.g. src/features/home/splash.ts
  export function shouldShowSplash(storage: Pick<Storage,"getItem"|"setItem">): boolean
  export function markSplashShown(storage: Pick<Storage,"getItem"|"setItem">): void
  // key: "willow.splashShown" in sessionStorage
  ```

- `VisionHome` (in `src/screens/Home.tsx`) renders `<Splash onDone=... />` when
  `shouldShowSplash(sessionStorage)` is true, otherwise the landing directly. On
  `onDone`, call `markSplashShown` and reveal the landing.
- Alternatives rejected: (B) a phase state folded into `VisionHome` (mixes two
  jobs, harder to test); (C) a `splash` screen in the router union (overkill; not
  a navigable destination, complicates back/deep-links).

## Copy rewrite (before -> after)

Landing (`src/screens/Home.tsx`, `VisionHome`):
- Headline: "Build real intuition for **data structures**." ->
  "Build real intuition for **algorithmic thinking**."
- Subcopy: "Tap, predict, and watch each rule unfold. One interactive lesson at a
  time." -> "Tap, predict, and watch each idea click into place. We start with
  data structures, one interactive lesson at a time."
- Add a faint roadmap row under the CTA: `Data Structures · Algorithms ·
  Probability` (Data Structures emphasized in lilac).
- Unchanged: eyebrow "Learn by doing", CTA "Choose a course".
- The landing stays **mark-only** (the wordmark is the splash's job); no
  duplicate wordmark on the landing.

App metadata (`index.html`):
- Title: "Willow: learn by doing" -> "Willow: learn algorithmic thinking by doing"
- Add `<meta name="description">`: "Learn algorithmic thinking by doing. Tap,
  predict, and build real intuition, no memorizing and no jargon. Starting with
  data structures."
- Add Open Graph + Twitter tags (title, description, type, and an image slot;
  the image itself is out of scope for this pass).

Choose-a-course (`src/screens/ChooseCourse.tsx`):
- Subcopy: "Pick a track and start building real intuition." -> "Learn to think
  in algorithms, by doing. Start with data structures and grow from there."
- (Currently desktop-only; render it on mobile too, under "Choose a course".)

Footer taglines (`src/screens/Settings.tsx` line ~53, `src/screens/Profile.tsx`
lines ~25 and ~52):
- "Willow · learn-by-doing data structures" -> "Willow · algorithmic thinking, by
  doing"

README (`README.md`):
- "...'learn data structures by doing' web app." -> "...'learn algorithmic
  thinking by doing' web app. The first track, Data Structures, is live;
  Algorithms and Probability are on the way."

Left as-is (intentionally):
- `src/lessons/catalog.ts` course titles/subtitles. Data Structures is genuinely
  the live course; the umbrella lives on the landing and the catalog tagline.
- `src/screens/SignIn.tsx` copy (not data-structures-specific; reads fine).
- Code comments and test/dev fixtures mentioning "Data Structures" (not
  user-facing branding).

## Dev gallery

Add a Splash entry to `gallery.html` / the dev gallery surface so the animation
can be previewed and timed in isolation (with a replay control), matching how
other components are showcased. Dev-only; excluded from the prod bundle per the
existing gallery setup.

## Accessibility

- Reduced-motion path verified (instant snap, no animation).
- Splash is skippable (pointer + keyboard); never traps focus.
- Wordmark has an accessible name; focus moves to the landing heading on handoff.
- New copy keeps AA contrast (lilac-strong for text, pale lilac for fills only).

## Testing (existing seams; no new infrastructure)

- **Unit:** `shouldShowSplash` / `markSplashShown` (first call true, subsequent
  false within the session; independent storages do not leak).
- **E2E (one Playwright assertion set):** on a fresh session the splash plays
  then the vision landing shows; a reload within the session skips the splash and
  shows the landing directly; the reduced-motion path renders the landing with no
  splash beat.
- **Copy guard:** all new strings pass the existing `no-em-dash` test.
- **Do not test:** Framer Motion frame-by-frame output, or exact marketing copy
  beyond the em-dash guard.
- Keep existing `catalog.test.ts` green (course title "Data Structures" stays).

## Out of scope (YAGNI)

- New courses or lessons; the locked-course catalog is unchanged.
- Logo / brand-mark redesign (handled in the separate v2/v3/v4 track).
- Router changes; the splash is not a navigable screen.
- Manifesto microcopy, the OG/social share image asset, and the completion
  forward-line (deferred; easy follow-ups).
- Persisting "splash seen" beyond the session (no localStorage, no per-account
  flag).

## Risks / notes

- The splash must not replay on every re-render; gate on the pure session helper
  read once on mount, and write "shown" on handoff.
- Keep the timeline cancel-safe (skip mid-animation must not leave a half state);
  the dedicated component owns one timeline and a single `onDone`.
- `docs/*` is gitignored except `architecture.md`, so this spec stays local
  (consistent with the other specs under `docs/plans/specs/`).
