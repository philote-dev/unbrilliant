import { useId } from "react"
import { MapPin } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import type { CostWord } from "@/components/willow/CostReadout"
import type { ArrayOp, ArrayResize } from "@/features/lesson/arraysEngine"
import { ARRIVAL_LABEL, carFor, type Car } from "./parkingData"

/**
 * The Arrays "parking lot" skin, drawn as an AERIAL view of a real lot: an
 * asphalt surface with painted, numbered bays (the bay number IS the index) and
 * top-down car silhouettes parked in them (a car IS the value, its letter on the
 * roof). It is the live structure across all four beats, and its choreography
 * makes the cost felt:
 *
 *  - Access: a "you are here" pin SNAPS onto the tapped bay with no travel, so
 *    reaching bay 0 and bay 9 look identical (free, direct).
 *  - Shift insert: on reveal the cars from the spot onward roll forward one bay,
 *    staggered by distance (a ripple), and the arrival car pulls into the spot.
 *  - Shift delete: the car at the spot pulls out and the rest roll back.
 *  - Resize: a lot with room quietly parks the new car in the first empty bay;
 *    a full lot doubles in size, the cars convoy over, then the new car parks.
 *
 * The wave only fires on `reveal` (post-verdict), so nothing leaks. Reduced motion
 * snaps every case straight to its end-state, and a polite live region announces
 * the result with the locked cost word. Pure and view-only: the plan is a function
 * of the scene, and no count is ever recomputed here for grading.
 */

const BAY_W = 46
const BAY_H = 64
const GAP = 6
const CAR_W = 36
const CAR_H = 50
const STEP_X = BAY_W + GAP
const STEP_Y = BAY_H + GAP
const RESIZE_COLS = 4
/** Per-bay stagger (seconds) that turns the shifts into a visible ripple. */
const PER = 0.06
/** Asphalt surface colour (also used for the focus-ring offset on a bay). */
const ASPHALT = "#30353f"

type Cost = { word: CostWord; count: number; unit: string }

export type ParkingScene =
  | {
      kind: "access"
      cars: string[]
      pinned: number | null
      onPark?: (index: number) => void
      cost: Cost
    }
  | { kind: "shift"; cars: string[]; op: ArrayOp; reveal: boolean; cost: Cost }
  | { kind: "resize"; cars: string[]; resize: ArrayResize; reveal: boolean; cost: Cost }

/* --------------------------------- geometry -------------------------------- */

const bayXY = (bay: number, cols: number) => ({
  x: (bay % cols) * STEP_X,
  y: Math.floor(bay / cols) * STEP_Y,
})

const gridSize = (count: number, cols: number) => {
  const rows = Math.max(1, Math.ceil(count / cols))
  return {
    width: cols * BAY_W + (cols - 1) * GAP,
    height: rows * BAY_H + (rows - 1) * GAP,
  }
}

const clampInt = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi)
const plural = (n: number) => (n === 1 ? "" : "s")

/* ----------------------------- pure scene plan ----------------------------- */

type BayHighlight = "none" | "spot" | "leaving" | "target"

interface PlannedBay {
  index: number
  highlight: BayHighlight
  ariaLabel: string
  pinned: boolean
  interactive: boolean
}

interface PlannedCar {
  label: string
  bay: number
  delay: number
  arrival: boolean
  pulse: boolean
  sprite: Car
}

interface Plan {
  cols: number
  width: number
  height: number
  bays: PlannedBay[]
  cars: PlannedCar[]
  pin: number | null
  full: boolean
  announce: string
  groupLabel: string
}

const carObj = (
  label: string,
  bay: number,
  base: string[],
  extra?: Partial<PlannedCar>,
): PlannedCar => ({
  label,
  bay,
  delay: 0,
  arrival: false,
  pulse: false,
  sprite: carFor(label, base),
  ...extra,
})

/**
 * Build the (pure) render plan for a scene at a given reveal state. Bay slots,
 * car positions, the per-car ripple delays, and the spoken announcement are all
 * deterministic functions of the scene; grading lives in the engine, not here.
 */
