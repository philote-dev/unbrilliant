# Phase 2 Chunk 1: Functions Backend Seam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the project's first backend (a Firebase `functions/` workspace) and prove a secure, authenticated round-trip from the React client through a callable Cloud Function to OpenAI and back, with the API key held as a Functions secret.

**Architecture:** A new `functions/` TypeScript package exposes one v2 callable, `polyHealthCheck`, that reads `OPENAI_API_KEY` from a Functions secret, sends a fixed server-controlled prompt to OpenAI, and returns a small typed result. The OpenAI call sits behind a thin injectable `Completer` interface so the handler logic is unit-testable without network access. The browser calls the function through a new client seam (`src/lib/ai/polyClient.ts`) over the Firebase Functions SDK, wired to the emulator in dev. No feature logic (rubric, verifier, hints, Poly) ships in this chunk.

**Tech Stack:** Firebase Cloud Functions v2 (`firebase-functions` v7, `onCall`, `defineSecret`/`defineString`), OpenAI Node SDK (`openai`, `chat.completions.create`), TypeScript, Vitest, Firebase Functions emulator, firebase-js-sdk `firebase/functions` client.

---

## Context and prerequisites

- This is **chunk 1 of 5** from `docs/plans/specs/2026-06-25-phase2-ai-features-design.md`. It builds the seam that chunks 2 to 5 ride on. Do not add rubric/verifier/hint/Poly logic here.
- Work happens in the worktree on branch `feat/phase2-functions-seam`. Root deps are already installed and the baseline is green (49 files, 712 tests).
- **Security invariant (carried through every task):** the OpenAI key never reaches the browser, and the client never sends prompts. The health check's prompt is fixed server-side. Keep it that way.
- **Auth invariant:** the app supports signed-out play with no Firebase auth user, so the callable must NOT require auth. Capture `request.auth?.uid ?? null` for logging only.
- Commands below are written to run from the **repo root** unless they `cd functions`.

---

### Task 1: Scaffold the `functions/` workspace

**Files:**
- Create: `functions/package.json`
- Create: `functions/tsconfig.json`
- Create: `functions/vitest.config.ts`
- Create: `functions/src/index.ts`
- Modify: `.gitignore` (append `functions/lib`)

- [ ] **Step 1: Create `functions/package.json`**

```json
{
  "name": "functions",
  "description": "Cloud Functions for unbrilliant (Poly AI seam)",
  "private": true,
  "main": "lib/index.js",
  "engines": {
    "node": "20"
  },
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "serve": "npm run build && firebase emulators:start --only functions"
  }
}
```

- [ ] **Step 2: Create `functions/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2022",
    "moduleResolution": "node",
    "outDir": "lib",
    "rootDir": "src",
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "lib", "**/*.test.ts"]
}
```

- [ ] **Step 3: Create a buildable stub `functions/src/index.ts`**

```typescript
// Cloud Functions entrypoint. Exports are added as functions are implemented.
export {}
```

- [ ] **Step 4: Create `functions/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "lib/**"],
  },
})
```

- [ ] **Step 5: Install runtime and dev dependencies in `functions/`**

Run:

```bash
cd functions && npm install firebase-functions openai && npm install -D typescript vitest @types/node && cd ..
```

Expected: installs complete, `functions/node_modules` and `functions/package-lock.json` created, 0 vulnerabilities (or only advisory warnings).

- [ ] **Step 6: Ignore the functions build output**

Append to `.gitignore` (the existing `node_modules`, `.env`, and `*.local` rules already cover `functions/node_modules`, `functions/.env`, and `functions/.secret.local`):

```
# Cloud Functions build output
functions/lib
```

- [ ] **Step 7: Verify the workspace builds**

Run:

```bash
npm --prefix functions run build
```

Expected: exits 0, creates `functions/lib/index.js`. No TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add functions/package.json functions/tsconfig.json functions/vitest.config.ts functions/src/index.ts functions/package-lock.json .gitignore
git commit -m "chore: scaffold functions/ workspace for the Poly AI seam"
```

---

### Task 2: OpenAI completer wrapper (TDD)

A thin, injectable wrapper so handler logic can be tested without hitting the network.

**Files:**
- Create: `functions/src/openai.ts`
- Test: `functions/src/openai.test.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/openai.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest"
import { openAICompleter } from "./openai"

