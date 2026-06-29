import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { StructureKind, Verdict } from "@/features/trials/types"
import { a1Intake, a2Cancellation } from "@/trials/trialOne/missionA"

import { StressTestPanel } from "./StressTestPanel"

// a2 ("a middle student cancels") is the one segment whose authored copy covers
// all three verdicts with distinct text, so it pins both the controls and the
// per-status explanation in one place.
function renderPanel(
  status: Verdict,
  structure: StructureKind,
  handlers?: { onContinue?: () => void; onRevise?: () => void },
) {
  const onContinue = handlers?.onContinue ?? vi.fn()
  const onRevise = handlers?.onRevise ?? vi.fn()
  render(
    <StressTestPanel
      status={status}
      segment={a2Cancellation}
      structure={structure}
      nudge={a2Cancellation.nudges.middle}
      onContinue={onContinue}
      onRevise={onRevise}
    />,
  )
  return { onContinue, onRevise }
}

describe("StressTestPanel controls per verdict", () => {
  it("broken shows only Revise (no Continue) and the broken explanation", () => {
    const { onRevise } = renderPanel("broken", "queue")

    expect(
      screen.getByText(a2Cancellation.explanations.broken),
    ).toBeInTheDocument()
    expect(screen.getByText(/your design breaks/i)).toBeInTheDocument()

    const revise = screen.getByRole("button", { name: /revise/i })
    expect(revise).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /continue/i }),
    ).not.toBeInTheDocument()

    fireEvent.click(revise)
    expect(onRevise).toHaveBeenCalledTimes(1)
  })

  it("strained shows Continue + Revise and the strained explanation", () => {
    const { onContinue, onRevise } = renderPanel("strained", "array")

    expect(
      screen.getByText(a2Cancellation.explanations.strained),
    ).toBeInTheDocument()
    expect(screen.getByText(/your design holds, but strains/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /continue/i }))
    fireEvent.click(screen.getByRole("button", { name: /revise/i }))
    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(onRevise).toHaveBeenCalledTimes(1)
  })

  it("viable shows only Continue (no Revise) and the viable explanation", () => {
    const { onContinue } = renderPanel("viable", "linked-list")

    expect(
      screen.getByText(a2Cancellation.explanations.viable),
    ).toBeInTheDocument()
    expect(screen.getByText(/your design holds up/i)).toBeInTheDocument()

    const cont = screen.getByRole("button", { name: /continue/i })
    expect(cont).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /revise/i }),
    ).not.toBeInTheDocument()

    fireEvent.click(cont)
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it("surfaces the segment nudge only when not viable", () => {
    const { rerender } = render(
      <StressTestPanel
        status="broken"
        segment={a2Cancellation}
        structure="queue"
        nudge={a2Cancellation.nudges.middle}
        onContinue={vi.fn()}
        onRevise={vi.fn()}
      />,
    )
    expect(
      screen.getByText(a2Cancellation.nudges.middle),
    ).toBeInTheDocument()

    rerender(
      <StressTestPanel
        status="viable"
        segment={a2Cancellation}
        structure="linked-list"
        nudge={a2Cancellation.nudges.middle}
        onContinue={vi.fn()}
        onRevise={vi.fn()}
      />,
    )
    expect(
      screen.queryByText(a2Cancellation.nudges.middle),
    ).not.toBeInTheDocument()
  })
})

// The browser dev lab is the visual check; this exercises every figure code path
// in jsdom so a structure/verdict combination can't crash the player. Broken hits
// BlockedFigure -> StructureFigure (every structure); the non-broken row hits the
// per-structure consequence figures (queue serve, stack pop, array shift, list relink).
describe("StressTestPanel renders every structure/verdict figure", () => {
  const structures: StructureKind[] = ["queue", "stack", "array", "linked-list"]
  const verdictText: Record<Verdict, RegExp> = {
    viable: /your design holds up/i,
    strained: /your design holds, but strains/i,
    broken: /your design breaks/i,
  }
  for (const structure of structures) {
    for (const status of ["viable", "broken"] as Verdict[]) {
      it(`${structure} / ${status} renders without crashing`, () => {
        renderPanel(status, structure)
        expect(screen.getByText(verdictText[status])).toBeInTheDocument()
      })
    }
  }

  it("renders the linked-list head-removal (a1) consequence", () => {
    render(
      <StressTestPanel
        status="viable"
        segment={a1Intake}
        structure="linked-list"
        onContinue={vi.fn()}
        onRevise={vi.fn()}
      />,
    )
    expect(screen.getByText(/your design holds up/i)).toBeInTheDocument()
  })
})
