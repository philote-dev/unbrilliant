import { classify } from "./capability"
import { gradePrediction, type LineOp } from "./simulate"
import { emptySave, type RevisionRecord, type TrialSaveState } from "./saveState"
import type {
  Position,
  SegmentSpec,
  StructureKind,
  TrialId,
  TrialSpec,
  Verdict,
  VerdictResult,
} from "./types"

/**
 * The full in-run state of one Trial campaign. Pure data: the provider holds it in
 * a ref and squashes it to a durable {@link TrialSaveState} slice for persistence.
 * `structure`/`mapping`/`policy`/`verdict`/`phase` are the working design for the
 * current segment; the rest are durable accumulators carried across segments.
 */
export interface TrialRunState {
  spec: TrialSpec
  missionIndex: number
  segmentIndex: number
  structure: StructureKind | null
  mapping: Record<string, Position>
  policy: Record<string, string>
  verdict: VerdictResult | null
  phase: "design" | "verdict" | "complete"
  /** false once any segment's FIRST stress run was not viable; never restored. */
  cleanPass: boolean
  /** segmentId -> latest verdict status */
  verdicts: Record<string, Verdict>
  revisionHistory: RevisionRecord[]
  /** segmentIds that have been stress-tested at least once */
  stressTestsRun: string[]
}

export type TrialAction =
  | { type: "choose-structure"; structure: StructureKind }
  | { type: "place-op"; op: string; position: Position }
  | { type: "unplace-op"; op: string }
  | { type: "set-policy"; id: string; value: string }
  | { type: "run-stress" }
  | { type: "submit-prediction"; prediction: { front: string | null } }
  | { type: "revise" }
  | { type: "advance" }

/** The segment the working design currently targets. */
export function currentSegment(state: TrialRunState): SegmentSpec {
  return state.spec.missions[state.missionIndex].segments[state.segmentIndex]
}

export function createTrialRun(spec: TrialSpec): TrialRunState {
  return {
    spec,
    missionIndex: 0,
    segmentIndex: 0,
    structure: null,
    mapping: {},
    policy: {},
    verdict: null,
    phase: "design",
    cleanPass: true,
    verdicts: {},
    revisionHistory: [],
    stressTestsRun: [],
  }
}

/** Move to a fresh segment, wiping the working design back to a blank board. */
function openSegment(state: TrialRunState, missionIndex: number, segmentIndex: number): TrialRunState {
  return {
    ...state,
    missionIndex,
    segmentIndex,
    structure: null,
    mapping: {},
    policy: {},
    verdict: null,
    phase: "design",
  }
}

