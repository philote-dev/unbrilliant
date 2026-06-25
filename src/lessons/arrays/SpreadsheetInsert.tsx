import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import type { ArrayOp } from "@/features/lesson/arraysEngine"

/**
 * The real-world A2 skin: a spreadsheet. Rows are stored contiguously, so
 * inserting a row at position k slides every row below it down (and deleting
 * slides them up), exactly the array shift. Row numbers (1-based, like a real
 * sheet) re-label as the rows move. The ripple fires on `reveal` (post-verdict);
 * reduced motion snaps to the end-state. Pure and view-only.
 */

const ROW_H = 40
const NAMES = ["Ada", "Ben", "Cleo", "Dax", "Eve", "Finn", "Gus", "Hana"]
const NEW_LABEL = "Priya" // the inserted row's name (the gold "arrival")

function nameFor(label: string, cells: string[]): string {
  const i = cells.indexOf(label)
  return i >= 0 ? NAMES[i % NAMES.length] : NEW_LABEL
}

interface Row {
  id: string
  name: string
  slot: number // final 0-based row position
  delay: number // ripple stagger
  arrival: boolean
  leaving: boolean
}

function plan(cells: string[], op: ArrayOp, reveal: boolean): { rows: Row[]; count: number } {
  const n = cells.length
  if (!reveal) {
    return {
      rows: cells.map((c, i) => ({
        id: c,
        name: nameFor(c, cells),
        slot: i,
        delay: 0,
        arrival: false,
        leaving: op.kind === "delete" && i === op.index,
      })),
      count: n,
    }
  }
  if (op.kind === "insert") {
    const rows: Row[] = cells.map((c, i) => ({
      id: c,
      name: nameFor(c, cells),
      slot: i >= op.index ? i + 1 : i,
      delay: i >= op.index ? (n - 1 - i) * 0.06 : 0,
      arrival: false,
      leaving: false,
    }))
    rows.push({
      id: "__new",
      name: NEW_LABEL,
      slot: op.index,
      delay: (n - op.index) * 0.06,
      arrival: true,
      leaving: false,
    })
    return { rows, count: n + 1 }
  }
  // delete: drop row k, slide the rest up
  const rows: Row[] = cells
    .map((c, i) =>
      i === op.index
        ? null
        : {
            id: c,
            name: nameFor(c, cells),
            slot: i > op.index ? i - 1 : i,
            delay: i > op.index ? (i - op.index) * 0.06 : 0,
            arrival: false,
            leaving: false,
          },
    )
    .filter((r): r is Row => r !== null)
  return { rows, count: n }
}

export function SpreadsheetInsert({
  cells,
  op,
  reveal,
  reduced,
}: {
  cells: string[]
  op: ArrayOp
  reveal: boolean
  reduced?: boolean
}) {
  const prefersReduced = useReducedMotion()
  const isReduced = reduced || (prefersReduced ?? false)
  const { rows, count } = plan(cells, op, reveal)
  const spring = { type: "spring", stiffness: 360, damping: 30 } as const

  return (
    <div
      data-testid="spreadsheet"
      className="mx-auto w-[280px] overflow-hidden rounded-xl border border-border bg-card shadow-soft"
    >
      {/* the app chrome: a title bar + column header */}
      <div className="flex items-center gap-2 bg-[#107c41] px-3 py-2 text-white">
        <span className="text-sm font-bold">Guest list</span>
        <span className="text-xs text-white/70">· Sheet 1</span>
      </div>
      <div className="flex border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="w-9 border-r border-border px-2 py-1.5 text-center">#</span>
        <span className="px-3 py-1.5">Name</span>
      </div>

      {/* the contiguous rows; the body height reserves every final slot */}
      <div className="relative" style={{ height: count * ROW_H }}>
        <AnimatePresence initial={false}>
          {rows.map((row) => (
            <motion.div
              key={row.id}
              className="absolute inset-x-0 flex items-stretch"
              initial={
                isReduced
                  ? false
                  : row.arrival
                    ? { opacity: 0, y: row.slot * ROW_H - 10 }
                    : { y: row.slot * ROW_H }
              }
              animate={{ opacity: 1, y: row.slot * ROW_H }}
              exit={isReduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: 16 }}
              transition={isReduced ? { duration: 0 } : { ...spring, delay: row.delay }}
              style={{ height: ROW_H }}
            >
              <span
                className={cn(
                  "flex w-9 items-center justify-center border-r border-border text-[11px] font-semibold tabular-nums",
                  row.arrival ? "bg-amber-100 text-amber-700" : "bg-muted/30 text-muted-foreground",
                )}
              >
                {row.slot + 1}
              </span>
              <span
                className={cn(
                  "flex flex-1 items-center px-3 text-sm font-medium",
                  row.arrival
                    ? "bg-amber-50 text-amber-900"
                    : row.leaving
                      ? "bg-danger-soft text-foreground line-through"
                      : "text-foreground",
                )}
              >
                {row.name}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
