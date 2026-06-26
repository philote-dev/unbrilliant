import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

import { MasteryWillow } from "./MasteryWillow"

describe("MasteryWillow", () => {
  it("labels the image with the current growth stage", () => {
    render(<MasteryWillow lessonsDone={20} totalLessons={20} />)
    expect(screen.getByRole("img", { name: /full/i })).toBeInTheDocument()
  })

  it("renders the sprout stage when totalLessons is zero", () => {
    render(<MasteryWillow lessonsDone={5} totalLessons={0} />)
    expect(screen.getByRole("img", { name: /sprout/i })).toBeInTheDocument()
  })

  it("renders autumn decay leaves when retention is low", () => {
    render(<MasteryWillow lessonsDone={20} totalLessons={20} retention={0.2} />)
    const decay = screen.getByTestId("canopy-decay")
    expect(decay).toBeInTheDocument()
    expect(decay.querySelectorAll("path").length).toBeGreaterThan(0)
  })

  it("renders no decay overlay at full retention", () => {
    render(<MasteryWillow lessonsDone={20} totalLessons={20} retention={1} />)
    expect(screen.queryByTestId("canopy-decay")).not.toBeInTheDocument()
  })

  it("renders the glow overlay by default", () => {
    render(<MasteryWillow lessonsDone={10} totalLessons={20} />)
    expect(screen.getByTestId("canopy-glow")).toBeInTheDocument()
  })

  it("omits the glow overlay when glow is disabled", () => {
    render(<MasteryWillow lessonsDone={10} totalLessons={20} glow={false} />)
    expect(screen.queryByTestId("canopy-glow")).not.toBeInTheDocument()
  })
})
