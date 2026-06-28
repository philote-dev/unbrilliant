import type { LineOp } from "@/features/trials/simulate"
import type { MissionSpec, SegmentSpec } from "@/features/trials/types"

/**
 * Trial I, Mission A: "The Line Breaks" (a school event check-in desk).
 *
 * Each segment is pure authored data graded by the deterministic engine, never AI.
 * A1-A3 use the capability matrix (`classify`): the learner picks a structure and
 * maps each operation onto an end/zone, and the worst cost wins (any
 * impossible/misplaced -> broken, any large -> strained, all small -> viable).
 * A4 is a prediction graded against the line simulator (`gradePrediction`).
 *
 * Copy follows the spec's plain-language voice (free/small/large cost words, no
 * Big O): "only one end moves", "everything shifts", "the neighbors reconnect",
 * "the newest action sits on top". Nudges point attention without giving the
 * answer; the classifier surfaces one via `brokenNudgeId` / `strainedNudgeId`.
 */

// A1: students join the back, the longest-waiting student is served from the front.
export const a1Intake: SegmentSpec = {
  id: "a1-intake",
  clientPrompt:
    "Students arrive for the school event and wait their turn. Each new student joins the back of the line, and when the desk frees up you serve the student who has waited the longest. Pick a structure that keeps that order.",
  offeredStructures: ["queue", "linked-list", "array"],
  operations: [
    { id: "arrival", label: "a new student arrives", allowedPositions: ["front", "back", "middle"] },
    { id: "serve", label: "serve the next student", allowedPositions: ["front", "back", "middle"] },
  ],
  required: [
    { op: "arrival", position: "back" },
    { op: "serve", position: "front" },
  ],
  grading: "capability",
  explanations: {
    viable:
      "Only one end moves at a time. New students join the back and the longest-waiting student leaves the front, so the line stays fair without disturbing anyone else.",
    strained:
      "It still works, but serving from the front means every student behind shifts up a slot each time. That is a lot of large moves for a busy desk.",
    broken:
      "This structure can't serve the longest-waiting student from the front, so the order the client asked for falls apart.",
  },
  nudges: {
    ends: "Which student should leave first: the newest, or the one who waited longest?",
  },
  brokenNudgeId: "ends",
  strainedNudgeId: "ends",
}

// A2: a student in the middle cancels; the line has to close the gap.
export const a2Cancellation: SegmentSpec = {
  id: "a2-cancellation",
  clientPrompt:
    "A student partway down the line cancels and steps out. The rest of the line should close the gap and keep waiting in the same order. Keep arrivals and serving working too.",
  offeredStructures: ["queue", "array", "linked-list"],
  operations: [
    { id: "arrival", label: "a new student arrives", allowedPositions: ["front", "back", "middle"] },
    { id: "serve", label: "serve the next student", allowedPositions: ["front", "back", "middle"] },
    { id: "remove", label: "a middle student cancels", allowedPositions: ["front", "back", "middle"] },
  ],
  required: [
    { op: "arrival", position: "back" },
    { op: "serve", position: "front" },
    { op: "remove", position: "middle" },
  ],
  grading: "capability",
  explanations: {
    viable:
      "When the middle student leaves, the neighbors reconnect around the gap and everyone keeps their place. Arrivals and serving still touch only the ends.",
    strained:
      "Removing a middle student leaves a hole, so everyone behind it shifts up to fill it. The line survives, but every cancellation is a lot of large moves.",
    broken:
      "This structure can only touch its ends, so there's no way to pull a student out of the middle. The cancellation can't be handled.",
  },
  nudges: {
    middle: "Watch what changes when the middle student leaves. Is only one end changing?",
  },
  brokenNudgeId: "middle",
  strainedNudgeId: "middle",
}

// A3: a separate support slot for undoing the most recent desk action.
export const a3Undo: SegmentSpec = {
  id: "a3-undo",
  clientPrompt:
    "The desk needs an undo button. Every action you take is recorded, and undo should reverse the most recent action first. Add a support structure that tracks that history.",
  offeredStructures: ["stack", "queue", "array", "linked-list"],
  // Broadened so non-stack structures expose a placeable target: only the stack
  // has a Top zone, so without these the learner could pick a queue/array/list and
  // have nowhere to drop record/undo (Run stuck disabled), never reaching the
  // intended broken verdict. `required` stays top/top, so grading is unchanged:
  // stack grades viable, the others grade broken (misplaced off the top).
  operations: [
    { id: "record", label: "record a desk action", allowedPositions: ["top", "front", "back"] },
    { id: "undo", label: "undo the last action", allowedPositions: ["top", "front", "back"] },
  ],
  required: [
    { op: "record", position: "top" },
    { op: "undo", position: "top" },
  ],
  grading: "capability",
  explanations: {
    viable:
      "Each action you record sits on top of the pile, and undo lifts that top action straight off. The newest mistake is always the first one reversed.",
    strained:
      "Undo half-works here, but reaching the most recent action takes extra effort instead of lifting it straight off the top.",
    broken:
      "Undo has to reverse the newest action first, and this structure can't reach the most recent action on top. Undo can't work here.",
  },
  nudges: {
    undo: "Undo fixes the newest mistake first, not the oldest.",
  },
  brokenNudgeId: "undo",
  strainedNudgeId: "undo",
}

/**
 * A4 final-review script: 5 students arrive, the middle one (C) leaves, two are
 * served, the last action (the second serve) is undone, then one more arrives.
 * Tracing it by hand: line ends as [B, D, E, F], so the front is "B".
 */
const a4Script: LineOp[] = [
  { t: "arrive", id: "A" },
  { t: "arrive", id: "B" },
  { t: "arrive", id: "C" },
  { t: "arrive", id: "D" },
  { t: "arrive", id: "E" },
  { t: "leaveMiddle", id: "C" },
  { t: "serve" },
  { t: "serve" },
  { t: "undo" },
  { t: "arrive", id: "F" },
]

// A4: predict the final front after a mixed script. Graded by the simulator.
export const a4Review: SegmentSpec = {
  id: "a4-review",
  clientPrompt:
    "One busy stretch, all at once: five students arrive, the middle one cancels, two are served, you undo your most recent action, then one more student arrives. Who is at the front of the line now?",
  offeredStructures: [],
  operations: [],
  required: [],
  grading: "prediction",
  eventScript: a4Script,
  explanations: {
    viable:
      "You traced it correctly. The line owned the order while undo only reversed your single most recent action, and the two jobs never got tangled.",
    strained:
      "Close. Most of the moves line up, but the serve-then-undo near the end is easy to misread.",
    broken:
      "Not quite. Re-trace it slowly: the line handles arrivals and serving, while undo reverses only the one newest action, not the whole line.",
  },
  nudges: {
    separate: "One structure owns the line; another owns the history. Keep those jobs separate.",
  },
  brokenNudgeId: "separate",
  strainedNudgeId: "separate",
}

export const missionA: MissionSpec = {
  id: "mission-a-line",
  clientSkin:
    "A school event check-in desk: students line up to check in, a few cancel, and the desk worker needs an undo button for mistakes.",
  segments: [a1Intake, a2Cancellation, a3Undo, a4Review],
}
