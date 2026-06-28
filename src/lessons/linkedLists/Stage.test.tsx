import { useReducer } from "react"
import { describe, it, expect, beforeAll } from "vitest"
import { render, fireEvent, screen, within } from "@testing-library/react"

import {
  linkedListsReducer,
  resumeLinkedLists,
  type LinkedListsState,
} from "@/features/lesson/linkedListsEngine"
import { LinkedListsStage } from "./Stage"

/**
 * DOM tests for the Linked Lists stage. A useReducer harness drives the real
 * engine, so a tap travels through dispatch -> reducer -> re-render exactly as in
 * the app. jsdom can't measure geometry, so these cover the interaction wiring:
 * the forced-walk frontier gate, the playlist synthesis, the two-step contrast,
 * and the doubly splice / backward walk.
 */

beforeAll(() => {
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })
  }
})

const SEED = 7

function atState(part: string): LinkedListsState {
  return resumeLinkedLists({ counters: {}, currentPart: part, completed: false }, SEED)
}

function Harness({ initial }: { initial: LinkedListsState }) {
  const [state, dispatch] = useReducer(linkedListsReducer, initial)
  return <LinkedListsStage state={state} dispatch={dispatch} />
}

/** The enabled, tappable walk nodes (those carry an aria-label "node X"). */
function tappableWalkNodes(): string[] {
  return screen
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-label")?.startsWith("node ") && !b.hasAttribute("disabled"))
    .map((b) => b.getAttribute("aria-label")!.replace("node ", ""))
}

/** Click a rewire row/source by its source id, then a target by its target id. */
function rewireByTap(from: string, to: string): void {
  const src = document.querySelector<HTMLElement>(`[data-rewire-source="${from}"]`)!
  fireEvent.click(src)
  const tgt = document.querySelector<HTMLElement>(`[data-rewire-target="${to}"]`)!
  fireEvent.click(tgt)
}

/** Click the option/chip button whose visible text contains `label`. */
function clickOption(label: string): void {
  const btn = screen.getAllByRole("button").find((b) => b.textContent?.includes(label))
  if (!btn) throw new Error(`no option button containing "${label}"`)
  fireEvent.click(btn)
}

describe("LinkedListsStage - traverse forced walk", () => {
  it("makes only the next hop tappable (you cannot one-tap the answer node)", () => {
    const initial = atState("traverse")
    const q = initial.question!
    render(<Harness initial={initial} />)
    // Exactly one node is tappable, and it is the head's successor (the next hop).
    expect(tappableWalkNodes()).toEqual([q.nodes[1]])

    // Take one hop; the frontier moves to the following node.
    fireEvent.click(screen.getByRole("button", { name: `node ${q.nodes[1]}` }))
    expect(tappableWalkNodes()).toEqual([q.nodes[2]])
  })
})

describe("LinkedListsStage - playlist synthesis", () => {
  it("runs insert -> delete -> reorder and clears as one slot", () => {
    const initial = atState("playlist")
    const q = initial.question!
    render(<Harness initial={initial} />)
    expect(screen.getByRole("heading", { name: "Queue" })).toBeInTheDocument()

    for (const w of q.flatWrites) rewireByTap(w.from, w.to)

    // The whole script lands -> a Continue button appears.
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })
})

describe("LinkedListsStage - contrast two-step", () => {
  it("shows the de-cued pick, then the graded why-MCQ", () => {
    const initial = atState("contrast-insert")
    const q = initial.question!
    render(<Harness initial={initial} />)

    // Pick step: neutral structure labels only (as option buttons).
    expect(screen.getAllByRole("button").some((b) => b.textContent?.includes("List"))).toBe(true)
    expect(screen.getAllByRole("button").some((b) => b.textContent?.includes("Array"))).toBe(true)

    clickOption("List")
    fireEvent.click(screen.getByRole("button", { name: "Check" }))

    // Why step: the reason options appear (the real graded check).
    const whyLabel = q.whyOptions.find((o) => o.id === q.whyAnswer)!.label
    clickOption(whyLabel)
    fireEvent.click(screen.getByRole("button", { name: "Check" }))
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })
})

describe("LinkedListsStage - doubly splice", () => {
  it("clears when the four writes are tapped in order; a wrong order nudges", () => {
    const initial = atState("doubly-splice")
    const q = initial.question!
    render(<Harness initial={initial} />)

    // Tapping a later write before its turn only nudges (no Continue yet).
    clickOption(q.doublyWrites[2].label)
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull()

    // Tapping all four in the correct save-first order clears the beat.
    for (const w of q.doublyWrites) clickOption(w.label)
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
  })
})

describe("LinkedListsStage - doubly walk (backward)", () => {
  it("starts at the tail and makes only the previous node tappable", () => {
    const initial = atState("doubly-walk")
    const q = initial.question!
    render(<Harness initial={initial} />)
    const tail = q.nodes.length - 1
    // Only the node just before the tail is tappable (the backward frontier).
    expect(tappableWalkNodes()).toEqual([q.nodes[tail - 1]])
  })
})

describe("LinkedListsStage - teach + demo render", () => {
  it("renders the demo and teach beats without crashing", () => {
    const demo = render(<Harness initial={atState("node-demo")} />)
    expect(within(demo.container).getByText("It's the arrows")).toBeInTheDocument()
    demo.unmount()
    render(<Harness initial={atState("teach")} />)
    expect(screen.getByText("Walk from the head")).toBeInTheDocument()
  })
})

/**
 * Regression: the post-commit REPLAY runs in NodeGraph `replay` mode, which draws
 * the loose new node ("X") and its arrows. The X box was only positioned in
 * `rewire` mode, so the replay read an undefined box and threw "Cannot read
 * properties of undefined (reading 'x')". These render the two replay reveals that
 * include X and assert they mount without throwing.
 */
function reduce(s: LinkedListsState, ...actions: Parameters<typeof linkedListsReducer>[1][]): LinkedListsState {
  return actions.reduce(linkedListsReducer, s)
}

describe("LinkedListsStage - replay reveals mount without crashing (regression)", () => {
  it("renders the rewire-insert post-correct replay (the loose X is drawn)", () => {
    let s = atState("rewire-insert")
    for (const w of s.question!.rewires) s = reduce(s, { type: "rewire", from: w.from, to: w.to })
    s = reduce(s, { type: "check" })
    expect(s.feedback).toBe("correct")
    expect(() => render(<Harness initial={s} />)).not.toThrow()
  })

  it("renders the predict break reveal on a correct answer", () => {
    let s = atState("predict")
    s = reduce(s, { type: "select", letter: s.question!.answer }, { type: "check" })
    expect(s.feedback).toBe("correct")
    expect(() => render(<Harness initial={s} />)).not.toThrow()
  })

  it("renders the predict break reveal on a failed answer + Why", () => {
    let s = atState("predict")
    const wrong = s.question!.options.find((o) => o.id !== s.question!.answer)!.id
    s = reduce(
      s,
      { type: "select", letter: wrong },
      { type: "check" },
      { type: "check" },
      { type: "reveal" },
    )
    expect(s.feedback).toBe("fail")
    expect(s.showWhy).toBe(true)
    expect(() => render(<Harness initial={s} />)).not.toThrow()
  })
})
