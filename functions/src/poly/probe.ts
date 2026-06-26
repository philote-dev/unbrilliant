import { logger } from "firebase-functions"
import { onCall } from "firebase-functions/https"
import { Completer, createClient, openAICompleter } from "../openai"
import { OPENAI_API_KEY, resolveModel } from "../openaiConfig"
import { rubricFor, propositionsByIds } from "./rubrics"
import { findGiveaway } from "./verifier"
import { Proposition } from "./types"

export interface ProbeArgs {
  conceptId: string
  propositionId: string
  explanation: string
}

export interface ProbeResult {
  question: string | null
}

const BASE_SYSTEM =
  "You ask ONE short follow-up question to help a learner surface a missing idea. " +
  "You are given the proposition they have not yet conveyed. Ask a question that leads " +
  "them toward it. NEVER state the idea. NEVER include its key terms. One sentence."

const STRICTER =
  "Your previous question revealed too much. Ask a more indirect one: do not use the " +
  "idea's key terms. "

function buildUser(missing: Proposition, explanation: string): string {
  return (
    `Missing proposition: ${missing.text}\n` +
    `Their last explanation: ${explanation}\n` +
    "Write the question."
  )
}

export async function probeQuestion(
  completer: Completer,
  model: string,
  args: ProbeArgs,
): Promise<ProbeResult> {
  const rubric = rubricFor(args.conceptId)
  if (!rubric) return { question: null }
  const [missing] = propositionsByIds(rubric, [args.propositionId])
  if (!missing) return { question: null }
  const withheld = [missing]
  const user = buildUser(missing, args.explanation)

  const first = (await completer.complete({ system: BASE_SYSTEM, user, model })).trim()
  if (findGiveaway(first, withheld).ok) return { question: first || null }

  const second = (
    await completer.complete({ system: STRICTER + BASE_SYSTEM, user, model })
  ).trim()
  if (findGiveaway(second, withheld).ok) return { question: second || null }

  return { question: null }
}

export const polyProbe = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (request): Promise<ProbeResult> => {
    try {
      const completer = openAICompleter(createClient(OPENAI_API_KEY.value()))
      return await probeQuestion(completer, resolveModel(), request.data as ProbeArgs)
    } catch (err) {
      logger.error("polyProbe failed", err)
      return { question: null }
    }
  },
)
