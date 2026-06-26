import { logger } from "firebase-functions"
import { onCall, HttpsError } from "firebase-functions/https"
import { Completer, createClient, openAICompleter } from "./openai"
import { OPENAI_API_KEY, resolveModel } from "./openaiConfig"

const HEALTH_SYSTEM = "You are a health check. Reply with exactly the single word: pong"
const HEALTH_USER = "ping"

export interface HealthResult {
  ok: boolean
  model: string
  reply: string
  uid: string | null
}

export async function runHealthCheck(
  completer: Completer,
  model: string,
  uid: string | null,
): Promise<HealthResult> {
  const reply = await completer.complete({
    system: HEALTH_SYSTEM,
    user: HEALTH_USER,
    model,
  })
  return { ok: true, model, reply: reply.trim(), uid }
}

export const polyHealthCheck = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (request): Promise<HealthResult> => {
    try {
      const completer = openAICompleter(createClient(OPENAI_API_KEY.value()))
      return await runHealthCheck(completer, resolveModel(), request.auth?.uid ?? null)
    } catch (err) {
      logger.error("polyHealthCheck failed", err)
      throw new HttpsError("internal", "OpenAI health check failed")
    }
  },
)