function planScene(scene: ParkingScene, reveal: boolean): Plan {
  if (scene.kind === "access") {
    const cars = scene.cars
    const cols = Math.max(1, cars.length)
    const { width, height } = gridSize(cars.length, cols)
    const pinned = scene.pinned
    const bays: PlannedBay[] = cars.map((label, i) => ({
      index: i,
      highlight: "none",
      pinned: pinned === i,
      interactive: true,
      ariaLabel: `Bay ${i}, car ${label}${pinned === i ? ", reading here" : ""}`,
    }))
    const plannedCars = cars.map((label, i) => carObj(label, i, cars))
    const announce =
      pinned != null && cars[pinned] != null
        ? `Bay ${pinned} holds car ${cars[pinned]}. A direct hit: ${scene.cost.word}, ${scene.cost.count} ${scene.cost.unit}.`
        : ""
    return {
      cols,
      width,
      height,
      bays,
      cars: plannedCars,
      pin: pinned ?? null,
      full: false,
      announce,
      groupLabel: "Parking lot: each bay is an index you read directly.",
    }
  }

  if (scene.kind === "shift") {
    const base = scene.cars
    const n = base.length
    const insert = scene.op.kind === "insert"
    const k = clampInt(scene.op.index, 0, insert ? n : Math.max(0, n - 1))
    const cols = Math.max(1, insert ? n + 1 : n)
    const bayCount = reveal ? (insert ? n + 1 : n) : n
    const { width, height } = gridSize(insert ? n + 1 : n, cols)

    const bays: PlannedBay[] = Array.from({ length: bayCount }, (_, i) => ({
      index: i,
      pinned: false,
      interactive: false,
      highlight: reveal
        ? "none"
        : insert && i === k
          ? "spot"
          : !insert && i === k
            ? "leaving"
            : "none",
      ariaLabel: `Bay ${i}`,
    }))

    let cars: PlannedCar[]
    if (!reveal) {
      cars = base.map((label, i) => carObj(label, i, base))
    } else if (insert) {
      cars = base.map((label, i) =>
        carObj(label, i >= k ? i + 1 : i, base, {
          delay: i >= k ? (n - 1 - i) * PER : 0,
        }),
      )
      cars.push(
        carObj(ARRIVAL_LABEL, k, base, { arrival: true, delay: (n - k) * PER }),
      )
    } else {
      cars = base
        .map((label, i) =>
          i === k ? null : carObj(label, i > k ? i - 1 : i, base, { delay: i > k ? (i - k) * PER : 0 }),
        )
        .filter((c): c is PlannedCar => c !== null)
    }

    const count = scene.cost.count
    const announce = reveal
      ? insert
        ? `Car ${ARRIVAL_LABEL} pulls into bay ${k}. ${count} car${plural(count)} rolled forward. ${scene.cost.word}.`
        : `Car ${base[k]} leaves bay ${k}. ${count} car${plural(count)} rolled back. ${scene.cost.word}.`
      : ""

    return {
      cols,
      width,
      height,
      bays,
      cars,
      pin: null,
      full: false,
      announce,
      groupLabel: insert
        ? "Parking lot: inserting shifts every later car forward one bay."
        : "Parking lot: deleting shifts every later car back one bay.",
    }
  }

  // resize
  const base = scene.cars
  const { size, capacity, resizes } = scene.resize
  const cols = RESIZE_COLS
  const endCap = resizes ? capacity * 2 : capacity
  const { width, height } = gridSize(endCap, cols)
  const bayCount = reveal ? endCap : capacity

  const bays: PlannedBay[] = Array.from({ length: bayCount }, (_, i) => ({
    index: i,
    pinned: false,
    interactive: false,
    highlight: !reveal && !resizes && i === size ? "target" : "none",
    ariaLabel: `Bay ${i}`,
  }))

  let cars: PlannedCar[]
  if (!reveal) {
    cars = base.map((label, i) => carObj(label, i, base))
  } else if (resizes) {
    cars = base.map((label, i) => carObj(label, i, base, { pulse: true, delay: i * PER }))
    cars.push(carObj(ARRIVAL_LABEL, capacity, base, { arrival: true, delay: size * PER }))
  } else {
    cars = base.map((label, i) => carObj(label, i, base))
    cars.push(carObj(ARRIVAL_LABEL, size, base, { arrival: true }))
  }

  const announce = reveal
    ? resizes
      ? `Lot full. Doubled to ${endCap} bays and copied ${scene.cost.count} cars over, then parked the new car. ${scene.cost.word}.`
      : `The new car parks in bay ${size}. ${scene.cost.word}.`
    : ""

  return {
    cols,
    width,
    height,
    bays,
    cars,
    pin: null,
    full: resizes && !reveal,
    announce,
    groupLabel: resizes
      ? "Parking lot: full, so it must double and copy every car over."
      : "Parking lot: room to spare, so the new car just parks.",
  }
}

