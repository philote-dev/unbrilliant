import { useEffect, useState } from "react"

/**
 * Subscribe to a CSS media query. Initialized synchronously from `matchMedia`
 * so the first client render is already correct (no flash). This is a Vite SPA
 * with no SSR, so `window` is always present at render time.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [query])

  return matches
}

/**
 * True at Tailwind's `lg` breakpoint (1024px and up): the single boundary
 * between Willow's frozen mobile layout and the desktop shell.
 */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)")
}
