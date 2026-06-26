import { describe, expect, it } from "vitest"
import { base64ToBlob } from "./voice"

describe("base64ToBlob", () => {
  it("decodes base64 into a Blob of the right size and type", () => {
    // base64 "QUJD" === bytes [65,66,67] === "ABC"
    const blob = base64ToBlob("QUJD", "audio/mpeg")
    expect(blob.size).toBe(3)
    expect(blob.type).toBe("audio/mpeg")
  })
})
