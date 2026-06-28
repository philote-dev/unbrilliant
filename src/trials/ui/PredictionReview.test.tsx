import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

// Anonymous user keeps the provider memory-only (no repo/firebase access), which is
// all PredictionReview needs: it reads run state and dispatches.
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: null }) }))
vi.mock("@/lib/firebase", () => ({ db: {} }))

import { TrialRunProvider } from "@/features/trials/TrialRunProvider"
import type { ProgressRepository } from "@/features/progress/ProgressRepository"
import type { TrialSpec } from "@/features/trials/types"

import { PredictionReview } from "./PredictionReview"

// One prediction segment. Script: A and B arrive, the front is served, leaving [B]
// -> the true front is "B".
const PRED_SPEC: TrialSpec = {
  id: "trial-pred-ui",
  title: "Pred UI",
  exercisedConcepts: [],
  missions: [
    {
      id: "m",
      clientSkin: "x",
      segments: [
        {
          id: "p1",
          clientPrompt: "predict",
          offeredStructures: [],
          operations: [],
          required: [],
          grading: "prediction",
          eventScript: [
            { t: "arrive", id: "A" },
            { t: "arrive", id: "B" },
            { t: "serve" },
          ],
          explanations: {
            viable: "You traced it correctly.",
            strained: "Close.",
            broken: "Re-trace it slowly.",
          },
          nudges: { sep: "Keep the jobs separate." },
          brokenNudgeId: "sep",
        },
      ],
    },
  ],
}

function renderReview() {
  // Anonymous run never touches the repo, so a stub satisfies the prop.
  const repo = {} as unknown as ProgressRepository
  return render(
    <TrialRunProvider spec={PRED_SPEC} repo={repo} onTrialComplete={() => {}}>
      <PredictionReview />
    </TrialRunProvider>,
  )
}

describe("PredictionReview", () => {
  it("lets you predict and shows the correct result with Continue", () => {
    renderReview()
    fireEvent.click(screen.getByRole("button", { name: "B" }))
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }))

    expect(screen.getByText("Correct")).toBeInTheDocument()
    expect(screen.getByText("You traced it correctly.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })

  it("flags a wrong prediction with the divergence and a retry", () => {
    renderReview()
    fireEvent.click(screen.getByRole("button", { name: "A" }))
    fireEvent.click(screen.getByRole("button", { name: /lock in prediction/i }))

    expect(screen.getByText("Not yet")).toBeInTheDocument()
    expect(screen.getByText(/the front ends up being/i)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /try the trace again/i }),
    ).toBeInTheDocument()
  })
})
