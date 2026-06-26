import { logger } from "firebase-functions"
import { onCall } from "firebase-functions/https"
import { RealtimeTokenMinter, openAIRealtimeTokenMinter } from "../openai"
import { OPENAI_API_KEY, resolveRealtimeModel } from "../openaiConfig"

export interface RealtimeTokenResponse {
  token: string | null
  expiresAt: number | null
  model: string | null
}

export async function createRealtimeToken(
  minter: RealtimeTokenMinter,
  model: string,
): Promise<RealtimeTokenResponse> {
  const result = await minter.mint(model)
  return { token: result.value, expiresAt: result.expiresAt, model }
}

export const polyRealtimeToken = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (): Promise<RealtimeTokenResponse> => {
    try {
      const minter = openAIRealtimeTokenMinter(OPENAI_API_KEY.value())
      return await createRealtimeToken(minter, resolveRealtimeModel())
    } catch (err) {
      logger.error("polyRealtimeToken failed", err)
      return { token: null, expiresAt: null, model: null }
    }
  },
)