/* -------------------------------- component -------------------------------- */

export function ParkingLot({
  scene,
  reducedMotion,
}: {
  scene: ParkingScene
  reducedMotion?: boolean
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false
  const reveal = scene.kind === "access" ? scene.pinned != null : scene.reveal
  const plan = planScene(scene, reveal)
  const onPark = scene.kind === "access" ? scene.onPark : undefined

  return (
    <div
      data-testid="parking-lot"
      data-reduced-motion={reduced ? "1" : undefined}
      role="group"
      aria-label={plan.groupLabel}
      className="relative mx-auto"
      style={{ width: plan.width, height: plan.height }}
    >
      <Asphalt />

      {plan.bays.map((bay) => (
        <BaySlot
          key={`bay-${bay.index}`}
          bay={bay}
          cols={plan.cols}
          reduced={reduced}
          onTap={bay.interactive && onPark ? () => onPark(bay.index) : undefined}
        />
      ))}

      <div className="pointer-events-none absolute inset-0">
        <AnimatePresence initial={false}>
          {plan.cars.map((car) => {
            const { x, y } = bayXY(car.bay, plan.cols)
            return (
              <motion.div
                key={car.label}
                data-testid="car"
                data-car={car.label}
                data-bay={car.bay}
                data-arrival={car.arrival ? "1" : undefined}
                initial={
                  reduced
                    ? false
                    : car.arrival
                      ? { x, y: y - 32, opacity: 0, scale: 0.7 }
                      : false
                }
                animate={{ x, y, opacity: 1, scale: !reduced && car.pulse ? [1, 1.08, 1] : 1 }}
                exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: y - 36, scale: 0.7 }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : {
                        x: { type: "spring", stiffness: 340, damping: 30, delay: car.delay },
                        y: { type: "spring", stiffness: 340, damping: 30, delay: car.delay },
                        opacity: { duration: 0.25, delay: car.delay },
                        scale: { duration: 0.45, delay: car.delay },
                      }
                }
                className="absolute left-0 top-0 flex items-start justify-center"
                style={{ width: BAY_W, height: BAY_H, paddingTop: 3 }}
              >
                <CarSprite car={car.sprite} />
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {plan.pin != null && <YouAreHerePin bay={plan.pin} cols={plan.cols} />}
      {plan.full && <FullBadge />}

      <p role="status" aria-live="polite" className="sr-only">
        {plan.announce}
      </p>
    </div>
  )
}

/* --------------------------------- pieces ---------------------------------- */

/** The asphalt surface under the bays: a dark, faintly speckled slab with a soft
 * top-down vignette and a curb edge, so the lot reads as tarmac, not a card. */
function Asphalt() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-2 rounded-2xl"
      style={{
        background: `linear-gradient(165deg, #454c59, ${ASPHALT} 58%, #272b33)`,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(0,0,0,0.4), 0 12px 26px -14px rgba(0,0,0,0.6)",
      }}
    >
      <div
        className="absolute inset-0 rounded-2xl opacity-50"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1.4px)",
          backgroundSize: "7px 7px",
        }}
      />
    </div>
  )
}

function BaySlot({
  bay,
  cols,
  reduced,
  onTap,
}: {
  bay: PlannedBay
  cols: number
  reduced: boolean
  onTap?: () => void
}) {
  const { x, y } = bayXY(bay.index, cols)
  // Painted slot lines (left/right/head) on the asphalt; highlights recolour them.
  const lines = bay.pinned
    ? "border-lilac-strong bg-lilac-soft/25"
    : bay.highlight === "spot" || bay.highlight === "target"
      ? "border-dashed border-lilac-strong/80 bg-lilac-soft/15"
      : bay.highlight === "leaving"
        ? "border-dashed border-rose-400/80 bg-rose-500/10"
        : "border-white/55 bg-white/[0.03]"

  const motionProps = {
    initial: reduced ? false : ({ opacity: 0, scale: 0.6, x, y } as const),
    animate: { opacity: 1, scale: 1, x, y },
    transition: reduced ? { duration: 0 } : { type: "spring" as const, stiffness: 300, damping: 26 },
    style: { width: BAY_W, height: BAY_H, position: "absolute" as const, left: 0, top: 0 },
    "data-testid": "bay",
    // Open at the bottom (the drive aisle); lines on the sides + head.
    className: cn(
      "rounded-t-md border-l-2 border-r-2 border-t-2 border-b-0 transition-colors",
      lines,
    ),
  }

  const number = (
    <span
      aria-hidden
      className={cn(
        "absolute inset-x-0 bottom-0.5 text-center text-[10px] font-extrabold tabular-nums",
        bay.pinned ? "text-lilac-strong" : "text-white/65",
      )}
      style={{ textShadow: "0 1px 1px rgba(0,0,0,0.5)" }}
    >
      {bay.index}
    </span>
  )

  if (onTap) {
    return (
      <motion.button
        type="button"
        {...motionProps}
        onClick={onTap}
        aria-label={bay.ariaLabel}
        className={cn(
          motionProps.className,
          "cursor-pointer outline-none hover:border-lilac-strong/70",
          "focus-visible:ring-2 focus-visible:ring-lilac-strong focus-visible:ring-offset-2",
        )}
        style={{ ...motionProps.style, ["--tw-ring-offset-color" as string]: ASPHALT }}
      >
        {number}
      </motion.button>
    )
  }

  return (
    <motion.div {...motionProps} role="img" aria-label={bay.ariaLabel}>
      {number}
    </motion.div>
  )
}

