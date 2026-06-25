/**
 * Fictional sample pages for the "Browser Back" beat (the real-world skin of the
 * stack predict). Titles / urls are invented; the favicon is a small CSS
 * gradient chip so we ship no images. Pages map to history entries by their
 * arrival index, so the mapping is deterministic for a given session. This is
 * the stack mirror of playlistSongs.ts.
 *
 * The engine's stack-realworld labels (see stacksQueuesEngine.ts) mirror the
 * first entries here so the fallback abstract container still reads sensibly,
 * but the skin always uses pageFor() for the real page identity. The engine
 * copy never names a specific page, so the two files stay decoupled.
 */
export interface BrowserPage {
  title: string
  url: string
  /** Two colours for the favicon gradient chip. */
  accent: [string, string]
}

const PAGES: BrowserPage[] = [
  { title: "Search", url: "willowsearch.com/?q=stacks", accent: ["#8b7fd6", "#6366f1"] },
  { title: "Recipe", url: "tinypantry.co/lemon-loaf", accent: ["#f59e0b", "#ef4444"] },
  { title: "Map", url: "atlas.app/route/cafe", accent: ["#10b981", "#0891b2"] },
  { title: "Video", url: "streamly.tv/watch/7f2", accent: ["#ec4899", "#a855f7"] },
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
