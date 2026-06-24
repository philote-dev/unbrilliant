# Willow — Architecture & Codebase Flow

> Orientation map for the repo: how a learner's tap travels from the UI down to a
> pure engine and back up through persistence. This is the *flow* doc — for the
> shared vocabulary see [`CONTEXT.md`](../CONTEXT.md).

## What Willow is

A mobile-first, **deterministic, no-AI** "learn data structures by doing" web app.
The same state always yields the same feedback — all grading is pure functions, no
model calls. You can play signed-out (a transient in-memory **run**); signing in
saves a thin durable **progress** slice.

## Tech stack

| Concern        | Choice                                                            |
| -------------- | ----------------------------------------------------------------- |
| UI             | React 19, TypeScript, Vite 8                                      |
| Styling        | Tailwind CSS v4 (`@tailwindcss/vite`), Radix UI, shadcn primitives |
| Animation/viz  | `motion`, `gsap`, `@xyflow/react`, `d3-force`, `d3-hierarchy`     |
| Backend        | Firebase Auth + Cloud Firestore (emulator-first in dev)          |
| Tests          | Vitest (unit), Firebase emulator (integration), Playwright (e2e) |
| Path alias     | `@/*` → `src/*` (see `vite.config.ts`)                            |

## The big idea: three layers

```
┌──────────────────────────────────────────────────────────────┐
│  RENDERER (shallow)   screens/ · components/willow · features/hero │  React, animation
├──────────────────────────────────────────────────────────────┤
│  ENGINE (deep, pure)  features/lesson/*Engine.ts · engine.ts      │  no React/Firebase/anim
├──────────────────────────────────────────────────────────────┤
│  PERSISTENCE (seam)   features/progress/ProgressRepository        │  Firestore | in-memory
└──────────────────────────────────────────────────────────────┘
```

- **Engine** is the deep, pure core: a `(state, action) → state` reducer plus
  selectors. No React, Firebase, or animation deps, so it is fully testable and is
  the project's primary **test surface**.
- **Renderer** is shallow presentation over engine state — it animates snapshots
  and holds no rule logic.
- **Persistence boundary** (`ProgressRepository`) is the only seam the app
  reads/writes progress through — never Firestore directly. There are two adapters:
  a Firestore one for the app and an in-memory one for tests.

## Runtime composition (the provider stack)

`src/main.tsx` nests the global context providers; everything below reads from them.

```mermaid
flowchart TD
    Root["createRoot(#root)"] --> Theme["ThemeProvider — light/dark"]
    Theme --> Auth["AuthProvider — Firebase Auth user"]
    Auth --> Nav["NavigationProvider — client-side router stack"]
    Nav --> Run["LessonRunProvider — in-memory runs + persistence"]
    Run --> Course["CourseProgressProvider — derived progress + streak"]
    Course --> App["App — renders the active screen"]
```

Why this order matters: `LessonRunProvider` sits **above** the screen router, so an
in-flight run survives a detour to the Sign-In screen (that's what makes anonymous
"carry-up" on sign-in possible).

## Screen flow (the router)

There is no router dependency. `src/lib/navigation.tsx` is a tiny **stack-based
router**: `Screen` is a discriminated union, `navigate`/`replace`/`back` push and
pop a stack, and `App.tsx` switches on `screen.name`.

```mermaid
flowchart LR
    Home -->|choose course| ChooseCourse
    Home -->|continue| Lesson
    ChooseCourse --> CourseDetail
    CourseDetail -->|start/resume| Lesson
    Lesson -->|mastery gate met| Completion
    Lesson -.->|save/unlock intent| SignIn
    SignIn -.->|back| Lesson
    Home --> Progress
    Home --> Profile --> Settings
```

`AppShell` wraps every screen and shows the bottom nav only on the top-level tabs
(`home`, `courses`, `course`, `progress`, `profile`, `settings`).

## The lesson plug-in architecture

A lesson is a self-contained **module** behind one interface
(`features/lesson/lessonModule.ts`): `create`, `reducer`, `toProgress`, `resume`,
`hasProgress`, selectors, and a presentational `Stage`. The shared chrome stays
lesson-agnostic, so **adding a lesson is one catalog entry plus one module** — never
a change to the seam.

```mermaid
flowchart TD
    Catalog["lessons/catalog.ts<br/>single source of truth<br/>(ids, names, unlock rules, lazy load thunks)"]
    Catalog --> Registry["lessons/registry.tsx<br/>lazy 'future' previews (code-split)"]
    Catalog --> Lessons["features/lesson/lessons.ts<br/>playable module registry"]
    Host["lessons/LessonHost.tsx<br/>routes a lessonId"] --> Playable{"playable?"}
    Playable -->|yes| Player["screens/LessonPlayer.tsx<br/>shared chrome + module.Stage"]
    Playable -->|no| Registry
    Lessons --> Player
    Player -->|dispatch action| Engine["features/lesson/*Engine.ts<br/>pure reducer + gradeAnswer"]
    Engine -->|new state| Player
```