describe("openAICompleter", () => {
  it("sends system+user messages to chat.completions and returns the content", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "  hello  " } }],
    })
    const fakeClient = { chat: { completions: { create } } }
    const completer = openAICompleter(fakeClient as never)

    const out = await completer.complete({ system: "S", user: "U", model: "m" })

    expect(create).toHaveBeenCalledWith({
      model: "m",
      messages: [
        { role: "system", content: "S" },
        { role: "user", content: "U" },
      ],
    })
    expect(out).toBe("  hello  ")
  })

  it("returns an empty string when the model returns no content", async () => {
    const create = vi.fn().mockResolvedValue({ choices: [] })
    const completer = openAICompleter({ chat: { completions: { create } } } as never)
    expect(await completer.complete({ system: "S", user: "U", model: "m" })).toBe("")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd functions && npx vitest run src/openai.test.ts; cd ..
```

Expected: FAIL with a resolve/import error (`openAICompleter` / `./openai` not found).

- [ ] **Step 3: Write the minimal implementation**

Create `functions/src/openai.ts`:

```typescript
import OpenAI from "openai"

export interface CompletionRequest {
  system: string
  user: string
  model: string
}

export interface Completer {
  complete(req: CompletionRequest): Promise<string>
}

export function createClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey })
}

export function openAICompleter(client: OpenAI): Completer {
  return {
    async complete({ system, user, model }) {
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      })
      return res.choices[0]?.message?.content ?? ""
    },
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd functions && npx vitest run src/openai.test.ts; cd ..
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/src/openai.ts functions/src/openai.test.ts
git commit -m "feat: add injectable OpenAI completer wrapper"
```

---

### Task 3: `polyHealthCheck` callable (TDD)

The pure `runHealthCheck` logic is unit-tested; the thin `onCall` wrapper is verified manually via the emulator in Task 6.

**Files:**
- Create: `functions/src/healthCheck.ts`
- Test: `functions/src/healthCheck.test.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `functions/src/healthCheck.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest"
import { runHealthCheck } from "./healthCheck"
import type { Completer } from "./openai"

function completerReturning(reply: string): Completer {
  return { complete: vi.fn().mockResolvedValue(reply) }
}

describe("runHealthCheck", () => {
  it("returns ok with the trimmed reply, model, and uid", async () => {
    const res = await runHealthCheck(completerReturning("  pong\n"), "gpt-test", "user-1")
    expect(res).toEqual({ ok: true, model: "gpt-test", reply: "pong", uid: "user-1" })
  })

  it("passes a null uid through for anonymous callers", async () => {
    const res = await runHealthCheck(completerReturning("pong"), "gpt-test", null)
    expect(res.uid).toBeNull()
  })

  it("propagates completer errors to the caller", async () => {
    const failing: Completer = { complete: vi.fn().mockRejectedValue(new Error("boom")) }
    await expect(runHealthCheck(failing, "gpt-test", null)).rejects.toThrow("boom")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd functions && npx vitest run src/healthCheck.test.ts; cd ..
```

Expected: FAIL with a resolve/import error (`runHealthCheck` / `./healthCheck` not found).

- [ ] **Step 3: Write the minimal implementation**

Create `functions/src/healthCheck.ts`:

```typescript
import { onCall, HttpsError } from "firebase-functions/https"
import { defineSecret, defineString } from "firebase-functions/params"
import { Completer, createClient, openAICompleter } from "./openai"

export const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY")
export const OPENAI_MODEL = defineString("OPENAI_MODEL", { default: "gpt-4o-mini" })

const HEALTH_SYSTEM = "You are a health check. Reply with exactly the single word: pong"
const HEALTH_USER = "ping"

export interface HealthResult {
  ok: boolean
  model: string
  reply: string
  uid: string | null
}

export async function runHealthCheck(
  completer: Completer,
  model: string,
  uid: string | null,
): Promise<HealthResult> {
  const reply = await completer.complete({
    system: HEALTH_SYSTEM,
    user: HEALTH_USER,
    model,
  })
  return { ok: true, model, reply: reply.trim(), uid }
}

export const polyHealthCheck = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (request): Promise<HealthResult> => {
    try {
      const completer = openAICompleter(createClient(process.env.OPENAI_API_KEY ?? ""))
      return await runHealthCheck(completer, OPENAI_MODEL.value(), request.auth?.uid ?? null)
    } catch {
      throw new HttpsError("internal", "OpenAI health check failed")
    }
  },
)
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd functions && npx vitest run src/healthCheck.test.ts; cd ..
```

Expected: PASS (3 tests).

- [ ] **Step 5: Export the function from the entrypoint**

