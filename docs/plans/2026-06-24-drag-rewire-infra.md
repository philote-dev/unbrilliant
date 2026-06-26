# Plan: Shared "Rewire Surface" Interaction Substrate

> Source: `docs/lesson-design.md` (Principle 7) and the Linked Lists lesson spec. Constraints: `oxlint` (lint), `vitest run` (test), `tsc -b` (build) must stay green; don't touch git.

## Status: implemented 2026-06-24

All slices delivered via TDD. **Decision 1 = Option B** (added jsdom + Testing Library component-test infra). Shipped: `src/components/rewire/{core,types,RewireContext,RewireSurface,RewireSource,RewireTarget}` + tests `core.test.ts` / `imports.test.ts` / `RewireSurface.test.tsx`; demo `src/dev/RewireLab.tsx` wired into the gallery; `rewire` variant on `LessonAction`; vitest split into `node`/`dom` projects. Gate: **102 tests green**, `tsc -b` clean, lint clean (no new warnings). Independently verified (verdict SHIP) and security-reviewed (no Critical/High/Medium). Hardened drag handlers to filter by `pointerId` (multi-touch correctness). No `index.ts` barrel; no floating connector ghost (lesson-level concern); reduced-motion covered by the global CSS block (no JS animation).

## Goal

Build a presentation-only, accessible, deterministic **rewire surface**: a learner drags/taps/keys a connector from a SOURCE id onto a TARGET id; on a drop over any **registered** target it emits one semantic intent `(from, to)` via `onRewire`; released on empty/non-target it snaps back and emits nothing. The surface highlights ids in an injected `legalTargets` set but **never decides correctness**. It ships on native Pointer Events (no heavy libs), themed in Willow tokens, with E2E data-hooks, and is exercised now via a Gallery demo + pure-helper node tests (no consuming lesson exists yet).

## Grounding (verified in repo)

- Shared union: `LessonAction` lives at `src/features/lesson/engine.ts` (lines 68-76). Imported by `arraysEngine.ts` and `lessonModule.ts`. Both `lessonReducer` (engine.ts:269) and `arraysReducer` (arraysEngine.ts:435) end in `default: return state`, so a new variant is non-breaking.

```68:76:src/features/lesson/engine.ts
export type LessonAction =
  | { type: "build-step" }
  | { type: "continue" }
  | { type: "select"; letter: string }
  | { type: "check" }
  | { type: "reveal" }
  | { type: "reattempt" }
  | { type: "next" }
```

- Stage contract: `Stage: ComponentType<{ state: S; dispatch: Dispatch<LessonAction> }>` (`src/features/lesson/lessonModule.ts:30`).
- E2E hook convention: `AnswerCard` renders a stable `data-testid="answer-card"` always, and DEV-gates only the winner marker `data-answer={answerMarker && import.meta.env.DEV ? "1" : undefined}` (`src/components/willow/AnswerCard.tsx:54-55`). Tracer targets `[data-testid="answer-card"][data-answer="1"]` (`e2e/tracer.spec.ts:53`).
- Tokens: `--lilac`, `--lilac-strong`, `--lilac-soft`, success/warning/danger, and a **global** `@media (prefers-reduced-motion: reduce)` block neutralizing CSS animation/transition (`src/index.css:279-288`). So CSS animation is reduced-motion-safe for free; only JS-driven `motion/react` animation needs a `useReducedMotion()` guard.
- Animation lib: `motion` via `motion/react` (already used in `AnswerCard.tsx`, `ArrayRow.tsx`). `useReducedMotion()` returns a boolean; conditionally animate (prefer opacity over transform; make snap-back instant when true).
- **Heavy libs are installed deps** (`package.json`: `@xyflow/react`, `d3-force`, `d3-hierarchy`, `gsap`) for lazy future lessons. The "no heavy libs" rule therefore must be enforced as an **import guard on the rewire source**, not by absence.
- Test infra: `vitest.config.ts` uses `environment: "node"`, `include: ["src/**/*.test.ts"]`: note `.test.ts`, **not** `.test.tsx`. No jsdom/happy-dom, no `@testing-library/*`. Convention = pure functions tested in node (`engine.test.ts`, `arraysEngine.test.ts`). `tsconfig.app.json` excludes `src/**/*.test.ts` from the build and is strict-ish (`noUnusedLocals/Parameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly` → use `import type`, no enums/namespaces).
- Demo harness: `src/dev/GalleryApp.tsx` (served by `gallery.html` → `src/dev/gallery.tsx`; **not in the app build**). Sidebar has "Screens" + "Lesson states". `LessonLab` is typed to `LessonModule<S>`, so the surface (not a lesson module) needs its **own** lab, not `LessonLab`.
- `.oxlintrc.json` enables few rules; plugins `["react","typescript","oxc"]`. `react/only-export-components` is a `warn` (allowConstantExport) → keep non-component exports in `.ts`, components in `.tsx`.
- `radix-ui` (incl. `react-roving-focus`) is available, but a hand-rolled roving tabindex is lighter and avoids coupling: recommended.

