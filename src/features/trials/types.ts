export type StructureKind = "stack" | "queue" | "array" | "linked-list"
export type Position = "front" | "back" | "middle" | "top" | "current" | "byIndex"
export type Cost = "cheap" | "expensive" | "impossible"
export type Verdict = "viable" | "strained" | "broken"

export type TrialId = string

export interface DesignState {
  structure: StructureKind
  /** op id -> chosen position */
  mapping: Record<string, Position>
  policy?: Record<string, string>
}

export interface VerdictResult {
  status: Verdict
  /** key into SegmentSpec.explanations */
  explainId: Verdict
  /** key into SegmentSpec.nudges, when not viable */
  nudgeId?: string
}

export interface OperationSpec {
  id: string
  label: string
  allowedPositions: Position[]
}

export interface RequiredMapping {
  op: string
  position: Position
}

export interface SegmentSpec {
  id: string
  clientPrompt: string
  offeredStructures: StructureKind[]
  operations: OperationSpec[]
  required: RequiredMapping[]
  grading: "capability" | "prediction"
  policy?: { id: string; options: string[]; correct: string[] }
  /** present for grading === "prediction" */
  eventScript?: unknown
  explanations: Record<Verdict, string>
  nudges: Record<string, string>
  /** nudge ids the classifier surfaces per verdict */
  brokenNudgeId?: string
  strainedNudgeId?: string
}

export interface MissionSpec {
  id: string
  clientSkin: string
  inheritsFrom?: string
  segments: SegmentSpec[]
}

export interface TrialSpec {
  id: TrialId
  title: string
  /** concept ids boosted on clean completion */
  exercisedConcepts: string[]
  /** completion-screen copy: what the learner's designs taught them. */
  retrospective?: string
  missions: MissionSpec[]
}
