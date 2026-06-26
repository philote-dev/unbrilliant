import { Proposition, Rubric } from "./types"

const stacksRubric: Rubric = {
  conceptId: "stacks",
  propositions: [
    {
      id: "P1",
      text: "LIFO: the last item pushed is the first one removed",
      answerTokens: [
        "lifo",
        "last in first out",
        "last-in, first-out",
        "last in, first out",
        "last one in",
      ],
    },
    {
      id: "P2",
      text: "Only the top item is accessible",
      answerTokens: ["top"],
    },
    {
      id: "P3",
      text: "The order is a consequence of the top-only access rule, not a separate rule",
      answerTokens: ["consequence", "follows from", "because you can only", "comes from the rule"],
    },
  ],
}

const queuesRubric: Rubric = {
  conceptId: "queues",
  propositions: [
    {
      id: "P1",
      text: "FIFO: the first item added is the first one removed",
      answerTokens: [
        "fifo",
        "first in first out",
        "first-in, first-out",
        "first in, first out",
        "first one in",
      ],
    },
    {
      id: "P2",
      text: "You add at one end and remove from the other end",
      answerTokens: ["one end", "other end", "front", "back", "rear"],
    },
    {
      id: "P3",
      text: "The arrival order is preserved across the whole structure",
      answerTokens: ["preserved", "stays in order", "kept in order", "same order"],
    },
  ],
}

export const RUBRICS: Record<string, Rubric> = {
  stacks: stacksRubric,
  queues: queuesRubric,
}

export function rubricFor(conceptId: string): Rubric | undefined {
  return RUBRICS[conceptId]
}

export function propositionsByIds(rubric: Rubric, ids: string[]): Proposition[] {
  return rubric.propositions.filter((p) => ids.includes(p.id))
}
