import {
  GoogleIcon,
  GoogleMapsIcon,
  RecipeIcon,
  YouTubeIcon,
  type SiteIcon,
} from "./siteIcons"

/**
 * Sample pages for the "Browser Back" beat (the real-world skin of the stack
 * predict). The first four are real, recognizable sites (Google, a recipe blog,
 * Google Maps, YouTube) so the history reads like a genuine session; pages
 * without a brand icon fall back to a CSS gradient chip via `accent`. Pages map
 * to history entries by their arrival index, so the mapping is deterministic for
 * a given session. This is the stack mirror of playlistSongs.ts.
 *
 * The skin always uses pageFor() for the real page identity, and the engine copy
 * never names a specific page, so the engine and this catalogue stay decoupled.
 */
export interface BrowserPage {
  title: string
  url: string
  /** Two colours for the fallback favicon gradient chip (used when no `icon`). */
  accent: [string, string]
  /** A recognizable site favicon; falls back to the gradient chip when absent. */
  icon?: SiteIcon
}

const PAGES: BrowserPage[] = [
  { title: "Google", url: "google.com/search?q=stacks", accent: ["#8b7fd6", "#6366f1"], icon: GoogleIcon },
  { title: "Recipe", url: "tinypantry.co/lemon-loaf", accent: ["#f59e0b", "#ef4444"], icon: RecipeIcon },
  { title: "Maps", url: "google.com/maps", accent: ["#10b981", "#0891b2"], icon: GoogleMapsIcon },
  { title: "YouTube", url: "youtube.com/watch?v=7f2", accent: ["#ec4899", "#a855f7"], icon: YouTubeIcon },
  { title: "Docs", url: "willow.dev/docs/queues", accent: ["#0ea5e9", "#14b8a6"] },
  { title: "Profile", url: "social.fm/@mara", accent: ["#6366f1", "#0f172a"] },
]

/**
 * The page for a history entry. Entries map to the catalogue by their position
 * in the arrival order, so a given session always yields the same pages.
 */
export function pageFor(id: string, arrival: string[]): BrowserPage {
  const i = arrival.indexOf(id)
  const idx = i < 0 ? 0 : i
  return PAGES[((idx % PAGES.length) + PAGES.length) % PAGES.length]
}
