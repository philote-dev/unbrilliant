import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { StacksQueuesStage } from "./Stage"
import { createStacksQueues, type SQState } from "@/features/lesson/stacksQueuesEngine"

// The post-checkpoint beat (queue-demo) renders through StageCenter, which reads
// matchMedia; force reduced motion / desktop the way every sibling Stage test does.
beforeAll(() => {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
})

// The checkpoint pulls the signed-in user and the client; stub them so this test
// stays a pure renderer check (no Firebase, no network).
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: null }) }))
vi.mock("@/lib/ai/polyClient", () => ({
  scoreExplanation: vi.fn().mockResolvedValue({ scores: [{ id: "P1", verdict: "covered" }], weakest: null }),
  requestProbe: vi.fn().mockResolvedValue({ question: null }),
  // Checkpoint voice is on in the live Stage now, so the real PolyCheckpoint
  // speaks the question on mount; stub the audio callables to no-op so this
  // renderer test makes no network call and exercises the text path.
  speak: vi.fn().mockResolvedValue({ audio: null, mime: null }),
  transcribe: vi.fn().mockResolvedValue({ text: null }),
}))
vi.mock("@/features/poly/explanationStore", () => ({ saveExplanation: vi.fn() }))

// A state sitting on the first queues beat (index 5) = just past the stacks section.
function atQueuesStart(): SQState {
  const s = createStacksQueues(1)
  return { ...s, partIndex: 5, question: null, construct: null }
}

describe("S&Q checkpoint insertion", () => {
  it("shows the stacks checkpoint when entering the queues section, then the beat after Continue", async () => {
    render(<StacksQueuesStage state={atQueuesStart()} dispatch={vi.fn()} />)
    expect(screen.getByText(/Quick check/i)).toBeInTheDocument()
    await userEvent.type(screen.getByRole("textbox"), "last in first out")
    await userEvent.click(screen.getByRole("button", { name: /submit/i }))
    await userEvent.click(await screen.findByRole("button", { name: /continue/i }))
    // After the checkpoint is dismissed, the normal queue beat renders.
    await waitFor(() => expect(screen.queryByText(/Quick check/i)).not.toBeInTheDocument())
  })
})
