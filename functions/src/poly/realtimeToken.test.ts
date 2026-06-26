import { describe, it, expect, vi } from "vitest"
import { createRealtimeToken } from "./realtimeToken"
import type { RealtimeTokenMinter } from "../openai"

describe("createRealtimeToken", () => {
  it("returns the token, expiry, and model from the minter", async () => {
    const minter: RealtimeTokenMinter = {
      mint: vi.fn().mockResolvedValue({ value: "ek_abc", expiresAt: 123 }),
    }

    const out = await createRealtimeToken(minter, "gpt-4o-transcribe")

    expect(out).toEqual({ token: "ek_abc", expiresAt: 123, model: "gpt-4o-transcribe" })
    expect(minter.mint).toHaveBeenCalledWith("gpt-4o-transcribe")
  })
})