## The four decisions (recommendations)

1. **Testing strategy → Option A (recommended).** Extract gesture logic (hit-testing/drop-tolerance, drop-target resolution, keyboard cycling, intent/snap-back resolution) into a **pure `core.ts` tested as `core.test.ts` in node**; cover real DOM pointer/keyboard/SR parity later via the consuming Linked Lists Playwright tracer, with a Gallery demo for manual proof now. Rationale: matches the repo's node-only convention, zero new deps, protects bundle + test speed, and the PRD says "keep it minimal" and that the infra "is proven end-to-end by the first Linked Lists slice." **Defer 1B.** Tradeoff: DOM glue (pointer capture, `elementFromPoint`, focus) isn't unit-verified until the LL tracer lands; mitigated by keeping DOM handlers thin over tested pure helpers + the Gallery demo. 1B is specified below as a ready, costed, optional slice if you want automated DOM parity before LL.

2. **Where the action/types live → keep on the `LessonAction` union in `engine.ts` (recommended).** Add exactly one variant `| { type: "rewire"; from: string; to: string }` there (with a short "shared, cross-lesson" comment). It's where the union already lives, both reducers already `default: return state`, and a new module for a one-line type is over-refactoring (YAGNI). The surface's **presentation** types (`RewireSurfaceProps`, `RewireIntent`, registration/context types) live **with the component** in `src/components/rewire/`, never in the pure framework-agnostic `engine.ts`. Defer extracting a `src/features/lesson/rewire.ts` shared module until a 3rd consumer justifies it.

3. **How it's demoed now → a dedicated Gallery `RewireLab` (recommended scope).** Add an "Interactions" (or "Infra") nav group + a `RewireLab` story (its own local state, not `LessonLab`): a small fixed graph (3-4 sources, 4-6 targets with opaque ids), `legalTargets` preset chips ("all legal" / "subset" / "none"), a captured-intent log showing the last `(from,to)` and a snap-back indicator, exercisable by pointer drag, tap-tap, and keyboard, with the existing theme toggle for light/dark. This visually proves stories #1-#10, #13, #15, #18, #19.

