import { useState } from "react"
import { Search, Zap } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { CostReadout } from "@/components/willow/CostReadout"
import { BUCKET_COUNT, bucketOf, distribute } from "@/features/lesson/hashTablesEngine"

/**
 * Beat 1, the abstract two-scenario demo (ungraded free play, Willow-styled, NOT
 * the warehouse: that skin is reserved for the graded real-world payoff). The
 * learner picks any key, then sees the same lookup two ways: a sorted SCAN that
 * walks key by key (scales) versus a HASHED jump straight to the bin (free). It
 * sells the one idea before any rule is taught: a hash turns a key into its
 * location, so you jump instead of search. Deterministic and reduced-motion safe
 * (the scan reveals at once instead of staggering).
 */

/** A small, fixed key set, shown sorted in the scan view. */
const KEYS = ["ant", "bee", "cat", "dog", "elk", "fox", "owl", "pig"]
const SORTED = [...KEYS].sort()

type Mode = "scan" | "hash"

export function AbstractDemo() {
  const reduced = useReducedMotion() ?? false
  const [mode, setMode] = useState<Mode>("scan")
  const [target, setTarget] = useState("fox")
  const [found, setFound] = useState(false)

  const pick = (key: string) => {
    setTarget(key)
    setFound(false)
  }
  const switchMode = (m: Mode) => {
    setMode(m)
    setFound(false)
  }

  const scanPos = SORTED.indexOf(target)
  const checked = scanPos + 1
  const bucket = bucketOf(target, BUCKET_COUNT)

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      {/* Pick any key to look up. */}
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Look up
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === target}
              onClick={() => pick(key)}
              className={cn(
                "rounded-lg border-2 px-2.5 py-1 text-sm font-bold outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-lilac-strong/60",
                key === target
                  ? "border-lilac-strong bg-lilac-soft text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-lilac-strong/45",
              )}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* mode toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        <ToggleTab active={mode === "scan"} onClick={() => switchMode("scan")}>
          Scan a sorted list
        </ToggleTab>
        <ToggleTab active={mode === "hash"} onClick={() => switchMode("hash")}>
          Jump with a hash
        </ToggleTab>
      </div>

      <div className="flex min-h-[180px] flex-col justify-center">
        {mode === "scan" ? (
          <ScanView target={target} found={found} reduced={reduced} />
        ) : (
          <HashView target={target} bucket={bucket} found={found} reduced={reduced} />
        )}
      </div>

      {/* run the lookup + the cost it pays */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => setFound(true)}
          className={cn(
            "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white outline-none transition-transform active:scale-[0.99]",
            "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            mode === "scan" ? "bg-foreground" : "bg-lilac-strong",
          )}
        >
          {mode === "scan" ? <Search className="size-4" /> : <Zap className="size-4" />}
          Find {target}
        </button>

        <div className="flex min-h-[64px] items-start justify-center">
          {found &&
            (mode === "scan" ? (
              <CostReadout word="scales" count={checked} unit="checked" />
            ) : (
              <CostReadout word="free" count={1} unit="jump to the bin" />
            ))}
        </div>
      </div>
    </div>
  )
}

/* --------------------------------- views ---------------------------------- */

function ScanView({
  target,
  found,
  reduced,
}: {
  target: string
  found: boolean
  reduced: boolean
}) {
  const targetPos = SORTED.indexOf(target)
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-1.5">
        {SORTED.map((key, i) => {
          const scanned = found && i <= targetPos
          const isTarget = found && key === target
          return (
            <span
              key={key}
              style={{ transitionDelay: reduced ? "0s" : `${i * 0.12}s` }}
              className={cn(
                "rounded-lg border-2 px-2.5 py-1 text-sm font-bold transition-colors",
                isTarget
                  ? "border-success bg-success-soft text-foreground"
                  : scanned
                    ? "border-lilac-strong/50 bg-lilac-soft/60 text-foreground"
                    : "border-border bg-card text-muted-foreground",
              )}
            >
              {key}
            </span>
          )
        })}
      </div>
      <p className="max-w-xs text-center text-xs text-muted-foreground">
        Sorted or not, you still walk item by item until you reach it.
      </p>
    </div>
  )
}

function HashView({
  target,
  bucket,
  found,
  reduced,
}: {
  target: string
  bucket: number
  found: boolean
  reduced: boolean
}) {
  const table = distribute("sum", BUCKET_COUNT, KEYS)
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex w-full max-w-[260px] flex-col gap-1.5">
        {Array.from({ length: BUCKET_COUNT }).map((_, i) => {
          const items = table[i] ?? []
          const hit = found && i === bucket
          return (
            <motion.div
              key={i}
              animate={hit && !reduced ? { scale: [1, 1.06, 1] } : undefined}
              transition={{ duration: 0.4 }}
              className={cn(
                "flex min-h-10 items-center gap-2 rounded-xl border-2 px-2.5 py-1.5 transition-colors",
                hit
                  ? "border-lilac-strong bg-lilac-soft"
                  : "border-border bg-card",
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-lilac-soft font-mono text-[11px] font-extrabold text-lilac-strong">
                {i}
              </span>
              <span className="flex flex-wrap gap-1">
                {items.length === 0 ? (
                  <span className="text-xs text-faint">empty</span>
                ) : (
                  items.map((key) => (
                    <span
                      key={key}
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 text-xs font-bold transition-colors",
                        found && key === target
                          ? "border-success bg-success-soft text-foreground"
                          : "border-border bg-background text-foreground",
                      )}
                    >
                      {key}
                    </span>
                  ))
                )}
              </span>
            </motion.div>
          )
        })}
      </div>
      <p className="max-w-xs text-center text-xs text-muted-foreground">
        The rule turns {target} into bin {bucket}. Go straight there, no walking.
      </p>
    </div>
  )
}

/* --------------------------------- pieces --------------------------------- */

function ToggleTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg py-2 text-center text-[13px] font-bold outline-none transition-colors",
        active
          ? "bg-card text-foreground shadow-soft"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}
