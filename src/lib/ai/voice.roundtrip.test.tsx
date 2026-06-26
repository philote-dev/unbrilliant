import { describe, expect, it } from "vitest"
import { base64ToBlob, blobToBase64 } from "./voice"

// blobToBase64 relies on FileReader, which exists under jsdom (the "dom" test
// project) but not in the node project, so this round-trip lives in a .tsx file.
describe("blobToBase64", () => {
  it("round-trips base64 content (strips the data: prefix)", async () => {
    const original = "QUJD" // "ABC"
    const blob = base64ToBlob(original, "audio/webm")
    const out = await blobToBase64(blob)
    expect(out).toBe(original)
  })
})
