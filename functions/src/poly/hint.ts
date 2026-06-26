import { logger } from "firebase-functions"
import { onCall } from "firebase-functions/https"
import { Completer, createClient, openAICompleter } from "../openai"
import { OPENAI_API_KEY, resolveModel } from "../openaiConfig"
import { targetsForSkill } from "./skillMap"
import { rubricFor, propositionsByIds } from "./rubrics"
import { findGiveaway } from "./verifier"
import { Proposition } from "./types"

export interface HintArgs {
  stageId: string
  skill: string
  discipline: "stack" | "queue"
  learnerOrder: string[]
  priorHint?: string
}

export interface HintResult {
  hint: string | null
}

const BASE_SYSTEM =
  "You write one short tutoring hint (at most two sentences) for a data-structures lesson. " +
  "You are given the structure type, the order the learner built, and the concept they violated. " +
  "Point them at their specific mistake. NEVER state the correct order or which item goes where. " +
  "NEVER name the concept or use its key terms. No analogies unless asked."

const STRICTER =
  "Your previous attempt revealed too much. Be more indirect: do not name the concept, " +
  "do not use its key terms, and do not state any ordering. "

function buildUser(args: HintArgs, withheld: Proposition[]): string {
  const concepts = withheld.map((p) => p.text).join("; ")
  const prior = args.priorHint
    ? `\nYour previous hint was: "${args.priorHint}". Take a different angle.`
    : ""
  return (
    `Structure: ${args.discipline}\n` +
    `Learner built (in push order): ${args.learnerOrder.join(", ")}\n` +
    `Concept(s) they violated: ${concepts}\n` +
    `Write the hint.${prior}`
  )
}

export async function generateHint(
  completer: Completer,
  model: string,
  args: HintArgs,
): Promise<HintResult> {
  const target = targetsForSkill(args.skill)
  if (!target) return { hint: null }
  const rubric = rubricFor(target.conceptId)
  if (!rubric) return { hint: null }
  const withheld = propositionsByIds(rubric, target.propositionIds)
  const user = buildUser(args, withheld)

  const first = (await completer.complete({ system: BASE_SYSTEM, user, model })).trim()
  if (findGiveaway(first, withheld).ok) return { hint: first || null }

  const second = (
    await completer.complete({ system: STRICTER + BASE_SYSTEM, user, model })
  ).trim()
  if (findGiveaway(second, withheld).ok) return { hint: second || null }

  return { hint: null }
}

export const polyHint = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (request): Promise<HintResult> => {
    try {
      const completer = openAICompleter(createClient(OPENAI_API_KEY.value()))
      return await generateHint(completer, resolveModel(), request.data as HintArgs)
    } catch (err) {
      logger.error("polyHint failed", err)
      return { hint: null }
    }
  },
)
