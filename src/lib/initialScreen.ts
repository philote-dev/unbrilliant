import { isLessonPlayable } from "@/lessons/catalog"
import type { Screen } from "@/lib/navigation"

export function initialScreenFromLocation(
  location: Pick<Location, "pathname" | "search"> | URL = window.location,
): Screen {
  if (location.pathname !== "/playtest") return { name: "home" }

  const lessonId = new URLSearchParams(location.search).get("lesson") ?? ""
  if (!isLessonPlayable(lessonId)) return { name: "home" }

  return { name: "playtest", lessonId }
}
