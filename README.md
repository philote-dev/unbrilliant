# Willow

A mobile-first, **deterministic, no-AI** "learn data structures by doing" web app.
Grading is pure functions. The same state always yields the same feedback. Play
signed-out (a transient in-memory run) or sign in to save durable progress.

## Stack

React 19 · TypeScript · Vite 8 · Tailwind CSS v4 · Firebase (Auth + Firestore).
The `@/*` import alias maps to `src/*`.

## Quickstart

```bash
npm install
npm run dev   # Vite dev server, backed by the local Firebase emulators
```

Dev and tests **always** talk to the Firebase emulators via a `demo-` project, so
they can never reach a real Firebase project. Production builds read real config
from `VITE_*` env. See [`.env.example`](./.env.example).

## Scripts

| Script | What it does |
| ------ | ------------ |
| `npm run dev` | Dev server (emulator-backed) |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run lint` | Oxlint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:emulator` | Firestore rules/repo tests against the emulator |
| `npm run e2e` | Playwright end-to-end (emulator-backed) |

## Docs

- [`docs/architecture.md`](./docs/architecture.md): codebase flow & layers
- [`CONTEXT.md`](./CONTEXT.md): domain vocabulary (run vs. progress, reconcile, …)