export function trialReducer(state: TrialRunState, action: TrialAction): TrialRunState {
  switch (action.type) {
    case "choose-structure":
      // Keep the existing mapping: swapping structures re-tests the same placements.
      return { ...state, structure: action.structure, verdict: null, phase: "design" }

    case "place-op":
      return {
        ...state,
        mapping: { ...state.mapping, [action.op]: action.position },
        verdict: null,
        phase: "design",
      }

    case "unplace-op": {
      const mapping = { ...state.mapping }
      delete mapping[action.op]
      return { ...state, mapping, verdict: null, phase: "design" }
    }

    case "set-policy":
      return {
        ...state,
        policy: { ...state.policy, [action.id]: action.value },
        verdict: null,
        phase: "design",
      }

    case "run-stress": {
      const structure = state.structure
      if (structure == null) return state
      const segment = currentSegment(state)
      const allPlaced = segment.required.every(({ op }) => state.mapping[op] != null)
      if (!allPlaced) return state

      // Prediction segments (A4, B5) are graded at the UI seam against the event-script
      // simulator via gradePrediction (src/features/trials/simulate.ts), not by the
      // capability classifier. The reducer never classifies a prediction.
      // TODO: wire prediction grading into the run when the final-review UI lands.
      if (segment.grading !== "capability") return state

      const verdict = classify({ structure, mapping: state.mapping, policy: state.policy }, segment)
      const firstRun = !state.stressTestsRun.includes(segment.id)
      const cleanPass = firstRun && verdict.status !== "viable" ? false : state.cleanPass

      return {
        ...state,
        verdict,
        cleanPass,
        verdicts: { ...state.verdicts, [segment.id]: verdict.status },
        stressTestsRun: firstRun ? [...state.stressTestsRun, segment.id] : state.stressTestsRun,
        phase: "verdict",
      }
    }

    case "submit-prediction": {
      const segment = currentSegment(state)
      // Prediction segments (A4, B5) are graded against the event-script simulator,
      // not the capability matrix. The reducer owns this so cleanPass + verdicts
      // accrue exactly the way a capability stress run does.
      if (segment.grading !== "prediction") return state
      const script = (segment.eventScript ?? []) as LineOp[]
      const { correct } = gradePrediction(script, action.prediction)
      const verdict: VerdictResult = correct
        ? { status: "viable", explainId: "viable" }
        : { status: "broken", explainId: "broken", nudgeId: segment.brokenNudgeId }
      const firstRun = !state.stressTestsRun.includes(segment.id)
      const cleanPass = firstRun && !correct ? false : state.cleanPass

      return {
        ...state,
        verdict,
        cleanPass,
        verdicts: { ...state.verdicts, [segment.id]: verdict.status },
        stressTestsRun: firstRun ? [...state.stressTestsRun, segment.id] : state.stressTestsRun,
        phase: "verdict",
      }
    }

    case "revise":
      if (state.phase !== "verdict") return state
      // Reopen the design. cleanPass was decided on the first run and is never restored.
      // This action does not push a RevisionRecord; revisionHistory wiring on a real
      // structure/mapping delta is deferred. The durable field exists for the UI timeline.
      return { ...state, phase: "design", verdict: null }

    case "advance": {
      // Broken blocks; only a viable or strained design may move on.
      if (state.phase !== "verdict" || state.verdict == null) return state
      if (state.verdict.status === "broken") return state

      const mission = state.spec.missions[state.missionIndex]
      if (state.segmentIndex + 1 < mission.segments.length) {
        return openSegment(state, state.missionIndex, state.segmentIndex + 1)
      }
      if (state.missionIndex + 1 < state.spec.missions.length) {
        return openSegment(state, state.missionIndex + 1, 0)
      }
      return { ...state, phase: "complete" }
    }

    default: {
      const _exhaustive: never = action
      throw new Error(`unknown trial action: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

/** Squash a run to its durable progress slice (segment-grained resume point). */
export function toProgress(state: TrialRunState): TrialSaveState {
  const mission = state.spec.missions[state.missionIndex]
  const segment = currentSegment(state)
  return {
    ...emptySave(state.spec.id, mission.id, segment.id),
    chosenStructures: state.structure == null ? {} : { [mission.id]: state.structure },
    operationMappings: { ...state.mapping },
    policyChoices: { ...state.policy },
    verdicts: { ...state.verdicts },
    revisionHistory: [...state.revisionHistory],
    stressTestsRun: [...state.stressTestsRun],
    completed: state.phase === "complete",
    cleanPass: state.cleanPass,
  }
}

/** Reinflate a run at the saved mission/segment. Resume granularity is the segment. */
export function resume(slice: TrialSaveState, spec: TrialSpec): TrialRunState {
  const missionIndex = Math.max(
    0,
    spec.missions.findIndex((m) => m.id === slice.missionId),
  )
  const mission = spec.missions[missionIndex]
  const segmentIndex = Math.max(
    0,
    mission.segments.findIndex((s) => s.id === slice.segmentId),
  )
  return {
    spec,
    missionIndex,
    segmentIndex,
    structure: slice.chosenStructures[mission.id] ?? null,
    mapping: { ...slice.operationMappings },
    policy: { ...slice.policyChoices },
    verdict: null,
    phase: slice.completed ? "complete" : "design",
    cleanPass: slice.cleanPass,
    verdicts: { ...slice.verdicts },
    revisionHistory: [...slice.revisionHistory],
    stressTestsRun: [...slice.stressTestsRun],
  }
}

/**
 * A Trial behind the same kind of seam as a LessonModule: a pure create/reducer
 * over its own run state, durable-progress mappers, and a `completed` selector.
 * Bound to one {@link TrialSpec} (the analog of a lesson's identity), so `id`,
 * `create`, and `resume` are all spec-aware. The shared provider/chrome stay
 * Trial-agnostic.
 */
export interface TrialModule {
  id: TrialId
  create(): TrialRunState
  reducer(state: TrialRunState, action: TrialAction): TrialRunState
  toProgress(state: TrialRunState): TrialSaveState
  resume(slice: TrialSaveState): TrialRunState
  completed(state: TrialRunState): boolean
}

export function createTrialModule(spec: TrialSpec): TrialModule {
  return {
    id: spec.id,
    create: () => createTrialRun(spec),
    reducer: trialReducer,
    toProgress,
    resume: (slice) => resume(slice, spec),
    completed: (state) => state.phase === "complete",
  }
}
