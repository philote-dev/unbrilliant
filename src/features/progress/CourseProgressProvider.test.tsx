import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, act } from "@testing-library/react"

// Mutable, hoisted stand-ins so each render reads the latest auth + active run.
const h = vi.hoisted(() => ({
  user: null as null | { uid: string },
  run: {
    lessonId: "stacks-and-queues",
    state: { completed: true, currentPart: "compare" } as
      | { completed: boolean; currentPart: string }
      | null,
  },
}))

// A minimal lesson module whose progress mirrors the run state's `completed`.
const fakeModule = {
  hasProgress: (s: unknown) => s != null,
  toProgress: (s: unknown) => {
    const st = s as { completed?: boolean; currentPart?: string } | null
    return {
      counters: {},
      currentPart: st?.currentPart ?? "x",
      completed: !!st?.completed,
      completedAt: st?.completed ? Date.now() : null,
    }
  },
  combo: () => 0,
}

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: h.user }) }))
vi.mock("@/lib/firebase", () => ({ db: {} }))
vi.mock("@/features/lesson/useLessonRun", () => ({
  useLessonRun: () => ({
    lessonId: h.run.lessonId,
    state: h.run.state,
    module: fakeModule,
    sessionActivity: [],
  }),
}))
vi.mock("@/features/progress/firestoreProgressRepository", () => ({
  createFirestoreProgressRepository: () => ({
    getUser: vi.fn().mockResolvedValue(null),
    getProgress: vi.fn().mockResolvedValue(undefined),
    listCompletedTrials: vi.fn().mockResolvedValue([]),
    getActivity: vi.fn().mockResolvedValue([]),
    updateUser: vi.fn().mockResolvedValue(undefined),
  }),
}))

import {
  CourseProgressProvider,
  useCourseProgress,
} from "./CourseProgressProvider"

function Probe() {
  const { progressByLesson } = useCourseProgress()
  const sq = progressByLesson["stacks-and-queues"]
  return <div data-testid="sq">{sq?.completed ? "sq-complete" : "sq-incomplete"}</div>
}

beforeEach(() => {
  h.user = null
  h.run = {
    lessonId: "stacks-and-queues",
    state: { completed: true, currentPart: "compare" },
  }
})

describe("CourseProgressProvider session progress (anonymous)", () => {
  it("retains a completed lesson after the active run moves on, so the next lesson stays unlocked", () => {
    const tree = (
      <CourseProgressProvider>
        <Probe />
      </CourseProgressProvider>
    )
    const { rerender } = render(tree)
    // While S&Q is the active run, its completion shows via the live overlay.
    expect(screen.getByTestId("sq").textContent).toBe("sq-complete")

    // The learner finishes S&Q and the active run moves to Arrays (in progress).
    // An anonymous learner has no server progress, so without a session
    // accumulator S&Q's completion is dropped and Arrays would re-lock.
    act(() => {
      h.run = {
        lessonId: "arrays",
        state: { completed: false, currentPart: "play-access" },
      }
    })
    rerender(
      <CourseProgressProvider>
        <Probe />
      </CourseProgressProvider>,
    )

    expect(screen.getByTestId("sq").textContent).toBe("sq-complete")
  })
})
