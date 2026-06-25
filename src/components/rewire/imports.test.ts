import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Bundle discipline guard (PRD: "no heavy libraries"). Rather than relying on
 * whether such libs are installed, we assert the rewire surface itself imports
 * none of them. It must stay native Pointer Events only. If this fails, you
 * reached for a heavy dep; find a lighter path.
 */
const HERE = dirname(fileURLToPath(import.meta.url))

function isBanned(spec: string): boolean {
  return (
    spec === "gsap" ||
    spec.startsWith("gsap/") ||
    spec.startsWith("@xyflow/") ||
    spec === "d3" ||
    /^d3-/.test(spec)
  )
}

function importSpecifiers(src: string): string[] {
  const out: string[] = []
  const patterns = [
    /from\s*["']([^"']+)["']/g, // import x from "y" / export … from "y"
    /import\s*\(\s*["']([^"']+)["']\s*\)/g, // dynamic import("y")
    /import\s+["']([^"']+)["']/g, // side-effect import "y"
  ]
  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) out.push(m[1])
  }
  return out
}

describe("rewire bundle discipline", () => {
  it("imports no heavy gesture/graph libraries (@xyflow, d3, gsap)", () => {
    const files = readdirSync(HERE).filter(
      (f) => /\.(ts|tsx)$/.test(f) && !f.includes(".test."),
    )
    expect(files.length).toBeGreaterThan(0)

    const offenders: string[] = []
    for (const file of files) {
      const src = readFileSync(join(HERE, file), "utf8")
      for (const spec of importSpecifiers(src)) {
        if (isBanned(spec)) offenders.push(`${file} → ${spec}`)
      }
    }

    expect(offenders).toEqual([])
  })
})
