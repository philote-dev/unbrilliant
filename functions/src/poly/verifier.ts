import { GiveawayResult, Proposition } from "./types"

// Pure no-giveaway check: case-insensitive substring scan of AI output against
// the answer tokens of the propositions the learner has NOT yet demonstrated.
// Blank tokens are ignored so an unauthored token can never match everything.
export function findGiveaway(text: string, withheld: Proposition[]): GiveawayResult {
  const hay = text.toLowerCase()
  const leaked = withheld
    .filter((p) =>
      p.answerTokens.some((t) => t.trim() !== "" && hay.includes(t.toLowerCase())),
    )
    .map((p) => p.id)
  return { ok: leaked.length === 0, leaked }
}
