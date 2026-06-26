import {
  CLASSIFY_BANK,
  classifyVerdict,
  drainOrder,
  type Discipline,
} from "@/features/lesson/stacksQueuesEngine"
import type { ConceptId } from "@/features/progress/conceptReview"

/**
 * One seam over each lesson's existing seeded generators + pure verdicts, so the
 * retrieval drill can render/grade any concept without importing seven engines.
 * Each provider is pure: same (seed, encounter) yields the same item; `encounter`
 * rotates surface/phrasing (Bjork varied presentation). Tap-gradeable only for now.
 */
export interface RetrievalItem {
  conceptId: ConceptId
  prompt: string
  options: { id: string; label: string }[]
  answerId: string
  why: string
}

export type ItemProvider = (seed: number, encounter: number) => RetrievalItem

function rng(seed: number, encounter: number): () => number {
  let a = (seed ^ Math.imul(encounter + 1, 0x9e3779b1)) | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], next: () => number): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const CLASSIFY_PROMPTS = [
  "Everything goes in, then comes out in this order. Which behavior is that?",
  "In one end, then out in this order. Stack, queue, or neither?",
  "Given the in and out orders below, which structure could do that?",
]

function classifyProvider(seed: number, encounter: number): RetrievalItem {
  const next = rng(seed, encounter)
  const inst = CLASSIFY_BANK[Math.floor(next() * CLASSIFY_BANK.length)]
  const answerId = classifyVerdict(inst.inOrder, inst.outOrder)
  const why =
    answerId === "stack"
      ? "Out is the exact reverse of in, so last in came out first: a stack."
      : answerId === "queue"
        ? "Out matches in, so first in came out first: a queue."
        : "This order is not a clean reverse or a match, so no single stack or queue makes it."
  return {
    conceptId: "stacks-and-queues:classify",
    prompt: `${CLASSIFY_PROMPTS[encounter % CLASSIFY_PROMPTS.length]} In: ${inst.inOrder.join(
      ", ",
    )}. Out: ${inst.outOrder.join(", ")}.`,
    options: [
      { id: "stack", label: "Stack (last in, first out)" },
      { id: "queue", label: "Queue (first in, first out)" },
      { id: "neither", label: "Neither" },
    ],
    answerId,
    why,
  }
}

const PREDICT_PROMPTS: Record<Discipline, string[]> = {
  stack: [
    "These were pushed onto a stack in this order. Which comes out first?",
    "A stack received these, in order. Which is removed first?",
    "Pushed onto a stack like so. Which one pops first?",
  ],
  queue: [
    "These joined a queue in this order. Which is served first?",
    "A queue received these, in order. Which leaves first?",
    "Lined up in this order. Which one is next out?",
  ],
}

function predictProvider(discipline: Discipline, conceptId: ConceptId): ItemProvider {
  return (seed, encounter) => {
    const next = rng(seed, encounter)
    const n = 3 + Math.floor(next() * 2) // 3 or 4 items
    const arrival = shuffle(["A", "B", "C", "D"].slice(0, n), next)
    const answerId = drainOrder(arrival, discipline)[0]
    return {
      conceptId,
      prompt: `${PREDICT_PROMPTS[discipline][encounter % PREDICT_PROMPTS[discipline].length]} Added: ${arrival.join(
        ", ",
      )}.`,
      options: arrival.map((l) => ({ id: l, label: l })),
      answerId,
      why:
        discipline === "stack"
          ? `A stack is last in, first out, so the most recently added (${answerId}) comes out first.`
          : `A queue is first in, first out, so the earliest added (${answerId}) comes out first.`,
    }
  }
}

export const ITEM_PROVIDERS: Record<ConceptId, ItemProvider> = {
  "stacks-and-queues:classify": classifyProvider,
  "stacks-and-queues:stackPredict": predictProvider(
    "stack",
    "stacks-and-queues:stackPredict",
  ),
  "stacks-and-queues:queuePredict": predictProvider(
    "queue",
    "stacks-and-queues:queuePredict",
  ),
}
