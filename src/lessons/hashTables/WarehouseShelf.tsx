import { useEffect, useRef } from "react"
import { motion, useReducedMotion, type PanInfo } from "motion/react"

import { cn } from "@/lib/utils"
import { useRewireContext } from "@/components/rewire/RewireContext"
import { resolveDropTarget } from "@/components/rewire/core"
import { bucketTargetId, type HashQuestion } from "@/features/lesson/hashTablesEngine"
import { itemFor, type WarehouseItem } from "./warehouseData"

/** The draggable package's source id (opaque; grading is on the chosen bin). */
const PACKAGE_SOURCE = "hash-key"

/** Forgiving slop (px) around a bin so a clumsy drop still lands. */
const DROP_TOLERANCE = 16

/**
 * The pointer's viewport coords from a framer-motion drag event (mouse / touch /
 * pen). Mirrors the Stacks & Queues drag so the box hit-tests the live bin rects
 * exactly where the finger is, then snaps home on a miss.
 */
function viewportPoint(
  event: MouseEvent | TouchEvent | PointerEvent,
  info: PanInfo,
): { x: number; y: number } {
  if ("clientX" in event && typeof event.clientX === "number") {
    return { x: event.clientX, y: event.clientY }
  }
  const touch =
    (event as TouchEvent).changedTouches?.[0] ?? (event as TouchEvent).touches?.[0]
  if (touch) return { x: touch.clientX, y: touch.clientY }
  return { x: info.point.x - window.scrollX, y: info.point.y - window.scrollY }
}

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
      {/* The inbound package: an actual draggable carton. One tracer hook here. */}
      <div className="flex flex-col items-center gap-2.5">
        <div
          data-hash-correct-bucket={
            import.meta.env.DEV ? bucketTargetId(bucket) : undefined
          }
        >
          <DraggablePackage
            label={`Stow package ${pkg.sku} in its bin`}
            reduced={reduced}
          />
        </div>

        {/* SKU + name as a static caption OUTSIDE the box (only the box drags). */}
        <span className="flex flex-col items-center leading-tight">
          <span className="font-mono text-[13px] font-bold tracking-wide text-white">
            {pkg.sku}
          </span>
          <span className="text-xs text-white/60">{pkg.name}</span>
        </span>

        <div className="flex items-center gap-2 rounded-lg border border-[#08aae3]/40 bg-[#08aae3]/10 px-3 py-1.5 font-mono text-[12px] text-white/85 shadow-[0_0_14px_-5px_#08aae3]">
          <span className="font-bold text-[#2dbff8]">SCAN</span>
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

/**
 * The inbound package: a single draggable cardboard carton that PHYSICALLY
 * follows the pointer (framer-motion `drag`) and snaps home on a miss
 * (`dragSnapToOrigin`). It is the only drag handle. It talks to the shared rewire
 * surface directly: arming on drag start so the bins light up, hit-testing the
 * pointer against the live bin rects on drag, and committing (or cancelling) on
 * release. Tap and keyboard fall back to the same arm-then-choose intent, so
 * mouse, touch, and keyboard land the package identically. Reduced motion turns
 * off the physical follow; tap and keyboard still work.
 */
