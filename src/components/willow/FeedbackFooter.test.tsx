import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { FeedbackFooter } from "./FeedbackFooter"
import type { QuestionCopy } from "@/features/lesson/engine"

const copy: QuestionCopy = {
  prompt: "p",
  hint: "static idle hint",
  nudge: "static nudge",
  correct: "c",
  why: "w",
}

function renderFooter(extra: Partial<Parameters<typeof FeedbackFooter>[0]>) {
  return render(
    <FeedbackFooter
      feedback="nudge"
      selected={null}
      showWhy={false}
      copy={copy}
      dispatch={vi.fn()}
      canCheck
      {...extra}
    />,
  )
}

describe("FeedbackFooter aiHint slot", () => {
  it("shows the static nudge when no aiHint is provided", () => {
    renderFooter({})
    expect(screen.getByText("static nudge")).toBeInTheDocument()
  })

  it("shows the thinking indicator while the aiHint is loading", () => {
    renderFooter({ aiHint: { loading: true, text: null } })
    expect(screen.getByText(/Poly is thinking/i)).toBeInTheDocument()
    expect(screen.queryByText("static nudge")).not.toBeInTheDocument()
  })

  it("shows the AI hint text when present", () => {
    renderFooter({ aiHint: { loading: false, text: "an ai nudge" } })
    expect(screen.getByText("an ai nudge")).toBeInTheDocument()
  })

  it("falls back to the static nudge when the aiHint resolved to null", () => {
    renderFooter({ aiHint: { loading: false, text: null } })
    expect(screen.getByText("static nudge")).toBeInTheDocument()
  })

  it("shows the thinking indicator on a fail while the aiHint is loading", () => {
    renderFooter({
      feedback: "fail",
      hideFailHint: true,
      aiHint: { loading: true, text: null },
    })
    expect(screen.getByText(/Poly is thinking/i)).toBeInTheDocument()
  })

  it("shows the AI hint text on a fail when present", () => {
    renderFooter({
      feedback: "fail",
      hideFailHint: true,
      aiHint: { loading: false, text: "an ai nudge" },
    })
    expect(screen.getByText("an ai nudge")).toBeInTheDocument()
  })
})
