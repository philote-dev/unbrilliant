import type { Position, StructureKind, TrialId, Verdict } from "./types"

export interface RevisionRecord {
  segmentId: string
  at: number
  from: { structure: StructureKind; mapping: Record<string, Position> }
  to: { structure: StructureKind; mapping: Record<string, Position> }
}

export interface DesignArtifact {
  structure: StructureKind
  mapping: Record<string, Position>
  policy?: Record<string, string>
}

export interface TrialSaveState {
  trialId: TrialId
  missionId: string
  segmentId: string
  unlockedSegments: string[]
  chosenStructures: Record<string, StructureKind>
  operationMappings: Record<string, Position>
  policyChoices: Record<string, string>
  verdicts: Record<string, Verdict>
  revisionHistory: RevisionRecord[]
  nudgesShown: string[]
  stressTestsRun: string[]
  missionAArtifact?: DesignArtifact
  missionBArtifact?: DesignArtifact
  completed: boolean
  cleanPass: boolean
}

export function emptySave(trialId: TrialId, missionId: string, segmentId: string): TrialSaveState {
  return {
    trialId,
    missionId,
    segmentId,
    unlockedSegments: [segmentId],
    chosenStructures: {},
    operationMappings: {},
    policyChoices: {},
    verdicts: {},
    revisionHistory: [],
    nudgesShown: [],
    stressTestsRun: [],
    completed: false,
    cleanPass: true,
  }
}

export function isComplete(s: TrialSaveState): boolean {
  return s.completed
}
