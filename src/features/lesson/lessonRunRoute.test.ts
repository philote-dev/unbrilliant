import { describe, expect, it } from "vitest"

import {
  lessonRunKeyForScreen,
  screenHasLessonRun,
  shouldPersistLessonRun,
} from "@/features/lesson/lessonRunRoute"

describe("lesson run routing", () => {
  it("keeps playtest runs active but separate from normal persisted lesson runs", () => {
    const playtest = { name: "playtest", lessonId: "graphs" } as const

    expect(screenHasLessonRun(playtest)).toBe(true)
    expect(lessonRunKeyForScreen(playtest)).toBe("playtest:graphs")
    expect(shouldPersistLessonRun(playtest)).toBe(false)
  })

  it("persists normal lesson and completion routes under the lesson id", () => {
    const lesson = { name: "lesson", lessonId: "graphs" } as const
    const complete = { name: "complete", lessonId: "graphs" } as const

    expect(lessonRunKeyForScreen(lesson)).toBe("graphs")
    expect(lessonRunKeyForScreen(complete)).toBe("graphs")
    expect(shouldPersistLessonRun(lesson)).toBe(true)
    expect(shouldPersistLessonRun(complete)).toBe(true)
  })
})
