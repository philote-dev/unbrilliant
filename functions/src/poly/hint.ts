import { logger } from "firebase-functions"
import { onCall } from "firebase-functions/https"
import { Completer, createClient, openAICompleter } from "../openai"
import { OPENAI_API_KEY, resolveModel } from "../openaiConfig"
import { targetsForSkill } from "./skillMap"
import { rubricFor, propositionsByIds } from "./rubrics"
import { findGiveaway } from "./verifier"
import { Proposition } from "./types"

export interface HintDiagnosis {
  // Structural failure kind from the client-side diagnose engine. Concept-
  // agnostic and free of answer items, so it is safe to name in the prompt.
  kind: string
  // 1-based index of the first move that left the correct line.
  stepNumber: number
}

export interface HintArgs {
  stageId: string
  skill: string
  discipline: "stack" | "queue" | "array"
  learnerOrder: string[]
  priorHint?: string
  // Multi-step (complex) beats: the learner's operation trace as readable steps
  // plus the structural diagnosis. The correct sequence is never sent, so the
  // model cannot leak it.
  attempt?: string[]
  diagnosis?: HintDiagnosis
}

export interface HintResult {
  hint: string | null
}

const BASE_SYSTEM =
  "You write one short tutoring hint (at most two sentences) for a data-structures lesson. " +
  "You are given the structure type, the order the learner built, and the concept they violated. " +
  "Point them at their specific mistake. NEVER state the correct order or which item goes where. " +
  "NEVER name the concept or use its key terms. No analogies unless asked. " +
  "Use plain punctuation; never use an em dash (write two sentences or use a comma instead)."

const STRICTER =
  "Your previous attempt revealed too much. Be more indirect: do not name the concept, " +
  "do not use its key terms, and do not state any ordering. "

// Defensive caps: these callables are public and unauthenticated, so a hostile
// caller could pass huge payloads to run up model cost and latency. The real
// client sends tiny data, so clamping is invisible in normal use.
// learnerOrder items are short tokens for stacks/queues ("A") but full option
// phrases for arrays ("grow the block by one slot"), so the per-item cap is
// generous while the list count stays small.
const MAX_ORDER_ITEMS = 32
const MAX_ITEM_LEN = 120
const MAX_TRACE_STEPS = 128
const MAX_STEP_LEN = 40
const MAX_PRIOR_HINT = 600

function clampList(list: string[] | undefined, max: number, itemLen: number): string[] {
  return (Array.isArray(list) ? list : [])
    .slice(0, max)
    .map((s) => String(s ?? "").slice(0, itemLen))
}

function sanitizeHintArgs(args: HintArgs): HintArgs {
  return {
    ...args,
    learnerOrder: clampList(args.learnerOrder, MAX_ORDER_ITEMS, MAX_ITEM_LEN),
    attempt: args.attempt
      ? clampList(args.attempt, MAX_TRACE_STEPS, MAX_STEP_LEN)
      : undefined,
    priorHint:
      typeof args.priorHint === "string"
        ? args.priorHint.slice(0, MAX_PRIOR_HINT)
        : undefined,
  }
}

function buildUser(args: HintArgs, withheld: Proposition[]): string {
  const concepts = withheld.map((p) => p.text).join("; ")
  const prior = args.priorHint
    ? `\nYour previous hint was: "${args.priorHint}". Take a different angle.`
    : ""
  if (args.discipline === "array") {
    return (
      `Structure: a fixed-size memory block that is full.\n` +
      `The learner was asked the cleanest way to make room for one more item.\n` +
      `They chose: ${args.learnerOrder.join(", ")}.\n` +
      `Concept(s) they violated: ${concepts}\n` +
      `Write a hint that makes them feel this choice repeats the same work on the next add, and the next. ` +
      `Never state the fix and never say how much bigger to make the block.${prior}`
    )
  }
  if (args.diagnosis && args.attempt) {
    return (
      `Structure: ${args.discipline}\n` +
      `The learner is part-way through a multi-step problem.\n` +
      `Their moves so far: ${args.attempt.join(", ")}\n` +
      `Their first misstep was move ${args.diagnosis.stepNumber} (issue: ${args.diagnosis.kind}).\n` +
      `Concept(s) they violated: ${concepts}\n` +
      `Write a hint that points them at that one move and ends with exactly one short question about it. ` +
      `Do NOT state the correct sequence or which move to make next.${prior}`
    )
  }
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
  rawArgs: HintArgs,
): Promise<HintResult> {
  const args = sanitizeHintArgs(rawArgs)
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
