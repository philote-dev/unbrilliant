/**
 * Part 5 scenario pool — hand-authored, deterministic. Each reframes
 * "stack or queue?" as "who is served first?", so the learner applies
 * LIFO/FIFO instead of guessing a label. Pool of 8; a run draws 4.
 */
export interface Scenario {
  id: string
  prompt: string
  options: { id: string; label: string }[]
  answer: string
  reveal: string
  policy: "stack" | "queue"
}

export const SCENARIO_POOL: Scenario[] = [
  {
    id: "printer",
    prompt:
      "Three files are sent to a printer: the report, then the essay, then the photo. Which prints first?",
    options: [
      { id: "report", label: "The report (sent first)" },
      { id: "photo", label: "The photo (sent last)" },
    ],
    answer: "report",
    reveal: "Earliest in goes first, so it's a queue.",
    policy: "queue",
  },
  {
    id: "undo",
    prompt:
      "You type three words, then press Undo. Which word disappears first?",
    options: [
      { id: "last", label: "The word you typed last" },
      { id: "first", label: "The word you typed first" },
    ],
    answer: "last",
    reveal: "Most recent goes first, so it's a stack.",
    policy: "stack",
  },
  {
    id: "cafeteria",
    prompt:
      "Students line up for lunch: Ana, then Ben, then Cara. Who is served first?",
    options: [
      { id: "ana", label: "Ana (joined first)" },
      { id: "cara", label: "Cara (joined last)" },
    ],
    answer: "ana",
    reveal: "Earliest in goes first, so it's a queue.",
    policy: "queue",
  },
  {
    id: "plates",
    prompt:
      "Plates are stacked: blue, then red, then green on top. Which do you take first?",
    options: [
      { id: "green", label: "Green (on top)" },
      { id: "blue", label: "Blue (at the bottom)" },
    ],
    answer: "green",
    reveal: "Most recent goes first, so it's a stack.",
    policy: "stack",
  },
  {
    id: "tickets",
    prompt:
      "Support tickets arrive in order #1, #2, #3. Handling them fairly, which is first?",
    options: [
      { id: "one", label: "Ticket #1 (arrived first)" },
      { id: "three", label: "Ticket #3 (arrived last)" },
    ],
    answer: "one",
    reveal: "Earliest in goes first, so it's a queue.",
    policy: "queue",
  },
  {
    id: "truck",
    prompt:
      "Boxes are loaded into a truck; the last one sits by the door. Unloading, which comes out first?",
    options: [
      { id: "last", label: "The box loaded last" },
      { id: "first", label: "The box loaded first" },
    ],
    answer: "last",
    reveal: "Most recent goes first, so it's a stack.",
    policy: "stack",
  },
  {
    id: "concert",
    prompt:
      "Fans join a line at 9:00, 9:05, and 9:10. Who gets into the concert first?",
    options: [
      { id: "early", label: "The 9:00 fan" },
      { id: "late", label: "The 9:10 fan" },
    ],
    answer: "early",
    reveal: "Earliest in goes first, so it's a queue.",
    policy: "queue",
  },
  {
    id: "history",
    prompt:
      "You browse Home, then News, then Sports. You press Back. Where do you land?",
    options: [
      { id: "news", label: "News (the previous page)" },
      { id: "home", label: "Home (the first page)" },
    ],
    answer: "news",
    reveal: "Most recent goes first, so it's a stack.",
    policy: "stack",
  },
]