function DraggablePackage({ label, reduced }: { label: string; reduced: boolean }) {
  const {
    registerSource,
    armSource,
    armedSource,
    chooseTarget,
    cancel,
    setHovered,
    moveHover,
    confirmKeyboard,
    targetRects,
  } = useRewireContext()
  // Tell a real drag apart from a tap so a drag's trailing click never re-arms.
  const draggedRef = useRef(false)

  useEffect(() => registerSource(PACKAGE_SOURCE, label), [registerSource, label])

  const armed = armedSource === PACKAGE_SOURCE

  return (
    <motion.button
      type="button"
      data-rewire-source={PACKAGE_SOURCE}
      data-rewire-armed={armed && import.meta.env.DEV ? "1" : undefined}
      aria-label={label}
      aria-pressed={armed}
      drag={!reduced}
      dragSnapToOrigin
      dragMomentum={false}
      dragElastic={0.18}
      whileDrag={{ scale: 1.08, zIndex: 50, cursor: "grabbing" }}
      onPointerDown={() => {
        draggedRef.current = false
      }}
      onDragStart={() => {
        draggedRef.current = true
        armSource(PACKAGE_SOURCE)
      }}
      onDrag={(event, info) =>
        setHovered(
          resolveDropTarget(viewportPoint(event, info), targetRects(), DROP_TOLERANCE),
        )
      }
      onDragEnd={(event, info) => {
        const hit = resolveDropTarget(
          viewportPoint(event, info),
          targetRects(),
          DROP_TOLERANCE,
        )
        if (hit) chooseTarget(hit)
        else cancel()
      }}
      onClick={(e) => {
        // Stop the surface's background click (it cancels) and arm only on a real
        // tap; a drag's trailing synthetic click is ignored via draggedRef.
        e.stopPropagation()
        if (draggedRef.current) return
        armSource(PACKAGE_SOURCE)
      }}
      onKeyDown={(e) => {
        if (!armed) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            armSource(PACKAGE_SOURCE)
          }
          return
        }
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault()
          moveHover(1)
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault()
          moveHover(-1)
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          confirmKeyboard()
        } else if (e.key === "Escape") {
          e.preventDefault()
          cancel()
        }
      }}
      className={cn(
        "touch-none select-none rounded-[10px] outline-none",
        reduced ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
        "focus-visible:ring-2 focus-visible:ring-[#ff9900] focus-visible:ring-offset-2 focus-visible:ring-offset-[#232f3e]",
        armed && "ring-2 ring-[#ff9900]",
      )}
    >
      <CardboardBox className="size-16" />
    </motion.button>
  )
}

/**
 * A kraft cardboard shipping carton drawn in CSS: a kraft fill, the two top flaps
 * creased down the front, a vertical strip of packing tape over the seam, and a
 * little shading for weight. Decorative only (the button around it owns the label
 * and behaviour), so it is `aria-hidden`.
 */
function CardboardBox({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative block overflow-hidden rounded-[6px] ring-1 ring-black/20",
        "shadow-[0_8px_16px_-8px_rgba(0,0,0,0.7)]",
        className,
      )}
      style={{
        backgroundImage: "linear-gradient(155deg, #ddbd87 0%, #cba668 48%, #b78d52 100%)",
      }}
    >
      {/* the two top flaps, folded down the front along a crease */}
      <span
        className="absolute inset-x-0 top-0 h-[42%] border-b border-black/25"
        style={{ backgroundImage: "linear-gradient(180deg, #d4ad6b, #c69d5f)" }}
      />
      {/* the seam where the flaps meet */}
      <span className="absolute left-1/2 top-0 h-[42%] w-px -translate-x-1/2 bg-black/25" />
      {/* the vertical packing tape over the seam */}
      <span
        className="absolute left-1/2 top-0 h-full w-[30%] -translate-x-1/2 border-x border-black/10"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(245,234,206,0.35), rgba(245,234,206,0.92) 28%, rgba(228,212,176,0.92) 72%, rgba(245,234,206,0.35))",
        }}
      >
        <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/45" />
      </span>
      {/* soft shading toward the base for a bit of 3D weight */}
      <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
    </span>
  )
}

/** A small kraft box for items already stowed in a bin (a simpler carton). */
function Carton({ art, className }: { art: [string, string]; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/15 shadow-sm",
        className,
      )}
      style={{ backgroundImage: `linear-gradient(150deg, ${art[0]}, ${art[1]})` }}
    >
      {/* top-flap crease */}
      <span className="absolute inset-x-0 top-[42%] h-px bg-black/20" />
      {/* vertical packing tape */}
      <span className="absolute left-1/2 top-0 h-full w-[32%] -translate-x-1/2 bg-[#efe0b8]/70" />
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
