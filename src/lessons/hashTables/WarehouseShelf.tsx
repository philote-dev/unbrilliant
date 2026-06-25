import { useEffect, useRef } from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { RewireSource } from "@/components/rewire/RewireSource"
import { useRewireContext } from "@/components/rewire/RewireContext"
import { bucketTargetId, type HashQuestion } from "@/features/lesson/hashTablesEngine"
import { itemFor, type WarehouseItem } from "./warehouseData"

/** The draggable package's source id (opaque; grading is on the chosen bin). */
const PACKAGE_SOURCE = "hash-key"

/**
 * The Amazon-style "chaotic storage" shelf: a wall of numbered bins, each a drop
 * target, plus one inbound package to stow. The learner scans the package (the
 * index sums its code), then drops it into the bin that code hashes to. A bin can
 * hold several items (a collision = a shared bin), which is exactly the chain.
 *
 * Determinism: the stowed items are a pure function of `question.table` plus the
 * learner's own placement. The new package rests on the bin the learner CHOSE
 * (`placedBucket`) until Check; only a correct verdict (`confirmed`) settles it
 * on `question.bucket`. Motion is opacity/transform only and never picks the bin;
 * reduced motion snaps every item to rest. The single `data-hash-correct-bucket`
 * and the `data-rewire-source` / `data-rewire-target="bin-as-bucket-N"` hooks are
 * preserved for the e2e tracer.
 */
