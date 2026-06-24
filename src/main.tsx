import { StrictMode, Suspense, lazy, type ReactNode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "@/App"
import { ThemeProvider } from "@/lib/theme"
import { NavigationProvider } from "@/lib/navigation"
import { AuthProvider } from "@/lib/auth"
import { LessonRunProvider } from "@/features/lesson/useLessonRun"
import { CourseProgressProvider } from "@/features/progress/CourseProgressProvider"

/**
 * The Dev Gallery (visual + animation review), reachable at `/?gallery`.
 * Lazy-loaded so it never ships in the production bundle; normal navigation
 * (no query param) renders the real app unchanged. The dedicated `gallery.html`
 * entry renders the same gallery without these app providers.
 */
const showGallery =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("gallery")

const Gallery = lazy(() =>
  import("@/dev/GalleryApp").then((m) => ({ default: m.Gallery })),
)

function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationProvider initial={{ name: "home" }}>
          <LessonRunProvider>
            <CourseProgressProvider>{children}</CourseProgressProvider>
          </LessonRunProvider>
        </NavigationProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      {showGallery ? (
        <Suspense fallback={null}>
          <Gallery />
        </Suspense>
      ) : (
        <App />
      )}
    </Providers>
  </StrictMode>,
)