Replace the contents of `functions/src/index.ts`:

```typescript
export { polyHealthCheck } from "./healthCheck"
```

- [ ] **Step 6: Verify the whole functions package builds and tests pass**

Run:

```bash
npm --prefix functions run build && npm --prefix functions test
```

Expected: build exits 0; Vitest reports 5 tests passed (2 from Task 2, 3 from Task 3).

- [ ] **Step 7: Commit**

```bash
git add functions/src/healthCheck.ts functions/src/healthCheck.test.ts functions/src/index.ts
git commit -m "feat: add polyHealthCheck callable with OPENAI_API_KEY secret"
```

---

### Task 4: Wire Firebase config (functions codebase + emulator port)

**Files:**
- Modify: `firebase.json`

- [ ] **Step 1: Add the functions codebase and emulator port**

Edit `firebase.json` to add a top-level `functions` array and a `functions` entry under `emulators`. The result must be:

```json
{
  "firestore": {
    "database": "(default)",
    "location": "nam5",
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": ["node_modules", ".git", "*.local", "**/*.test.ts"],
      "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
    }
  ],
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "emulators": {
    "singleProjectMode": true,
    "auth": {
      "port": 9099
    },
    "firestore": {
      "port": 8080
    },
    "functions": {
      "port": 5001
    },
    "hosting": {
      "port": 5000
    },
    "ui": {
      "enabled": true
    }
  },
  "auth": {
    "providers": {}
  }
}
```

- [ ] **Step 2: Verify the config parses**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('firebase.json','utf8')); console.log('firebase.json OK')"
```

Expected: prints `firebase.json OK`.

- [ ] **Step 3: Commit**

```bash
git add firebase.json
git commit -m "chore: register functions codebase and emulator port"
```

---

### Task 5: Client seam (TDD)

Wire the Functions SDK into the existing Firebase setup and add a typed client helper the React app will use.

**Files:**
- Modify: `src/lib/firebase.ts`
- Create: `src/lib/ai/polyClient.ts`
- Test: `src/lib/ai/polyClient.test.ts`

- [ ] **Step 1: Add the Functions SDK to the Firebase wiring**

In `src/lib/firebase.ts`, add the import alongside the existing firestore import:

```typescript
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from "firebase/functions"
```

Add the export next to `export const db`:

```typescript
export const functions: Functions = getFunctions(app)
```

Add the emulator connection inside the existing guarded block, next to the other `connect*Emulator` calls:

```typescript
  connectFunctionsEmulator(functions, "127.0.0.1", 5001)
```

The guarded block must end up as:

```typescript
if (useEmulator && !g.__willowEmulatorsConnected) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true })
  connectFirestoreEmulator(db, "127.0.0.1", 8080)
  connectFunctionsEmulator(functions, "127.0.0.1", 5001)
  g.__willowEmulatorsConnected = true
}
```

- [ ] **Step 2: Write the failing client test**

Create `src/lib/ai/polyClient.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockCallable } = vi.hoisted(() => ({ mockCallable: vi.fn() }))

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(() => mockCallable),
}))
vi.mock("@/lib/firebase", () => ({ functions: {} }))

import { polyHealthCheck } from "./polyClient"

