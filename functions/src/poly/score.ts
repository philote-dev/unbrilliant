import { logger } from "firebase-functions"
import { onCall } from "firebase-functions/https"
import { Completer, createClient, openAICompleter } from "../openai"
import { OPENAI_API_KEY, resolveModel } from "../openaiConfig"
import { rubricFor } from "./rubrics"
import { Rubric } from "./types"

export type Verdict = "covered" | "partial" | "missing"
export interface PropScore {
  id: string
  verdict: Verdict
}
export interface ScoreResult {
  scores: PropScore[]
  weakest: string | null
}
export interface ScoreArgs {
  conceptId: string
  explanation: string
}

const VERDICTS: Verdict[] = ["covered", "partial", "missing"]

const SYSTEM =
  "You evaluate a learner's free-text explanation of a concept against a rubric of " +
  "propositions. For each proposition return covered, partial, or missing. Be generous: mark " +
  "covered when the learner conveys the idea in ANY wording, including analogies, examples, " +
  "or loose paraphrase, even if imprecise. Use partial only when the idea is vague or " +
  "half-stated, and missing only when it is genuinely absent. Do not require exact " +
  "terminology. When in doubt, prefer covered; this is a low-stakes confidence check, not a " +
  'graded test. Return ONLY JSON of the form {"scores":[{"id":"P1","verdict":"covered"}],' +
  '"weakest":"P2"}. Never include the rubric text.'

// A self-explanation is short; cap it so a public, unauthenticated caller can't
// push a huge prompt to the model.
const MAX_EXPLANATION = 5000

function buildUser(rubric: Rubric, explanation: string): string {
  const rubricText = rubric.propositions.map((p) => `${p.id}: ${p.text}`).join("\n")
  return `Concept: ${rubric.conceptId}\nRubric:\n${rubricText}\nLearner explanation: ${explanation}`
}

function extractJson(raw: string): unknown {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("no json")
  return JSON.parse(raw.slice(start, end + 1))
}

function allCovered(rubric: Rubric): ScoreResult {
  return {
    scores: rubric.propositions.map((p) => ({ id: p.id, verdict: "covered" as Verdict })),
    weakest: null,
  }
}

function normalize(rubric: Rubric, parsed: unknown): ScoreResult {
  const obj = parsed as { scores?: unknown; weakest?: unknown }
  const byId = new Map<string, Verdict>()
  if (Array.isArray(obj.scores)) {
    for (const s of obj.scores as Array<{ id?: unknown; verdict?: unknown }>) {
      if (typeof s?.id === "string" && VERDICTS.includes(s.verdict as Verdict)) {
        byId.set(s.id, s.verdict as Verdict)
      }
    }
  }
  // One score per rubric proposition; an omitted/invalid one defaults to covered
  // (do not fabricate gaps for a non-gating side-quest).
  const scores: PropScore[] = rubric.propositions.map((p) => ({
    id: p.id,
    verdict: byId.get(p.id) ?? "covered",
  }))
  const claimed = typeof obj.weakest === "string" ? obj.weakest : null
  const claimedScore = scores.find((s) => s.id === claimed)
  const weakest =
    claimedScore && claimedScore.verdict !== "covered"
      ? claimed
      : (scores.find((s) => s.verdict === "missing")?.id ??
        scores.find((s) => s.verdict === "partial")?.id ??
        null)
  return { scores, weakest }
}

export async function scoreExplanation(
  completer: Completer,
  model: string,
  args: ScoreArgs,
): Promise<ScoreResult> {
  const rubric = rubricFor(args.conceptId)
  if (!rubric) return { scores: [], weakest: null }
  const raw = await completer.complete({
    system: SYSTEM,
    user: buildUser(rubric, (args.explanation ?? "").slice(0, MAX_EXPLANATION)),
    model,
  })
  try {
    return normalize(rubric, extractJson(raw))
  } catch {
    return allCovered(rubric)
  }
}

export const polyScore = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (request): Promise<ScoreResult> => {
    try {
      const completer = openAICompleter(createClient(OPENAI_API_KEY.value()))
      return await scoreExplanation(completer, resolveModel(), request.data as ScoreArgs)
    } catch (err) {
      logger.error("polyScore failed", err)
      return { scores: [], weakest: null }
    }
  },
)
