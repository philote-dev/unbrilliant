import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { RewireContext } from "@/components/rewire/RewireContext"
import { useRewireNode } from "@/components/rewire/useRewireNode"
import { NIL, pointerId, sourceNode, type RewirePair } from "@/features/lesson/linkedListsEngine"
import { elbowLane } from "./graphLayout"
import { songFor, type Song } from "./playlistSongs"

const ROW_H = 48
const ROW_GAP = 22
const GUTTER = 52 // right-side lane that holds the order arrows
const ART = 40

/**
 * The playlist beat rendered as a vertical Spotify-style queue: each track is a
 * row (album art + title + artist), and the linked-list `next` pointers run as
 * elbow arrows down a right-side gutter — each stems from the bottom-right of a
 * track, drops down the gutter, and turns back into the top-right of the next.
 * Before the splice the previous track's arrow visibly skips PAST the new track
 * to the one after it; the learner re-aims it (grab a row, drag onto another) in
 * the save-first order. Same engine + rewire surface as the abstract figure.
 */
export function PlaylistQueue({
  nodes,
  newNode,
  prev,
  workingNext,
  orphaned,
  rewires,
  reducedMotion,
}: {
  nodes: string[]
  newNode?: string | null
  prev?: string | null
  workingNext: Record<string, string>
  orphaned?: string[]
  rewires?: RewirePair[]
  reducedMotion?: boolean
}) {
  const prefersReduced = useReducedMotion()
  const reduced = reducedMotion ?? prefersReduced ?? false

  const ctx = useContext(RewireContext)
  const armedSource = ctx?.armedSource ?? null

  const containerRef = useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [width, setWidth] = useState(360)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure)
      ro.observe(el)
    } else {
      window.addEventListener("resize", measure)
    }
    return () => {
      ro?.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [])

  // Display order: the chain, with the new track slotted right after `prev`.
  const order: string[] = []
  for (const n of nodes) {
    order.push(n)
    if (newNode && n === prev) order.push(newNode)
  }
  const rowIndex = new Map(order.map((id, i) => [id, i]))
  const topY = (id: string) => (rowIndex.get(id) ?? 0) * (ROW_H + ROW_GAP)
  const totalH = order.length * ROW_H + Math.max(0, order.length - 1) * ROW_GAP

  const orphanSet = new Set(orphaned ?? [])
  const live = workingNext

  // Track the cursor (in container space) so the grabbed arrow stretches to it.
  useEffect(() => {
    if (!armedSource) {
      setCursor(null)
      return
    }
    const onMove = (e: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
    window.addEventListener("pointermove", onMove)
    return () => window.removeEventListener("pointermove", onMove)
  }, [armedSource])

  // Order arrows live in the right gutter: out of a track's bottom-right, down a
  // rail, then back into the next track's top-right. Each source gets its OWN lane
  // (rail x + entry height) so two pointers landing on the same track (the save-
  // first state: both prev→at and X→at) don't stack their arrowheads at one point.
  const rowRightX = Math.max(120, width - GUTTER)
  const baseRailX = Math.max(rowRightX + 12, width - 18)
  const arrows: {
    key: string
    start: { x: number; y: number }
    end: { x: number; y: number }
    railX: number
    faint: boolean
  }[] = []
  for (const node of order) {
    if (armedSource === pointerId(node)) continue // grabbed → drawn as the live stretch
    const tgt = live[pointerId(node)]
    if (!tgt || tgt === NIL || !rowIndex.has(tgt)) continue
    const faint = orphanSet.has(node) || orphanSet.has(tgt)
    const lane = elbowLane(baseRailX, rowIndex.get(node) ?? 0)
    arrows.push({
      key: node,
      start: { x: rowRightX, y: topY(node) + ROW_H - 12 },
      end: { x: rowRightX, y: topY(tgt) + 12 + lane.entryDy },
      railX: lane.railX,
      faint,
    })
  }

  const armedNode = armedSource ? sourceNode(armedSource) : null

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: totalH }}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        {arrows.map((a) => (
          <QueueElbow key={a.key} start={a.start} end={a.end} railX={a.railX} faint={a.faint} />
        ))}
        {armedNode && rowIndex.has(armedNode) && (
          <LiveQueueStretch
            from={{ x: rowRightX, y: topY(armedNode) + ROW_H / 2 }}
            cursor={cursor}
          />
        )}
      </svg>

      {order.map((node) => {
        const song = songFor(node, nodes)
        const y = topY(node)
        if (orphanSet.has(node)) {
          return <OrphanSongRow key={node} song={song} y={y} reduced={reduced} />
        }
        return (
          <SongRow
            key={node}
            node={node}
            song={song}
            y={y}
            isHead={node === nodes[0]}
            isNew={node === newNode}
            orderHint={orderHintFor(rewires, node)}
          />
        )
      })}
    </div>
  )
}

