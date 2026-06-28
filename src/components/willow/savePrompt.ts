import { isOnStreak } from "@/components/willow/Flame"

/**
 * Subtitle for the "Save your progress" prompts (the sign-in screen and the
 * completion pop-up). One source of truth so the surfaces never drift, never
 * repeat the "Save your progress" headline they sit under, and only claim a streak
 * when one is actually lit.
 */
export function savePromptSubtitle(streakCount: number): string {
  return isOnStreak(streakCount)
    ? "Keep your streak and pick up right where you left off."
    : "Pick up right where you left off."
}