4. **File layout & contract → new `src/components/rewire/` directory (recommended).** A cohesive multi-file substrate, distinct from willow primitives:
   - `RewireSurface.tsx`: root/provider. **Props = the PRD contract**: `legalTargets: Set<string>`, `onRewire: (from,to)=>void`, plus `children`, optional `label`/`className`. Owns the target/source registry, the transient gesture state (armed source, hovered target), the single `aria-live` region, and snap-back animation.
   - `RewireSource.tsx`: `{ id, label, children?, className? }`. Registers itself; renders the draggable/focusable handle; emits `data-rewire-source={id}` (always) + DEV-only `data-rewire-armed`; ARIA role/label; keyboard entry.
   - `RewireTarget.tsx`: `{ id, label, children?, className? }`. Registers its DOM node (`getBoundingClientRect`) for geometry hit-testing; renders `data-rewire-target={id}` (always) + DEV-only `data-rewire-legal="1"` when `id ∈ legalTargets` (mirrors `data-answer`); ARIA role/label; min 44×44px.
   - `RewireContext.ts`: context + `useRewireContext()` hook + the registration API (`registerTarget`, `registerSource`, `beginGesture`, `hoverTarget`, `commit`, `cancel`).
   - `core.ts` / `core.test.ts`: pure geometry/keyboard/intent helpers.
   - `types.ts`: `RewireIntent`, prop/context types. `index.ts`, barrel (optional).
   - `imports.test.ts`: heavy-lib import guard.

   **Emission rule (subtle: get it right):** `onRewire` fires on a drop over **any registered target**, legal or not (story #5: a real-but-wrong drop is the learner's choice). `legalTargets` drives **highlighting/announcement only**, never emission (stories #12-#14). Snap-back = release where no registered target is hit.

### Proposed type shapes (for the executor)

```ts
// engine.ts. The ONE new shared action (added to the LessonAction union)
| { type: "rewire"; from: string; to: string }

// src/components/rewire/types.ts
export interface RewireIntent { from: string; to: string }

export interface RewireSurfaceProps {
  legalTargets: Set<string>                       // highlight only. From a PURE engine selector
  onRewire: (from: string, to: string) => void    // fired ONLY on a drop over a REGISTERED target
  children: React.ReactNode
  label?: string
  className?: string
}

// src/components/rewire/core.ts (pure, node-tested)
export interface Point { x: number; y: number }
export interface TargetRect { id: string; left: number; top: number; right: number; bottom: number }
export function isWithin(p: Point, r: TargetRect, tolerance?: number): boolean
export function resolveDropTarget(p: Point, targets: TargetRect[], tolerance?: number): string | null
export function resolveIntent(from: string, toId: string | null): RewireIntent | null  // toId ? {from,to} : null
export function cycleTarget(currentId: string | null, orderedIds: string[], dir: 1 | -1): string | null
```

## Tracer-bullet slices (ordered, smallest-first)

Dependency graph: **0 → 1**; then **2** and **3** both depend on 1 (independent of each other → parallelizable); **4** finalizes after 1 (and ideally 2+3); **5** optional after 3.

### Slice 0: Action variant + pure core + node tests
**Build:** add the `rewire` variant to `LessonAction` (engine.ts); add `src/components/rewire/types.ts` + `core.ts` (the four pure helpers above); add `core.test.ts`.
**Acceptance:**
- [ ] `LessonAction` includes `{ type: "rewire"; from: string; to: string }`; `tsc -b` passes; both reducers still compile (no exhaustiveness break).
- [ ] `resolveIntent(from, null)` → `null` (snap-back); `resolveIntent(from, "T")` → `{from,to:"T"}`.
- [ ] `resolveDropTarget` returns the hit id within tolerance, `null` outside all, and a deterministic topmost/nearest pick on overlap.
- [ ] `isWithin` honors positive tolerance (forgiving drop) and rejects clearly-outside points.
- [ ] `cycleTarget` wraps both directions and handles empty/singleton lists.
**Verify:** `npm run test` (the new `core.test.ts` runs under the existing node config) + `tsc -b`.

### Slice 1: Surface skeleton + registry + tap-to-tap modality + Gallery lab
**Build:** `RewireContext.ts`, `RewireSurface.tsx`, `RewireSource.tsx`, `RewireTarget.tsx` with registration, data-hooks, ARIA roles/labels, ≥44px targets, lilac legal highlight (token-based, **plus a non-color cue**, ring + dashed outline + dot icon), and the **tap-source-then-tap-target** path (arm on source tap → emit on registered-target tap → snap-back/disarm on empty tap). Add `RewireLab` + nav group to `src/dev/GalleryApp.tsx` (new `src/dev/RewireLab.tsx`).
**Acceptance:**
- [ ] Tap a source then a registered target → exactly one `onRewire(from,to)`.
- [ ] Tap a source then empty/non-target → snap-back, **no** `onRewire`.
- [ ] Dropping on a **registered but illegal** target still emits (legality ≠ emission).
- [ ] `data-rewire-source={id}` and `data-rewire-target={id}` always present; `data-rewire-legal="1"` present only in DEV for ids in `legalTargets`.
- [ ] Legal targets show the lilac highlight + non-color cue; targets are ≥44×44px; renders correctly in light **and** dark.
- [ ] StrictMode double-mount doesn't corrupt the registry (idempotent register/unregister).
**Verify:** Gallery `RewireLab` manual run (tap path, preset chips), DOM inspection of hooks; `npm run lint` + `tsc -b`.

### Slice 2: Pointer drag modality (mouse + touch)
**Build:** native Pointer Events on the source handle: `pointerdown` → `setPointerCapture(e.pointerId)` + snapshot all target rects; `pointermove` → hit-test (geometry, tolerance) + live-highlight hovered target; `pointerup` → `resolveDropTarget` → emit or snap-back; handle `pointercancel`; `touch-action: none` on the handle. Snap-back via `motion/react` guarded by `useReducedMotion()` (instant when reduced).
**Acceptance:**
- [ ] Mouse drag source→target emits the **same** intent as the tap path.
- [ ] Touch drag (emulated) behaves identically; the page doesn't scroll/pan mid-drag (`touch-action: none`).
- [ ] Release on empty → snap-back, no emit; `pointercancel` → snap-back, no emit.
- [ ] Hovered legal target highlights live during drag.
- [ ] With reduced-motion, snap-back is instant (no spring).
**Verify:** Gallery (mouse + devtools touch), reuse Slice 0 hit-test tests; `npm run lint` + `tsc -b`.

### Slice 3: Keyboard modality + announcements + full a11y
**Build:** roving tabindex over sources; focus a source → Enter/Space arms → Arrow keys cycle registered targets (legal ones highlighted/announced) → Enter confirms (emit) → Escape cancels (snap-back); focus restore on commit/cancel. One polite `aria-live` region announcing source-selected, available-target count/names, and result ("Rewired A→C" / "Snapped back, no change"). Visible focus rings; never color-alone.
**Acceptance:**
- [ ] Keyboard-only produces the **identical** `(from,to)` intent as drag/tap.
- [ ] Escape mid-selection snaps back, no emit; focus returns to the source.
- [ ] `aria-live` announces source, available targets, and the result; no per-pointermove chatter (announce only discrete enter/leave/commit).
- [ ] All sources/targets have roles + accessible names; focus rings visible in light/dark.
- [ ] Keyboard target order is deterministic (documented: registration or sorted-id order) so a future tracer can predict cycling.
**Verify:** Gallery keyboard walkthrough + screen-reader spot check; `npm run lint` + `tsc -b`. (If Slice 5 is taken, the parity test asserts this automatically.)

### Slice 4: Heavy-lib import guard + final polish
**Build:** `src/components/rewire/imports.test.ts`, a node test reading every `src/components/rewire/*.{ts,tsx}` (via `node:fs`) asserting none import `@xyflow/react`, `gsap`, or `d3-*`. Optional belt-and-suspenders: `.oxlintrc.json` `overrides` adding `no-restricted-imports` scoped to `src/components/rewire/**`. Final theming/reduced-motion pass.
**Acceptance:**
- [ ] Guard test passes now and **fails** if a banned import is added to the rewire dir (verify by temporarily adding one locally, then removing).
- [ ] `npm run lint`, `npm run test`, `tsc -b` all green.
**Verify:** `npm run test` + `npm run lint` + `tsc -b`.

### Slice 5 (OPTIONAL: only if Decision 1B chosen), Component-test infra + one thin parity test
**Build:** add devDeps `jsdom`, `@testing-library/react`, `@testing-library/dom` (+ optional `@testing-library/jest-dom`, `@testing-library/user-event`); convert `vitest.config.ts` to a **projects/workspace** setup so node tests stay node (`*.test.ts`) and a jsdom project picks up `*.test.tsx` with a `src/test/setup.ts`; write `RewireSurface.test.tsx` asserting (a) release-on-empty emits nothing (snap-back) and (b) keyboard path emits the same intent as a simulated drag.
**Acceptance:**
- [ ] `*.test.ts` still run in node; `*.test.tsx` run in jsdom; `npm run test` green.
- [ ] The thin component test proves snap-back + keyboard/drag intent parity.
**Verify:** `npm run test`.

## Acceptance-criteria matrix (19 PRD stories → slices)

| # | Story (abridged) | Slice(s) | Concrete criterion |
|---|---|---|---|
| 1 | Drag pointer→target | 2 | Mouse/touch drag emits `(from,to)` |
| 2 | 375px generous + forgiving drop | 1, 2 | ≥44px targets (S1); drop tolerance (S0/S2) |
| 3 | Legal targets highlight mid-drag | 1, 2 | Static highlight (S1); live during drag (S2) |
| 4 | Release on empty → snap back, no penalty | 0, 1, 2 | `resolveIntent`→null; no `onRewire` |
| 5 | Drop on real-but-wrong target = the choice | 0, 1 | Emit for any **registered** target |
| 6 | Keyboard-only complete | 3 | Same intent via keyboard |
| 7 | Tap-source-then-tap-target | 1 | Tap path emits intent |
| 8 | SR announces source/targets/result | 3 | `aria-live` updates on discrete events |
| 9 | Reduced-motion minimized | 2 + CSS | `useReducedMotion()` guard; global CSS free |
| 10 | Clear focus + selected connector state | 1, 3 | Armed state (S1); focus ring (S3) |
| 11 | One shared drop-in surface | 1 | `RewireSurface` API |
| 12 | Emits semantic intent, never grades | 0, 1 | `onRewire` only; no verdict anywhere |
| 13 | Pass legalTargets from pure selector | 1 | `legalTargets` drives highlight only |
| 14 | Distinguish no-target vs registered-target | 0, 1, 2 | snap-back vs emit |
| 15 | Stable deterministic test hooks | 1, 4 | `data-rewire-source/target` (+DEV legal); guard |
| 16 | Native pointer events, no heavy lib | 2, 4 | native PE (S2); import guard (S4) |
| 17 | Intent flows through shared union | 0 | `rewire` on `LessonAction` |
| 18 | Reusable for key→bucket / draw-edge | 0, 1 | Opaque string ids; demoed with arbitrary ids |
| 19 | Willow tokens, light/dark | 1, 4 | Token-based styling; light/dark verified |

## Risks & mitigations

- **Pointer capture + touch:** call `e.currentTarget.setPointerCapture(e.pointerId)` on `pointerdown`; set CSS `touch-action: none` on the handle so the browser doesn't steal the gesture for scroll/pan; release capture and handle `pointercancel` on end. React 19 synthetic `onPointerDown/Move/Up` work; capture is on the DOM node.
- **Hit-testing approach:** prefer **geometry** (snapshot target `getBoundingClientRect()`s at drag start, point-in-rect with tolerance) as the source of truth because the PRD wants *forgiving* drops, which `document.elementFromPoint` (exact-pixel, top element only) can't provide; keep `elementFromPoint` only as an optional fast-path. Keep all math in client/viewport space (both `clientX/Y` and `getBoundingClientRect` are viewport-based) so transformed ancestors don't skew coords. Re-snapshot rects on drag start (and optionally scroll) to avoid stale geometry.
- **Focus management / roving tabindex:** roll a small roving tabindex (one active source in tab order; arrow-navigable targets once armed); restore focus to the source on cancel/commit via refs + `useLayoutEffect`. Avoid focus loss across re-renders.
- **SR announcements:** one polite `aria-live` region owned by `RewireSurface`; update only on discrete state changes (arm, target enter/leave, commit, snap-back). **Never** on every `pointermove` (chatty).
- **No-heavy-libs guard:** the banned libs are installed, so guard by a **node test** that greps the rewire source for `@xyflow/react` / `gsap` / `d3-` imports (zero config, matches convention); optionally an oxlint `no-restricted-imports` override scoped to `src/components/rewire/**`.
- **Lint/TS gotchas:** keep non-component exports (context, hooks, helpers, types) in `.ts` to dodge `react/only-export-components`; use `import type` (verbatimModuleSyntax) and avoid enums/namespaces (erasableSyntaxOnly); mind `noUnusedParameters`.
- **StrictMode double-invoke** (Gallery): make register/unregister idempotent (Map keyed by id).
- **Verification gap (no consuming lesson):** the Playwright tracer drive lands with the out-of-scope Linked Lists lesson; for now define + document the selector contract and rely on Slice 0 node tests + the Gallery demo (+ optional Slice 5).

## Files to add / modify

**Modify:** `src/features/lesson/engine.ts` (add the union variant); `src/dev/GalleryApp.tsx` (add nav group + lab).
**Add:** `src/components/rewire/{types.ts, core.ts, core.test.ts, RewireContext.ts, RewireSurface.tsx, RewireSource.tsx, RewireTarget.tsx, imports.test.ts, index.ts}`; `src/dev/RewireLab.tsx`.
**Do NOT touch:** `catalog.ts`, `registry.tsx`, the two lesson reducers' bodies, `e2e/tracer.spec.ts` (LL owns that later).
**Only if Slice 5 (1B):** `vitest.config.ts` (→ projects), `vitest.dom.config.ts` (or workspace), `src/test/setup.ts`, `src/components/rewire/RewireSurface.test.tsx`; devDeps `jsdom`, `@testing-library/react`, `@testing-library/dom` (+ optional `@testing-library/jest-dom`, `@testing-library/user-event`). **No new deps for the recommended Option A.**

## Open questions for the human

1. **Decision 1:** OK to go with Option A (pure node tests + Gallery; defer jsdom/RTL), or do you want Slice 5/1B now?
2. **"Done" definition for this infra:** is "pure tests + Gallery manual demo" acceptable as shipped (real DOM/SR parity proven later by the LL tracer), or must automated DOM parity (Slice 5) gate this PRD?
3. **Keyboard selection model:** arrow-cycle among **all registered** targets (legal highlighted). Recommended, since story #5 requires wrong-but-registered targets to be choosable by keyboard too. Vs. cycle among **legal only**.
4. **Directory name:** `src/components/rewire/` (recommended) vs. `src/components/willow/`.
