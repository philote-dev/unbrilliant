import { render, screen } from "@testing-library/react"
import { describe, it, expect, beforeAll } from "vitest"

import type { Cell } from "@/features/lesson/stacksQueuesEngine"
import { PrinterShowpiece } from "./PrinterShowpiece"

/**
 * The full-bleed print-queue scene for the queue real-world predict. jsdom can't
 * measure motion, so these cover what it CAN: the scene renders, the FRONT
 * document (next to print) carries the single data-answer hook, the prompt shows
 * on the job display, the output tray stays empty until popping (then holds the
 * printed sheet), and reduced motion snaps to the end-state. No verdict is ever
 * computed here; the front document is the FIFO answer the engine already picked.
 */
beforeAll(() => {
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  }
})

const CELLS: Cell[] = [
  { id: "c1", label: "Report" },
  { id: "c2", label: "Essay" },
  { id: "c3", label: "Photo" },
  { id: "c4", label: "Memo" },
]
const ARRIVAL = ["c1", "c2", "c3", "c4"]

function renderScene(props: Partial<Parameters<typeof PrinterShowpiece>[0]> = {}) {
  return render(
    <PrinterShowpiece
      cells={CELLS}
      arrival={ARRIVAL}
      answerId="c1"
      cellState={() => "default"}
      {...props}
    />,
  )
}

describe("PrinterShowpiece", () => {
  it("renders the print queue and marks only the front document, leaking no verdict", () => {
    renderScene({ selectable: true })
    expect(screen.getByTestId("printer-showpiece")).toBeInTheDocument()
    // every document is shown
    for (const c of CELLS) expect(screen.getByText(c.label)).toBeInTheDocument()
    // nothing has printed yet
    expect(screen.getByTestId("printer-output").querySelectorAll("[data-cell]")).toHaveLength(0)
    // no SR status reveals anything before the learner answers
    expect(screen.queryByRole("status")).toBeNull()
    if (import.meta.env.DEV) {
      const marked = document.querySelectorAll('[data-answer="1"]')
      expect(marked).toHaveLength(1)
      expect(marked[0].getAttribute("data-cell")).toBe("c1")
    }
  })

  it("shows the prompt on the job display", () => {
    renderScene({ prompt: "Which document prints first?" })
    expect(screen.getByText("Which document prints first?")).toBeInTheDocument()
  })

  it("feeds the front document into the output tray once popping", () => {
    renderScene({
      popping: true,
      answerId: "c1",
      reducedMotion: true,
      cellState: (id) => (id === "c1" ? "correct" : "default"),
    })
    const output = screen.getByTestId("printer-output")
    expect(output.querySelector('[data-cell="c1"]')).not.toBeNull()
    // the printed document has left the waiting queue (only c2..c4 remain there)
    const queueButtons = document.querySelectorAll('button[data-cell]')
    expect(queueButtons).toHaveLength(3)
  })

  it("snaps to the end-state under reduced motion", () => {
    const { container } = renderScene({ reducedMotion: true })
    expect(container.querySelector("[data-reduced-motion='1']")).not.toBeNull()
  })
})
