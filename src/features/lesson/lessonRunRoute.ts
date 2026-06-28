import type { Screen } from "@/lib/navigation"

export function screenHasLessonRun(screen: Screen): screen is Extract<
  Screen,
  { name: "lesson" | "playtest" | "complete" }
> {
  return (
    screen.name === "lesson" ||
    screen.name === "playtest" ||
    screen.name === "complete"
  )
}

export function lessonRunKeyForScreen(screen: Screen): string | null {
  if (!screenHasLessonRun(screen)) return null
  return screen.name === "playtest"
    ? `playtest:${screen.lessonId}`
    : screen.lessonId
}

export function shouldPersistLessonRun(screen: Screen): boolean {
  return screen.name === "lesson" || screen.name === "complete"
}