- **`catalog.ts`** — the static list of courses/lessons and all the *derived*
  helpers (`isLessonUnlocked`, `derivePathNodes`, `deriveCourseProgress`,
  `currentLessonId`). Progress-dependent state is always derived from real
  `LessonProgress`, never stored on the catalog.
- **`registry.tsx`** — turns every lesson with a `load` thunk into a `React.lazy`
  chunk so heavy libs (`@xyflow/react`, `d3-*`, `gsap`) stay out of the main bundle.
- **`features/lesson/lessons.ts`** — maps each *playable* lesson id to its
  `LessonModule` (currently Stacks & Queues, Arrays, Linked Lists).
- **`engine.ts`** — the shared engine core: `LessonAction`/`LessonProgress` shapes,
  the feedback machine, and `gradeAnswer` (the on-fire combo + mastery counters)
  reused by every lesson engine.

### Where a lesson's code lives

| Piece            | Location                                     |
| ---------------- | -------------------------------------------- |
| Pure engine      | `src/features/lesson/<name>Engine.ts`        |
| Module + `Stage` | `src/lessons/<name>.tsx` (+ `src/lessons/<name>/`) |
| Catalog entry    | `src/lessons/catalog.ts`                      |
| Playable wiring  | `src/features/lesson/lessons.ts`             |

## Run vs. progress & the reconcile flow

Two shapes, one boundary (see `CONTEXT.md` for the full definitions):

- **Run** (`LessonState`) — the transient, full in-memory lesson. Lives while you
  play; a refresh wipes an anonymous run.
- **Progress** (`LessonProgress`) — the thin durable slice saved per signed-in user.

`LessonRunProvider` keeps one run per lesson id and persists durable changes
optimistically (off the hot path). On sign-in it **reconciles** local run vs.
server progress through the pure `reconcile` decision:

```mermaid
sequenceDiagram
    participant UI as LessonPlayer
    participant Run as LessonRunProvider
    participant Repo as ProgressRepository
    participant FS as Firestore

    Note over Run: user becomes signed-in
    Run->>Repo: ensureUser + getProgress(uid, lessonId)
    Repo->>FS: read
    FS-->>Repo: server progress | null
    Repo-->>Run: server progress
    Note over Run: reconcile(local, server)
    alt server has progress
        Run->>UI: resume (server wins, no merge)
    else new account with in-flight run
        Run->>Repo: saveProgress (one-time carry-up)
    else nothing earned
        Run-->>Run: noop
    end
    UI->>Run: dispatch(answer)
    Run->>Repo: saveProgress (optimistic, debounced by signature)
```

`CourseProgressProvider` then overlays the live run on top of the server snapshot so
the Home dashboard, course path, and Progress tab always show honest, derived
numbers — including for anonymous runs that never persist.

## Repository map

| Path                          | Responsibility                                             |
| ----------------------------- | --------------------------------------------------------- |
| `src/screens/`                | Full-screen views (Home, Lesson player, Completion, …)    |
| `src/lessons/`                | Lesson modules, catalog, registry, per-lesson visuals     |
| `src/features/lesson/`        | Pure engines, the `LessonModule` seam, the run provider   |
| `src/features/progress/`      | `ProgressRepository` + adapters, reconcile, analytics     |
| `src/features/hero/`          | Animated hero visuals (structure columns, stack/queue)    |
| `src/features/home/`          | Home "vision vs. dashboard" mode logic                    |
| `src/components/willow/`      | App-specific presentational components (chrome, cards)    |
| `src/components/rewire/`      | Drag-to-rewire interaction primitives (linked lists)      |
| `src/components/ui/`          | shadcn/Radix primitives (button, card, input)             |
| `src/lib/`                    | Cross-cutting providers: auth, navigation, theme, firebase |
| `src/dev/`                    | Dev-only design gallery (entry: `gallery.html`)           |
| `src/test/`                   | Test setup                                                 |
| `e2e/`                        | Playwright end-to-end specs                               |

## Testing surfaces

| Layer            | Tool                          | Command                |
| ---------------- | ----------------------------- | ---------------------- |
| Engine / pure    | Vitest (`*.test.ts`)          | `npm test`             |
| Firestore rules/repo | Vitest + Firebase emulator | `npm run test:emulator` |
| Full flow        | Playwright + emulator         | `npm run e2e`          |

The engine is the primary test surface: assert behavior through the reducer and
selectors rather than the React tree.

## Build & deploy notes

- `index.html` → app entry (`src/main.tsx`). `gallery.html` → dev-only design
  gallery (`src/dev/gallery.tsx`); it is served by Vite in dev but is **not** a
  build input, so production only ships the app.
- `npm run build` = `tsc -b && vite build` → `dist/` → Firebase Hosting
  (`firebase.json` serves `dist` with SPA rewrites).
- Dev/test always talk to the **emulators** via a `demo-` project id, so the app can
  never reach a real Firebase project locally (`src/lib/firebase.ts`).
