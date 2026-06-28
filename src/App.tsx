import { Suspense, lazy } from "react"

import { useNavigation, type Screen } from "@/lib/navigation"
import { AppShell } from "@/components/willow/AppShell"
import { CommandPalette } from "@/components/willow/CommandPalette"
import { Home } from "@/screens/Home"
import { ChooseCourse } from "@/screens/ChooseCourse"
import { CourseDetail } from "@/screens/CourseDetail"
import { SignIn } from "@/screens/SignIn"
import { LessonHost } from "@/lessons/LessonHost"
import { Completion } from "@/screens/Completion"
import { Progress } from "@/screens/Progress"
import { Settings } from "@/screens/Settings"

// Poly Lab is a dev-only diagnostics screen. Gating its import behind
// import.meta.env.DEV lets the production build tree-shake the whole screen
// (and its Poly/OpenAI client wiring) out of the bundle entirely.
const PolyLab = import.meta.env.DEV
  ? lazy(() => import("@/screens/PolyLab").then((m) => ({ default: m.PolyLab })))
  : null

const NAV_SCREENS = new Set<Screen["name"]>([
  "home",
  "courses",
  "course",
  "progress",
  "settings",
])

function renderScreen(screen: Screen) {
  switch (screen.name) {
    case "home":
      return <Home />
    case "courses":
      return <ChooseCourse />
    case "course":
      return <CourseDetail courseId={screen.courseId} />
    case "signin":
      return <SignIn intent={screen.intent} />
    case "lesson":
      return <LessonHost key={screen.lessonId} lessonId={screen.lessonId} />
    case "complete":
      return <Completion lessonId={screen.lessonId} />
    case "progress":
      return <Progress />
    case "settings":
      return <Settings />
    case "poly-lab":
      return PolyLab ? (
        <Suspense fallback={null}>
          <PolyLab />
        </Suspense>
      ) : null
  }
}

function App() {
  const { screen, navigate } = useNavigation()
  return (
    <>
      <AppShell bottomNav={NAV_SCREENS.has(screen.name)}>
        {renderScreen(screen)}
      </AppShell>
      <CommandPalette />
      {import.meta.env.DEV && screen.name !== "poly-lab" && (
        <button
          type="button"
          onClick={() => navigate({ name: "poly-lab" })}
          className="fixed right-3 top-3 z-[70] rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-pop"
        >
          Poly Lab
        </button>
      )}
    </>
  )
}

export default App
