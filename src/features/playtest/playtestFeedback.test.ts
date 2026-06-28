import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
}))

vi.mock("firebase/firestore", () => ({
  addDoc: h.addDoc,
  collection: h.collection,
  serverTimestamp: h.serverTimestamp,
}))

import { submitPlaytestFeedback } from "@/features/playtest/playtestFeedback"

beforeEach(() => {
  vi.clearAllMocks()
  h.addDoc.mockResolvedValue({ id: "feedback-id" })
})

describe("submitPlaytestFeedback", () => {
  it("writes a trimmed playtest feedback document", async () => {
    const db = { kind: "db" }

    await submitPlaytestFeedback(db, {
      lessonId: "graphs",
      notes: "  The map labels overlapped on my phone.  ",
      path: "/playtest?lesson=graphs",
      userAgent: "Vitest",
    })

    expect(h.collection).toHaveBeenCalledWith(db, "playtestFeedback")
    expect(h.addDoc).toHaveBeenCalledWith(
      { path: "playtestFeedback" },
      {
        lessonId: "graphs",
        notes: "The map labels overlapped on my phone.",
        path: "/playtest?lesson=graphs",
        userAgent: "Vitest",
        source: "playtest",
        createdAt: "SERVER_TIMESTAMP",
      },
    )
  })

  it("rejects blank notes before Firestore is called", async () => {
    await expect(
      submitPlaytestFeedback({ kind: "db" }, { lessonId: "graphs", notes: "   " }),
    ).rejects.toThrow("Feedback notes are required")

    expect(h.addDoc).not.toHaveBeenCalled()
  })
})
