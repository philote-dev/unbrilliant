import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "@/App"
import { ThemeProvider } from "@/lib/theme"
import { NavigationProvider } from "@/lib/navigation"
import { AuthProvider } from "@/lib/auth"
import { ConceptReviewProvider } from "@/features/progress/ConceptReviewProvider"
import { LessonRunProvider } from "@/features/lesson/useLessonRun"
import { CourseProgressProvider } from "@/features/progress/CourseProgressProvider"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <NavigationProvider initial={{ name: "home" }}>
          <ConceptReviewProvider>
            <LessonRunProvider>
              <CourseProgressProvider>
                <App />
              </CourseProgressProvider>
            </LessonRunProvider>
          </ConceptReviewProvider>
        </NavigationProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
