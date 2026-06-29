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

const arraysRubric: Rubric = {
  conceptId: "arrays",
  propositions: [
    {
      id: "P1",
      text: "A full fixed-size block has no spare room for another item",
      answerTokens: ["no spare room", "no room", "no free slot", "no space", "already full"],
    },
    {
      id: "P2",
      text: "Growing by a fixed small amount forces a copy on almost every later append",
      answerTokens: [
        "copy every time",
        "copy each time",
        "copy again each time",
        "copy on every",
        "every append",
        "recopy",
        "over and over",
        "again and again",
      ],
    },
    {
      id: "P3",
      text: "A proportionally bigger block makes copies rare",
      answerTokens: [
        "double",
        "twice as big",
        "twice the size",
        "proportional",
        "bigger block",
        "rare",
      ],
    },
  ],
}

const linkedListsRubric: Rubric = {
  conceptId: "linked-lists",
  propositions: [
    {
      id: "P1",
      text: "Save the rest of the list (aim the new node at the tail) before repointing",
      answerTokens: [
        "save the rest",
        "save first",
        "new node first",
        "aim x",
        "new.next",
        "point the new node",
      ],
    },
    {
      id: "P2",
      text: "Repointing the predecessor first orphans the tail (unreachable from the head)",
      answerTokens: ["orphan", "orphaned", "unreachable", "floats off", "stranded", "lost the tail"],
    },
  ],
}

export const RUBRICS: Record<string, Rubric> = {
  stacks: stacksRubric,
  queues: queuesRubric,
  arrays: arraysRubric,
  "linked-lists": linkedListsRubric,
}

export function rubricFor(conceptId: string): Rubric | undefined {
  return RUBRICS[conceptId]
}

export function propositionsByIds(rubric: Rubric, ids: string[]): Proposition[] {
  return rubric.propositions.filter((p) => ids.includes(p.id))
}
