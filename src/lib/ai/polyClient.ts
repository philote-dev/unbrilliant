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
