import { httpsCallable } from "firebase/functions"

import { functions } from "@/lib/firebase"

export interface HealthResult {
  ok: boolean
  model: string
  reply: string
  uid: string | null
}

export async function polyHealthCheck(): Promise<HealthResult> {
  const callable = httpsCallable<Record<string, never>, HealthResult>(
    functions,
    "polyHealthCheck",
  )
  const res = await callable({})
  return res.data
}

export interface HintRequest {
  stageId: string
  skill: string
  discipline: "stack" | "queue"
  learnerOrder: string[]
  priorHint?: string
}

export interface HintResponse {
  hint: string | null
}

export async function requestHint(req: HintRequest): Promise<HintResponse> {
  const callable = httpsCallable<HintRequest, HintResponse>(functions, "polyHint")
  const res = await callable(req)
  return res.data
}

export type Verdict = "covered" | "partial" | "missing"
export interface PropScore {
  id: string
  verdict: Verdict
}
export interface ScoreRequest {
  conceptId: string
  explanation: string
}
export interface ScoreResponse {
  scores: PropScore[]
  weakest: string | null
}
export interface ProbeRequest {
  conceptId: string
  propositionId: string
  explanation: string
}
export interface ProbeResponse {
  question: string | null
}

export async function scoreExplanation(req: ScoreRequest): Promise<ScoreResponse> {
  const callable = httpsCallable<ScoreRequest, ScoreResponse>(functions, "polyScore")
  const res = await callable(req)
  return res.data
}

export async function requestProbe(req: ProbeRequest): Promise<ProbeResponse> {
  const callable = httpsCallable<ProbeRequest, ProbeResponse>(functions, "polyProbe")
  const res = await callable(req)
  return res.data
}
