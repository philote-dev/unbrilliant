import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "@/index.css"
import { ThemeProvider } from "@/lib/theme"
import { AuthProvider } from "@/lib/auth"
import { NavigationProvider } from "@/lib/navigation"
import { PolyLab } from "@/screens/PolyLab"

/**
 * Dev Gallery entry (served by `npm run gallery`, never a production build input).
 * Mounts the Poly Lab demo on its own, inside the minimal providers it needs, so
 * the AI features can be exercised without playing through a lesson.
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <NavigationProvider initial={{ name: "poly-lab" }}>
          <div className="flex min-h-svh flex-col bg-background text-foreground">
            <PolyLab />
          </div>
        </NavigationProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
