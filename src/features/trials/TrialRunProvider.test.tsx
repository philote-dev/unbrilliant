import { useEffect } from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createInMemoryProgressRepository } from "@/features/progress/inMemoryProgressRepository"
import type { TrialAction } from "@/features/trials/trialModule"
import type { TrialSpec } from "@/features/trials/types"
import { TrialRunProvider, useTrialRun } from "./TrialRunProvider"

// Simulate sign-in the same way the screen tests do: a hoisted, mutable user the
// mocked `useAuth` returns. `@/lib/firebase` is stubbed so importing the provider
// never reaches the real SDK (the in-memory repo is injected instead).
const h = vi.hoisted(() => ({
  user: null as null | { uid: string; displayName: string; email: string | null },
}))
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: h.user }) }))
vi.mock("@/lib/firebase", () => ({ db: {} }))

// A minimal two-segment Trial: a queue answers both segments cleanly, so a full
// play-through completes with cleanPass === true.
const spec: TrialSpec = {
  id: "trial-test",
  title: "Test Trial",
  exercisedConcepts: ["c1", "c2"],
  missions: [
    {
      id: "m1",
      clientSkin: "desk",
      segments: [
        {
          id: "s1",
          clientPrompt: "",
          offeredStructures: ["queue"],
          operations: [
            { id: "arrival", label: "arrival", allowedPositions: ["front", "back"] },
            { id: "serve", label: "serve", allowedPositions: ["front", "back"] },
          ],
          required: [
            { op: "arrival", position: "back" },
            { op: "serve", position: "front" },
          ],
          grading: "capability",
          explanations: { viable: "v", strained: "s", broken: "b" },
          nudges: {},
        },
        {
          id: "s2",
          clientPrompt: "",
          offeredStructures: ["queue"],
          operations: [
            { id: "peek", label: "peek", allowedPositions: ["front", "back"] },
          ],
          required: [{ op: "peek", position: "front" }],
          grading: "capability",
          explanations: { viable: "v", strained: "s", broken: "b" },
          nudges: {},
        },
      ],
    },
  ],
}

// The clean path through both segments to completion.
const PLAY: TrialAction[] = [
  { type: "choose-structure", structure: "queue" },
  { type: "place-op", op: "arrival", position: "back" },
  { type: "place-op", op: "serve", position: "front" },
  { type: "run-stress" },
  { type: "advance" },
  { type: "choose-structure", structure: "queue" },
  { type: "place-op", op: "peek", position: "front" },
  { type: "run-stress" },
  { type: "advance" },
]

function Probe({ capture }: { capture: (d: (a: TrialAction) => void) => void }) {
  const { state, dispatch } = useTrialRun()
  useEffect(() => {
    capture(dispatch)
  }, [capture, dispatch])
  return <div data-testid="phase">{state.phase}</div>
}

beforeEach(() => {
  h.user = null
})

describe("TrialRunProvider", () => {
  it("on completion persists completed:true and fires onTrialComplete once with the run's cleanPass", async () => {
    h.user = { uid: "u1", displayName: "Tess", email: null }
    const repo = createInMemoryProgressRepository()
    const saveSpy = vi.spyOn(repo, "saveTrialProgress")
    const onTrialComplete = vi.fn()
    const cap = { dispatch: undefined as undefined | ((a: TrialAction) => void) }

    render(
      <TrialRunProvider spec={spec} repo={repo} onTrialComplete={onTrialComplete}>
        <Probe capture={(d) => (cap.dispatch = d)} />
      </TrialRunProvider>,
    )

    // Wait for the reconcile pass to settle (the first carry-up save lands).
    await waitFor(() => expect(saveSpy).toHaveBeenCalled())

    await act(async () => {
      for (const action of PLAY) cap.dispatch?.(action)
    })

    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("complete"))
    await waitFor(() => expect(onTrialComplete).toHaveBeenCalledTimes(1))
    expect(onTrialComplete).toHaveBeenCalledWith(spec, true)

    expect(saveSpy).toHaveBeenCalledWith(
      "u1",
      "trial-test",
      expect.objectContaining({ completed: true, cleanPass: true }),
    )
    const saved = await repo.getTrialProgress("u1", "trial-test")
    expect(saved?.completed).toBe(true)
  })

  it("anonymous runs stay in memory only (no persistence)", async () => {
    h.user = null
    const repo = createInMemoryProgressRepository()
    const saveSpy = vi.spyOn(repo, "saveTrialProgress")
    const onTrialComplete = vi.fn()
    const cap = { dispatch: undefined as undefined | ((a: TrialAction) => void) }

    render(
      <TrialRunProvider spec={spec} repo={repo} onTrialComplete={onTrialComplete}>
        <Probe capture={(d) => (cap.dispatch = d)} />
      </TrialRunProvider>,
    )

    await act(async () => {
      for (const action of PLAY) cap.dispatch?.(action)
    })

    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("complete"))
    expect(saveSpy).not.toHaveBeenCalled()
    expect(onTrialComplete).not.toHaveBeenCalled()
    expect(await repo.getTrialProgress("u1", "trial-test")).toBeNull()
  })
})