/* --------------------------------- rows ---------------------------------- */

function SongRow({
  node,
  song,
  y,
  isHead,
  isNew,
  orderHint,
}: {
  node: string
  song: Song
  y: number
  isHead: boolean
  isNew: boolean
  orderHint: { to: string; order: number } | null
}) {
  const { ref, armed, showLegal, hovered, rootProps } = useRewireNode({
    sourceId: pointerId(node),
    targetId: node,
    sourceLabel: `${song.title} next pointer`,
    targetLabel: song.title,
  })

  return (
    <button
      ref={ref}
      type="button"
      {...rootProps}
      aria-label={
        armed
          ? `${song.title} grabbed — choose where it plays next`
          : showLegal
            ? `${song.title}, drop here`
            : `${song.title} by ${song.artist}${isNew ? ", new track to queue" : ""}`
      }
      className={cn(
        "absolute flex touch-none select-none items-center gap-3 rounded-lg px-2 text-left outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-[#1db954]",
        armed
          ? "cursor-grabbing bg-white/[0.08] ring-2 ring-[#1db954]"
          : showLegal
            ? "cursor-pointer bg-[#1db954]/10 ring-2 ring-dashed ring-[#1db954]/70"
            : hovered
              ? "bg-white/[0.08] ring-2 ring-[#1db954]"
              : "cursor-grab hover:bg-white/5",
        isNew && !armed && !showLegal && "ring-1 ring-[#1db954]/40",
      )}
      style={{ left: 4, right: GUTTER, top: y, height: ROW_H }}
    >
      <AlbumArt song={song} />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "flex items-center gap-1.5 truncate text-[15px] font-semibold",
            isHead ? "text-[#1db954]" : "text-white",
          )}
        >
          {isHead && <PlayingBars />}
          <span className="truncate">{song.title}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-white/55">
          <Badge kind={song.badge} />
          <span className="truncate">{song.artist}</span>
        </span>
      </span>
      {isNew ? (
        <span className="shrink-0 rounded-full bg-[#1db954] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
          New
        </span>
      ) : (
        <Handle />
      )}
      {import.meta.env.DEV && orderHint && (
        <span
          className="sr-only"
          data-rewire-correct-target={orderHint.to}
          data-write-order={orderHint.order}
        />
      )}
    </button>
  )
}

/**
 * A track that just fell out of the queue. It mounts in its row and drifts right
 * as it fades + greys, so the "rest of the queue floated off" reads as a moment
 * (the bug: it used to mount already at the end-state, so the drift never played).
 * Reduced motion snaps straight to the dropped state via `initial={false}`.
 */
