import { NEW_NODE } from "@/features/lesson/linkedListsEngine"

/**
 * Fictional sample tracks for the "playlist" beat (the real-world skin of the
 * insert lesson). Titles/artists are invented; album art is a CSS gradient so we
 * ship no images. Songs are assigned to chain nodes by their head-relative index,
 * so the mapping is deterministic for a given chain.
 */
export interface Song {
  title: string
  artist: string
  /** Two colours for the album-art gradient. */
  art: [string, string]
  /** A small badge next to the artist, like Spotify's verified / explicit marks. */
  badge?: "verified" | "explicit"
}

const SONGS: Song[] = [
  { title: "Velvet Hours", artist: "Mara Quill", art: ["#7c3aed", "#2563eb"], badge: "verified" },
  { title: "Paper Skylines", artist: "The Lantern Hour", art: ["#0ea5e9", "#14b8a6"] },
  { title: "Slow Tangerine", artist: "Devon Ashe", art: ["#f59e0b", "#ef4444"], badge: "explicit" },
  { title: "Midnight Cassette", artist: "Juno Vale", art: ["#6366f1", "#0f172a"], badge: "verified" },
  { title: "Coastal Static", artist: "Penny Arc", art: ["#10b981", "#0891b2"] },
  { title: "Retriever Blues", artist: "Sam Holloway", art: ["#eab308", "#f97316"], badge: "explicit" },
  { title: "Echo Park, 4AM", artist: "Nilla & the Moths", art: ["#a855f7", "#ec4899"] },
]

/** The track being queued in this beat (the inserted node X). */
const NEW_SONG: Song = {
  title: "Ferris Wheel",
  artist: "Odd Comfort",
  art: ["#1db954", "#0ea5e9"],
  badge: "verified",
}

/**
 * The song for a chain node. The new node (X) is always the track being queued;
 * every other node maps to a catalogue track by its position in the chain.
 */
export function songFor(node: string, chain: string[]): Song {
  if (node === NEW_NODE) return NEW_SONG
  const i = chain.indexOf(node)
  return SONGS[((i % SONGS.length) + SONGS.length) % SONGS.length]
}
