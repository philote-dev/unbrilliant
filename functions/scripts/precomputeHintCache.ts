import { createClient, openAICompleter } from "../src/openai"
import { resolveModel } from "../src/openaiConfig"
import { getAdminDb } from "../src/firebaseAdmin"
import { firestoreHintCache } from "../src/poly/firestoreHintCache"
import { precomputeBoundaryHints } from "../src/poly/precompute"
import { BOUNDARY_SHAPES } from "../src/poly/boundaryShapes"

const key = process.env.OPENAI_API_KEY
if (!key) throw new Error("OPENAI_API_KEY is required to precompute hints")

precomputeBoundaryHints({
  completer: openAICompleter(createClient(key)),
  model: resolveModel(),
  cache: firestoreHintCache(getAdminDb()),
  shapes: BOUNDARY_SHAPES,
})
  .then((r) => {
    console.log("precompute complete:", r)
    process.exit(0)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