function OrphanSongRow({ song, y, reduced }: { song: Song; y: number; reduced: boolean }) {
  return (
    <motion.div
      data-reduced-motion={reduced ? "1" : undefined}
      className="absolute flex items-center gap-3 rounded-lg px-2 grayscale"
      style={{ left: 4, right: GUTTER, top: y, height: ROW_H }}
      initial={reduced ? false : { x: 0, opacity: 1 }}
      animate={{ x: 14, opacity: 0.4 }}
      transition={reduced ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
      aria-label={`${song.title}, dropped from the queue`}
    >
      <AlbumArt song={song} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-white/70">{song.title}</span>
        <span className="mt-0.5 block truncate text-[13px] text-white/40">{song.artist}</span>
      </span>
    </motion.div>
  )
}

/* -------------------------------- pieces -------------------------------- */

function AlbumArt({ song }: { song: Song }) {
  return (
    <span
      aria-hidden
      className="grid size-11 shrink-0 place-items-center rounded-md text-white/80 shadow-sm"
      style={{
        width: ART,
        height: ART,
        backgroundImage: `linear-gradient(135deg, ${song.art[0]}, ${song.art[1]})`,
      }}
    >
      <svg viewBox="0 0 24 24" className="size-4 opacity-90" fill="currentColor">
        <path d="M9 17a3 3 0 1 1-2-2.83V5l9-2v9.17A3 3 0 1 1 14 14V7.5L9 8.6V17z" />
      </svg>
    </span>
  )
}

function Badge({ kind }: { kind?: "verified" | "explicit" }) {
  if (kind === "verified") {
    return (
      <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-[#1db954]" fill="currentColor" aria-hidden>
        <path d="M12 2l2.4 1.8 3 .2.9 2.9 2.2 2-1 2.9 1 2.9-2.2 2-.9 2.9-3 .2L12 22l-2.4-1.8-3-.2-.9-2.9-2.2-2 1-2.9-1-2.9 2.2-2 .9-2.9 3-.2L12 2z" />
        <path d="M10.6 14.6l-2.2-2.2-1.2 1.2 3.4 3.4 6-6-1.2-1.2-4.8 4.8z" fill="#0b0b0b" />
      </svg>
    )
  }
  if (kind === "explicit") {
    return (
      <span
        aria-hidden
        className="grid size-3.5 shrink-0 place-items-center rounded-[3px] bg-white/55 text-[9px] font-bold leading-none text-black"
      >
        E
      </span>
    )
  }
  return null
}

function Handle() {
  return (
    <span aria-hidden className="flex shrink-0 flex-col gap-[3px] pr-1 text-white/40">
      <span className="block h-0.5 w-4 rounded bg-current" />
      <span className="block h-0.5 w-4 rounded bg-current" />
      <span className="block h-0.5 w-4 rounded bg-current" />
    </span>
  )
}

function PlayingBars() {
  return (
    <span aria-hidden className="flex h-3 shrink-0 items-end gap-0.5">
      <span className="w-0.5 animate-pulse rounded-full bg-[#1db954]" style={{ height: "60%" }} />
      <span className="w-0.5 animate-pulse rounded-full bg-[#1db954]" style={{ height: "100%" }} />
      <span className="w-0.5 animate-pulse rounded-full bg-[#1db954]" style={{ height: "45%" }} />
    </span>
  )
}

/**
 * An order arrow: out of the source's bottom-right, right into the gutter, down
 * the rail, then back in to the target's top-right with a left-pointing head.
 */
function QueueElbow({
  start,
  end,
  railX,
  faint,
}: {
  start: { x: number; y: number }
  end: { x: number; y: number }
  railX: number
  faint: boolean
}) {
  const HEAD = 8
  const d = `M ${start.x} ${start.y} H ${railX} V ${end.y} H ${end.x + HEAD}`
  return (
    <g className={faint ? "text-white/15" : "text-[#1db954]/85"}>
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={`M ${end.x} ${end.y} L ${end.x + HEAD} ${end.y - 5} L ${end.x + HEAD} ${end.y + 5} Z`}
        fill="currentColor"
      />
    </g>
  )
}

function LiveQueueStretch({
  from,
  cursor,
}: {
  from: { x: number; y: number }
  cursor: { x: number; y: number } | null
}) {
  // No cursor yet (just grabbed, or keyboard-armed before a drop is chosen): draw
  // a short "lifted" stub into the gutter so the grabbed arrow stays visible.
  const target = cursor ?? { x: from.x + 34, y: from.y }
  const angle = (Math.atan2(target.y - from.y, target.x - from.x) * 180) / Math.PI
  return (
    <g data-testid="armed-arrow" className="text-[#1db954]">
      <line
        x1={from.x}
        y1={from.y}
        x2={target.x}
        y2={target.y}
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeDasharray="1 6"
      />
      <g transform={`translate(${target.x} ${target.y}) rotate(${angle})`}>
        <path d="M0 0 L-9 -5 L-9 5 Z" fill="currentColor" />
      </g>
    </g>
  )
}

function orderHintFor(
  rewires: RewirePair[] | undefined,
  node: string,
): { to: string; order: number } | null {
  if (!rewires) return null
  const idx = rewires.findIndex((rw) => rw.from === pointerId(node))
  return idx >= 0 ? { to: rewires[idx].to, order: idx + 1 } : null
}