describe("polyHealthCheck client", () => {
  beforeEach(() => mockCallable.mockReset())

  it("returns the callable's result data", async () => {
    mockCallable.mockResolvedValue({
      data: { ok: true, model: "m", reply: "pong", uid: null },
    })
    const res = await polyHealthCheck()
    expect(res).toEqual({ ok: true, model: "m", reply: "pong", uid: null })
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```bash
npx vitest run src/lib/ai/polyClient.test.ts
```

Expected: FAIL with a resolve/import error (`./polyClient` not found).

- [ ] **Step 4: Write the minimal implementation**

Create `src/lib/ai/polyClient.ts`:

```typescript
import { httpsCallable } from "firebase/functions"

import { functions } from "@/lib/firebase"

export interface HealthResult {
  ok: boolean
  model: string
  reply: string
  uid: string | null
}

export async function polyHealthCheck(): Promise<HealthResult> {
  const callable = httpsCallable<Record<string, never>, HealthResult>(
    functions,
    "polyHealthCheck",
  )
  const res = await callable({})
  return res.data
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
npx vitest run src/lib/ai/polyClient.test.ts
```

Expected: PASS (1 test).

- [ ] **Step 6: Verify the full root suite and typecheck stay green**

Run:

```bash
npm test && npx tsc -b && npm run lint
```

Expected: Vitest reports 713 tests passed (712 baseline + 1 new); `tsc -b` exits 0; oxlint exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/firebase.ts src/lib/ai/polyClient.ts src/lib/ai/polyClient.test.ts
git commit -m "feat: add Functions client seam and polyHealthCheck helper"
```

---

### Task 6: End-to-end manual verification and PR

Automated tests mock OpenAI; this task proves the real round-trip once, then opens the PR. The manual OpenAI call requires a real key and makes one tiny billable request.

**Files:** none (verification + docs in the PR body).

- [ ] **Step 1: Provide the secret to the local emulator**

Create `functions/.secret.local` (gitignored via the `*.local` rule) with the real key:

```
OPENAI_API_KEY="sk-...your key..."
```

If your key does not have access to `gpt-4o-mini`, also create `functions/.env.local` with a model it does support:

```
OPENAI_MODEL="<a-model-your-key-can-use>"
```

- [ ] **Step 2: Build functions and start the emulator**

Run (leave this running; use a second terminal for Step 3):

```bash
npm --prefix functions run build
firebase emulators:start --only functions --project demo-willow
```

Expected: emulator logs `polyHealthCheck` as a loaded callable and prints the functions emulator URL on port 5001.

- [ ] **Step 3: Call the function and confirm the round-trip**

In a second terminal, run:

```bash
curl -s -X POST \
  http://127.0.0.1:5001/demo-willow/us-central1/polyHealthCheck \
  -H "Content-Type: application/json" \
  -d '{"data":{}}'
```

Expected: a JSON body of the form `{"result":{"ok":true,"model":"gpt-4o-mini","reply":"pong","uid":null}}` (the `reply` is whatever the model returns; `ok:true` and a non-empty `reply` is the success signal). If you instead get an `error` with `OpenAI health check failed`, the key or model is wrong; fix `functions/.secret.local` / `functions/.env.local` and retry.

- [ ] **Step 4: Stop the emulator**

Press Ctrl+C in the emulator terminal. Confirm `functions/.secret.local` is NOT staged (`git status` should not list it).

- [ ] **Step 5: Push the branch and open the PR**

Run:

```bash
git push -u origin feat/phase2-functions-seam
```

Then open the PR with this body (fill the verification result):

```bash
gh pr create --title "Phase 2 chunk 1: functions backend seam (Poly AI)" --body "$(cat <<'EOF'
## Summary
- Adds the project's first backend: a `functions/` TypeScript workspace.
- Adds the `polyHealthCheck` v2 callable that reads `OPENAI_API_KEY` from a Functions secret, sends a fixed server-side prompt to OpenAI, and returns a typed result. The key never reaches the browser and the client sends no prompt.
- Wires the Functions SDK into the client (`src/lib/firebase.ts`) and adds `src/lib/ai/polyClient.ts` as the call seam.
- This is chunk 1 of 5 from `docs/plans/specs/2026-06-25-phase2-ai-features-design.md`.

## Test plan
- [ ] `npm --prefix functions test` (5 passed)
- [ ] `npm test` at root (713 passed)
- [ ] `npx tsc -b` and `npm run lint` clean
- [ ] Manual: emulator + curl returns `ok:true` with a non-empty reply (verified locally)

## Deploy notes (not required for the local demo loop)
Deploying functions that call OpenAI requires the Blaze plan. To deploy:
`firebase functions:secrets:set OPENAI_API_KEY` then `firebase deploy --only functions`.
EOF
)"
```

- [ ] **Step 6: Report the PR URL** to the user and stop. Do not merge.

---

## Out of scope (later chunks)

- Rubric data, skill-to-proposition map, no-giveaway verifier (chunk 2).
- Poly hints on construct beats (chunk 3).
- Poly self-explanation checkpoints (chunk 4).
- Voice (chunk 5).
- App Check / abuse hardening on the callable (post-Friday; noted in the spec).
- Updating `docs/architecture.md` and `docs/lesson-design.md` for the determinism reconciliation (folded into a later chunk per the spec).

## Self-review checklist (run before requesting review)

- [ ] No prompts are sent from the client; the health-check prompt is fixed in `functions/src/healthCheck.ts`.
- [ ] The callable does not require auth (anonymous play still works); `uid` is captured, not enforced.
- [ ] `functions/.secret.local` and `functions/lib` are untracked.
- [ ] `npm --prefix functions test`, root `npm test`, `tsc -b`, and `npm run lint` are all green.
