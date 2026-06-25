import { render, screen, within } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { ClassifyReplay } from "./ClassifyReplay"

const IN = ["A", "B", "C"]

describe("ClassifyReplay", () => {
  it("shows In and Out rows but no verdict before the replay", () => {
    render(<ClassifyReplay inOrder={IN} outOrder={["C", "B", "A"]} verdict="stack" />)
    expect(screen.getByTestId("classify-replay")).toBeInTheDocument()
    expect(screen.queryByTestId("classify-verdict")).toBeNull()
    // no answer is leaked before the verdict (no status region, no verdict hook)
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("on replay, badges the verdict with icon + text and a dev hook (stack)", () => {
    render(
      <ClassifyReplay inOrder={IN} outOrder={["C", "B", "A"]} verdict="stack" replay reducedMotion />,
    )
    const badge = screen.getByTestId("classify-verdict")
    expect(badge).toHaveAttribute("data-classify-verdict", "stack")
    expect(badge).toHaveTextContent("A stack")
    expect(badge.querySelector("svg")).not.toBeNull()
  })

  it("labels a queue and a neither verdict distinctly", () => {
    const { rerender } = render(
      <ClassifyReplay inOrder={IN} outOrder={["A", "B", "C"]} verdict="queue" replay reducedMotion />,
    )
    expect(screen.getByTestId("classify-verdict")).toHaveTextContent("A queue")

    rerender(
      <ClassifyReplay inOrder={IN} outOrder={["C", "A", "B"]} verdict="neither" replay reducedMotion />,
    )
    expect(screen.getByTestId("classify-verdict")).toHaveAttribute(
      "data-classify-verdict",
      "neither",
    )
  })

  it("reduced-motion replay snaps to the out order", () => {
    render(
      <ClassifyReplay inOrder={IN} outOrder={["C", "B", "A"]} verdict="stack" replay reducedMotion />,
    )
    expect(screen.getByTestId("classify-replay")).toHaveAttribute("data-reduced-motion", "1")
  })

  it("announces a screen-reader status only once the replay runs", () => {
    const { rerender } = render(
      <ClassifyReplay
        inOrder={IN}
        outOrder={["C", "B", "A"]}
        verdict="stack"
        srLabel="Out is the exact reverse of in. A stack."
      />,
    )
    // not replaying: the label is withheld (no leak)
    expect(screen.queryByRole("status")).toBeNull()

    rerender(
      <ClassifyReplay
        inOrder={IN}
        outOrder={["C", "B", "A"]}
        verdict="stack"
        replay
        reducedMotion
        srLabel="Out is the exact reverse of in. A stack."
      />,
    )
    expect(screen.getByRole("status")).toHaveTextContent("Out is the exact reverse of in. A stack.")
  })
})