export function WarehouseShelf({
  question,
  placedBucket,
  confirmed,
  reducedMotion,
}: {
  question: HashQuestion
  /** The bin index the learner dropped the package on (their choice), if any. */
  placedBucket?: number | null
  /** The drop was graded correct: settle the package in its bin. */
  confirmed?: boolean
  /** Force reduced motion (else the OS preference). */
  reducedMotion?: boolean
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false

  const key = question.key ?? ""
  const B = question.bucketCount
  const bucket = question.bucket
  const pkg = itemFor(key)

  // Where the new package currently sits: nowhere until dropped, then on the
  // learner's chosen bin, finally settled in its true bin once correct. Never the
  // correct bin before the learner picks it (no answer leak).
  const restingOn = confirmed ? bucket : placedBucket ?? null

  const itemsIn = (i: number): { code: string; isNew: boolean }[] => {
    const stowed = (question.table[i] ?? []).map((code) => ({ code, isNew: false }))
    if (restingOn === i) stowed.push({ code: key, isNew: true })
    return stowed
  }

  return (
    <div
      data-reduced-motion={reduced ? "1" : undefined}
      className="flex w-full flex-1 flex-col gap-4"
    >
      {/* The inbound package (scan, then stow). One tracer hook lives here. */}
      <div className="flex flex-col items-center gap-2">
        <div
          data-hash-correct-bucket={
            import.meta.env.DEV ? bucketTargetId(bucket) : undefined
          }
        >
          <RewireSource id={PACKAGE_SOURCE} label={`Stow package ${pkg.sku} in its bin`}>
            <span className="flex items-center gap-3">
              <Carton art={pkg.art} className="size-11" />
              <span className="flex flex-col items-start leading-tight">
                <span className="font-mono text-[13px] font-bold tracking-wide text-[#232f3e]">
                  {pkg.sku}
                </span>
                <span className="text-xs text-[#232f3e]/70">{pkg.name}</span>
              </span>
            </span>
          </RewireSource>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 font-mono text-[12px] text-white/80">
          <span className="font-bold text-[#ff9900]">SCAN</span>
          <span className="tabular-nums">
            Σ {key} = {question.sum} · mod {B} = ?
          </span>
        </div>
        <p className="text-center text-xs text-white/55">
          The index sums the code. Drop the package in the bin that number points to.
        </p>
      </div>

      {/* The bin wall (chaotic storage: numbered bins, not sorted by type). */}
      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2.5 content-start">
        {Array.from({ length: B }).map((_, i) => (
          <WarehouseBin key={i} index={i} items={itemsIn(i)} reduced={reduced} />
        ))}
      </div>

      <p className="sr-only" role="status">
        {confirmed
          ? `Package ${pkg.sku} is stowed in bin ${bucket}.`
          : restingOn != null
            ? `Package ${pkg.sku} is in bin ${restingOn}. Check your answer.`
            : `Scan ${key}: the code sums to ${question.sum}; take ${question.sum} mod ${B} to choose a bin.`}
      </p>
    </div>
  )
}

/* --------------------------------- the bin -------------------------------- */

/**
 * A numbered bin: a target-only drop slot wired straight to the shared rewire
 * surface (so drag, tap, and keyboard all land here), but styled as warehouse
 * shelving rather than the abstract lilac target. Mirrors RewireTarget's
 * behaviour and DEV hooks; only the look differs.
 */
function WarehouseBin({
  index,
  items,
  reduced,
}: {
  index: number
  items: { code: string; isNew: boolean }[]
  reduced: boolean
}) {
  const id = bucketTargetId(index)
  const { registerTarget, isLegal, armedSource, hoveredTarget, chooseTarget, setHovered } =
    useRewireContext()
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(
    () => registerTarget(id, `bin ${index}`, () => ref.current?.getBoundingClientRect() ?? null),
    [registerTarget, id, index],
  )

  const legal = isLegal(id)
  const arming = armedSource != null
  const showLegal = arming && legal
  const hovered = hoveredTarget === id

  return (
    <button
      ref={ref}
      type="button"
      tabIndex={-1}
      data-rewire-target={id}
      data-rewire-legal={legal && import.meta.env.DEV ? "1" : undefined}
      aria-label={showLegal ? `bin ${index}, available` : `bin ${index}`}
      onClick={(e) => {
        e.stopPropagation()
        chooseTarget(id)
      }}
      onPointerEnter={() => {
        if (arming) setHovered(id)
      }}
      onPointerLeave={() => {
        if (hovered) setHovered(null)
      }}
      className={cn(
        "relative flex min-h-[92px] flex-col gap-1.5 rounded-lg border-2 p-2.5 text-left outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-[#ff9900]",
        showLegal
          ? "border-dashed border-[#ff9900] bg-[#ff9900]/10"
          : "border-white/15 bg-white/[0.04]",
        hovered && "border-solid border-[#ff9900] ring-2 ring-[#ff9900]/50",
      )}
    >
      <span className="flex items-center justify-between">
        <span className="flex size-6 items-center justify-center rounded-md bg-[#ff9900] font-mono text-xs font-extrabold text-[#232f3e]">
          {index}
        </span>
        {showLegal && (
          <span className="text-[9px] font-bold uppercase tracking-wide text-[#ff9900]">
            drop
          </span>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-1">
        {items.length === 0 ? (
          <span className="text-[11px] text-white/30">empty</span>
        ) : (
          items.map((it, idx) => (
            <ItemBox key={`${idx}-${it.code}`} item={itemFor(it.code)} isNew={it.isNew} reduced={reduced} />
          ))
        )}
      </span>
    </button>
  )
}

/* -------------------------------- packages -------------------------------- */

function Carton({ art, className }: { art: [string, string]; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("relative shrink-0 overflow-hidden rounded-md shadow-sm", className)}
      style={{ backgroundImage: `linear-gradient(135deg, ${art[0]}, ${art[1]})` }}
    >
      {/* tape seam */}
      <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-white/35" />
    </span>
  )
}

function ItemBox({
  item,
  isNew,
  reduced,
}: {
  item: WarehouseItem
  isNew: boolean
  reduced: boolean
}) {
  const animateIn = isNew && !reduced
  return (
    <motion.span
      layout
      initial={animateIn ? { opacity: 0, y: -14, scale: 0.8 } : false}
      animate={isNew ? { opacity: 1, y: 0, scale: 1 } : undefined}
      transition={animateIn ? { type: "spring", stiffness: 300, damping: 22 } : undefined}
      aria-label={`${item.sku}, ${item.name}`}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded border px-1 py-0.5",
        isNew ? "border-[#ff9900] bg-[#ff9900]/20" : "border-white/15 bg-white/10",
      )}
    >
      <Carton art={item.art} className="size-4" />
      <span className="font-mono text-[10px] font-semibold text-white/85">{item.sku}</span>
    </motion.span>
  )
}
