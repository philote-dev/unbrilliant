import { useState } from "react"
import { Check, Search, Zap } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { CostReadout } from "@/components/willow/CostReadout"
import { BUCKET_COUNT, bucketOf } from "@/features/lesson/hashTablesEngine"
import { itemFor } from "./warehouseData"

/**
 * The DEMO/teach payoff for chaotic storage. A toggle flips between the intuitive
 * "shelve everything by type" and the counterintuitive "drop it anywhere, keep an
 * index". A retrieval race makes the point: the human-sorted browse scans shelf
 * after shelf (scales), while the index jumps straight to the bin (free). Purely
 * presentational: no engine state, deterministic, and reduced-motion safe (the
 * scan reveals at once instead of staggering).
 */

const STOCK = ["pen", "mug", "cam", "jar", "owl", "tag"]
const TARGET = "tag"

type Mode = "sorted" | "chaotic"

export function WarehouseDemo() {
  const reduced = useReducedMotion() ?? false
  const [mode, setMode] = useState<Mode>("sorted")
  const [found, setFound] = useState(false)

  const target = itemFor(TARGET)
  const switchMode = (m: Mode) => {
    setMode(m)
    setFound(false)
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* mode toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/25 p-1">
        <ToggleTab active={mode === "sorted"} onClick={() => switchMode("sorted")}>
          Shelve by type
        </ToggleTab>
        <ToggleTab active={mode === "chaotic"} onClick={() => switchMode("chaotic")}>
          Chaotic + index
        </ToggleTab>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        {mode === "sorted" ? (
          <SortedView found={found} reduced={reduced} />
        ) : (
          <ChaoticView found={found} reduced={reduced} />
        )}
      </div>

      {/* the race control + result */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => setFound(true)}
          className="flex items-center gap-2 rounded-xl bg-[#ff9900] px-5 py-2.5 text-sm font-bold text-[#232f3e] outline-none transition-transform active:scale-[0.99]"
        >
          {mode === "sorted" ? <Search className="size-4" /> : <Zap className="size-4" />}
          Find the {target.name.toLowerCase()}
        </button>

        {found && (
          mode === "sorted" ? (
            <Cost label="Browsing the shelves" word="scales" count={STOCK.length} unit="items checked" />
          ) : (
            <Cost label="Index jump" word="free" count={1} unit="jump to the bin" />
          )
        )}
      </div>

      <p className="rounded-lg bg-black/20 px-3 py-2 text-center text-xs text-white/65">
        Sorting looks tidy, but you still hunt for it. Drop items anywhere and let an
        index find any one in a single jump.
      </p>
    </div>
  )
}

/* --------------------------------- views ---------------------------------- */

function SortedView({ found, reduced }: { found: boolean; reduced: boolean }) {
  // Group the stock by its "logical" category, the human way.
  const groups = new Map<string, string[]>()
  for (const key of STOCK) {
    const cat = itemFor(key).category
    groups.set(cat, [...(groups.get(cat) ?? []), key])
  }
  const cats = [...groups.keys()].sort()
  // A linear browse order across the sorted shelves; the target sits at the end.
  const order = cats.flatMap((c) => groups.get(c)!)
  const targetPos = order.indexOf(TARGET)

  return (
    <div className="flex flex-col gap-2">
      {cats.map((cat) => (
        <div key={cat} className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-white/45">
            {cat}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {groups.get(cat)!.map((key) => {
              const pos = order.indexOf(key)
              const scanned = found && pos <= targetPos
              const isTarget = key === TARGET && found
              return (
                <StockChip
                  key={key}
                  code={itemFor(key).sku}
                  scanned={scanned}
                  isTarget={isTarget}
                  delay={reduced ? 0 : pos * 0.08}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function ChaoticView({ found, reduced }: { found: boolean; reduced: boolean }) {
  const targetBin = bucketOf(TARGET)
  const bins: string[][] = Array.from({ length: BUCKET_COUNT }, () => [])
  for (const key of STOCK) bins[bucketOf(key)].push(key)

  return (
    <div className="flex flex-col gap-3">
      {/* the index (SKU -> bin) */}
      <div className="rounded-lg border border-white/10 bg-black/25 p-2">
        <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#ff9900]">
          Index
        </p>
        <div className="grid grid-cols-3 gap-1 font-mono text-[11px]">
          {STOCK.map((key) => {
            const lit = found && key === TARGET
            return (
              <span
                key={key}
                className={cn(
                  "flex items-center justify-between rounded px-1.5 py-0.5",
                  lit ? "bg-[#ff9900] text-[#232f3e]" : "text-white/75",
                )}
              >
                <span>{itemFor(key).sku.split("-")[0]}</span>
                <span className="font-bold">→{bucketOf(key)}</span>
              </span>
            )
          })}
        </div>
      </div>

      {/* the bins */}
      <div className="grid grid-cols-5 gap-1.5">
        {bins.map((items, i) => {
          const hit = found && i === targetBin
          return (
            <motion.div
              key={i}
              animate={
                hit && !reduced ? { scale: [1, 1.12, 1] } : undefined
              }
              transition={{ duration: 0.4 }}
              className={cn(
                "flex min-h-[58px] flex-col items-center gap-1 rounded-lg border-2 p-1 transition-colors",
                hit
                  ? "border-[#08aae3] bg-[#08aae3]/15 shadow-[0_0_16px_-4px_#08aae3]"
                  : "border-white/15 bg-white/[0.04]",
              )}
            >
              <span className="flex size-5 items-center justify-center rounded bg-[#ff9900] font-mono text-[10px] font-extrabold text-[#232f3e]">
                {i}
              </span>
              <div className="flex flex-col items-center gap-0.5">
                {items.map((key) => (
                  <span
                    key={key}
                    className="size-3 rounded-[3px]"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${itemFor(key).art[0]}, ${itemFor(key).art[1]})`,
                    }}
                    aria-hidden
                  />
                ))}
              </div>
            </motion.div>
          )
        })}
      </div>
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
        active ? "bg-[#ff9900] text-[#232f3e]" : "text-white/70 hover:text-white",
      )}
    >
      {children}
    </button>
  )
}

function StockChip({
  code,
  scanned,
  isTarget,
  delay,
}: {
  code: string
  scanned: boolean
  isTarget: boolean
  delay: number
}) {
  return (
    <span
      style={{ transitionDelay: `${delay}s` }}
      className={cn(
        "flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] transition-colors",
        isTarget
          ? "border-[#2dbff8] bg-[#2dbff8]/25 text-white"
          : scanned
            ? "border-[#08aae3]/55 bg-[#08aae3]/10 text-white"
            : "border-white/15 bg-white/5 text-white/70",
      )}
    >
      {isTarget && <Check className="size-3 text-[#2dbff8]" strokeWidth={3} aria-hidden />}
      {code.split("-")[0]}
    </span>
  )
}

function Cost({
  label,
  word,
  count,
  unit,
}: {
  label: string
  word: "free" | "scales"
  count: number
  unit: string
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-white/55">
        {label}
      </span>
      <CostReadout word={word} count={count} unit={unit} />
    </div>
  )
}
