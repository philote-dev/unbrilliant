# Intro to Data Structures: two reading-shape prototypes

> Status: SHIPPED (Jun 25, 2026). The "pages" variant is now the live first
> lesson (`id: intro`); the "reveal" variant stays a Dev Gallery prototype. The
> built lesson and the house UX preferences it establishes are documented in
> `docs/lessons/intro.md`. This file is kept as the original prototype spec.
> Source: `docs/notes.md` "Lesson Design" + the user's request to "fully create
> two types of lessons and place them in gallery."
> Binding parents: `docs/lesson-design.md` (principles), `docs/architecture.md`
> (the `LessonModule` seam), `docs/design/design-system.md` (visual language).

## Goal

An **introduction** lesson that teaches the big picture of data structures: data
is organized so it can be **stored**, **sorted**, and **categorized**, and the
shape you choose decides how hard the next task is. It is a schema-activation /
direct-instruction lesson (an "I get it" win before the mechanic drills), not one
of the seven backbone trade-off lessons.

We are testing **one variable: how reading-first the lesson should be.** So we
ship two prototypes over **identical content and identical checks**; only the
sequencing/reading-depth differs.

Both open with an **animated welcome hero** ("You already do this.") and present
each question with a **scenario icon** for immersion, a spaced scenario, and an
emphasized ask. The job names are taught on the three-jobs page, so a question never
states its own answer (no give-away); the explanation appears only as feedback after
the learner commits.

- **Prototype A. text-first reveal** (`intro-reveal`). A single interleaved flow:
  the "Quick idea" shows first, then the question *pops up* under it. Lighter reading.
- **Prototype B. reading pages** (`intro-pages`). Large, centered editorial reading
  pages (the text is the hero) paged through first; then the same checks run as a
  separate phase. Deeper reading.

## How it honors the binding principles

- **Deterministic, no-AI gate (Principles 4 + 5).** Every check is a hand-authored
  MCQ with one correct option, graded by string-equality on visible state. No
  model calls. Until-correct wall via the shared feedback machine (`gradeAnswer`).
- **Mechanic.** The checks use the admitted **Classify / spot-the-invariant**
  mechanic: given an everyday scenario, name the job (store / sort / categorize),
  plus one "why organize" recognition check. No new mechanic invented.
- **One idea.** The single idea is "organizing data is a deliberate choice with
  three jobs." Store/sort/categorize are facets of that one idea, not three ideas.
- **No Big-O.** Effort is shown by feel (shoebox vs alphabetized book), never named.
- **Lesson shape is per-lesson (Principle 6).** An intro is allowed its own shape;
  that is exactly what the two prototypes explore.

## Content (shared by both prototypes)

**Three jobs:** Store (keep it to get back later), Sort (put it in order),
Categorize (group like with like).

**The four checks (the gate, all four correct = complete):**

| id | scenario | answer |
|---|---|---|
| `store` | Saving a Wi-Fi password so the phone reconnects on its own | Store |
| `sort` | Lining up contacts A to Z | Sort |
| `categorize` | Dropping photos into Trips / Family / Food | Categorize |
| `why` | Need one card fast: alphabetized book or loose shoebox? | The book |

Job checks share the same three options, with the correct option in a different
position each time (no constant-position tell), so no seeded shuffle is needed.

**Reading beats** differ by prototype. Both start with the animated welcome. A then
goes straight to the interleaved checks and ends on a short wrap. B has three large,
centered reading pages before the checks: look-at-your-phone (an iPhone mockup with
a Dynamic Island and Contacts / Photos / Music tiles), why-organize (icon-bulleted
examples), and the-three-jobs (tap-to-reveal cards, the page's main content). Each check shows a scenario icon (Wi-Fi, contacts, photos, search), a
`scenario`, and a large `ask`; the answer is never spelled out on the page. The why
check goes further: its two options are labeled object pictures (a neat alphabetized
set vs a messy shoebox of cards) that the learner taps directly.

**Reading helpers (B).** As a page settles, its important concepts glow one after
another and rest in lilac (the `.concept` highlight in `index.css`, sequenced by an
inline `animation-delay`), guiding the eye through the key terms. The three-jobs
cards are tap-to-reveal so the definitions are recalled, not just read. (The old
"many shapes" page 4 was cut to keep the intro tight.)

## Architecture (reuses the existing seam)

- **Engine:** `src/features/lesson/introEngine.ts`. One pure reducer over
  `IntroState`, generic on `variant: "reveal" | "pages"`. Beats are
  `read | check`; `continue` advances reading beats, `select/check/reveal/
  reattempt/next` drive checks; reaching the end sets `completed`. Reuses the
  shared `gradeAnswer` + `LessonAction`/`LessonProgress` shapes.
- **Stage:** `src/lessons/intro/IntroStage.tsx`. One Stage for both variants:
  renders read beats (eyebrow + title + body + optional job cards), check beats
  (prompt + answer cards + `FeedbackFooter`), and a done recap. In `reveal` it
  shows the teach line first, then animates the question in after a short beat
  (reduced-motion: immediate).
- **Modules:** `src/lessons/intro.tsx` exports `introRevealModule` and
  `introPagesModule` behind the standard `LessonModule` seam.
- **Gallery:** two labs (`intro-reveal`, `intro-pages`) registered in
  `src/dev/GalleryApp.tsx` with presets for the key beats, rendered through the
  real `AppShell` + `LessonTopBar` chrome like every other lab.

## Out of scope (for the prototype)

- (Done) The "pages" variant is now wired into `catalog.ts` / `lessons.ts` as the
  first lesson; completing it unlocks Stacks & Queues.
- No randomized question variants yet (authored, seedable later).
- No persistence beyond what the seam needs to satisfy the type.

## Open questions to settle during user testing

- Which shape wins (A vs B), or a hybrid (short pages, then interleaved checks)?
- Reading depth and tone on B's pages; whether a figure per page is worth it.
- Whether the intro needs a richer assessment than "name the job" (e.g. a tiny
  scenario-to-structure teaser), or stays deliberately easy for the early win.
