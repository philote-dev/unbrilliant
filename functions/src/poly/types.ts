export interface Proposition {
  id: string
  text: string
  // Phrases that count as giving the proposition away if they appear in AI
  // output before the learner has demonstrated it. Case-insensitive substring
  // match (see verifier). Authored per proposition, including the abstract ones.
  answerTokens: string[]
}

export interface Rubric {
  conceptId: string
  propositions: Proposition[]
}

export interface SkillTarget {
  conceptId: string
  propositionIds: string[]
}

export interface GiveawayResult {
  ok: boolean
  leaked: string[]
}
