import { useNavigation, type Screen } from "@/lib/navigation"
import { AppShell } from "@/components/willow/AppShell"
import { Home } from "@/screens/Home"
import { ChooseCourse } from "@/screens/ChooseCourse"
import { CourseDetail } from "@/screens/CourseDetail"
import { SignIn } from "@/screens/SignIn"
import { LessonHost } from "@/lessons/LessonHost"
import { Completion } from "@/screens/Completion"
import { Progress } from "@/screens/Progress"
import { Profile } from "@/screens/Profile"
import { Settings } from "@/screens/Settings"

const NAV_SCREENS = new Set<Screen["name"]>([
  "home",
  "courses",
  "course",
  "progress",
  "profile",
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
      return <SignIn reason={screen.reason} intent={screen.intent} />
    case "lesson":
      return <LessonHost lessonId={screen.lessonId} />
    case "complete":
      return <Completion lessonId={screen.lessonId} />
    case "progress":
      return <Progress />
    case "profile":
      return <Profile />
    case "settings":
      return <Settings />
  }
}

function App() {
  const { screen } = useNavigation()
  return (
    <AppShell bottomNav={NAV_SCREENS.has(screen.name)}>
      {renderScreen(screen)}
    </AppShell>
  )
}

export default App