/** A simple top-down car silhouette tinted with the car's gradient, with the
 * array value on a roof plate so the data stays legible. The arrival car (X) is
 * the bright gold one, ringed so the eye tracks the new item. */
function CarSprite({ car }: { car: Car }) {
  const gid = `car-${useId().replace(/[:]/g, "")}`
  const [c0, c1] = car.body
  return (
    <span aria-hidden className="relative block drop-shadow-[0_2px_2px_rgba(0,0,0,0.45)]" style={{ width: CAR_W, height: CAR_H }}>
      <svg width={CAR_W} height={CAR_H} viewBox="0 0 36 50" className="block">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c0} />
            <stop offset="100%" stopColor={c1} />
          </linearGradient>
        </defs>
        {/* wheels peeking from under the body */}
        <g fill="#0f172a">
          <rect x="2.5" y="10" width="3.5" height="9" rx="1.5" />
          <rect x="30" y="10" width="3.5" height="9" rx="1.5" />
          <rect x="2.5" y="31" width="3.5" height="9" rx="1.5" />
          <rect x="30" y="31" width="3.5" height="9" rx="1.5" />
        </g>
        {/* body */}
        <rect
          x="5"
          y="2"
          width="26"
          height="46"
          rx="11"
          fill={`url(#${gid})`}
          stroke={car.arrival ? "#fde047" : "rgba(0,0,0,0.28)"}
          strokeWidth={car.arrival ? 1.6 : 0.75}
        />
        {/* windshield (front) + rear window, tinted glass */}
        <path d="M10 13 H26 L24 19 H12 Z" fill="#dbeafe" opacity="0.9" />
        <path d="M12 37 H24 L26 43 H10 Z" fill="#dbeafe" opacity="0.5" />
        {/* side mirrors */}
        <rect x="3.5" y="16" width="2.6" height="2.6" rx="1" fill={c1} />
        <rect x="29.9" y="16" width="2.6" height="2.6" rx="1" fill={c1} />
      </svg>
      <span
        className={cn(
          "absolute left-1/2 top-1/2 flex h-[15px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[3px] px-0.5 text-[11px] font-extrabold leading-none",
          car.arrival ? "bg-neutral-900/85 text-amber-200" : "bg-white/90 text-neutral-900",
        )}
        style={{ minWidth: 14 }}
      >
        {car.label}
      </span>
    </span>
  )
}

function YouAreHerePin({ bay, cols }: { bay: number; cols: number }) {
  const { x, y } = bayXY(bay, cols)
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-10 flex flex-col items-center"
      initial={false}
      // SNAP: zero-duration so the pin teleports to the bay (no travel), the felt
      // proof that access is direct no matter which index you pick.
      animate={{ x: x + BAY_W / 2 - 30, y: y - 22 }}
      transition={{ duration: 0 }}
      style={{ width: 60 }}
    >
      <span className="whitespace-nowrap rounded-full bg-lilac-strong px-1.5 py-0.5 text-[9px] font-bold text-white shadow">
        you are here
      </span>
      <MapPin className="-mt-0.5 size-5 fill-lilac-strong text-white" />
    </motion.div>
  )
}

function FullBadge() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-danger px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow"
    >
      Lot full
    </div>
  )
}
