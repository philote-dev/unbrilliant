/**
 * Pure model for the "Insert & delete" free-play beat (the "make room, close
 * gaps" playground). Each cell carries a stable id so the renderer can slide the
 * SAME box between fixed address slots; a cell's slot is simply its index in the
 * list. Insert and delete return the next list plus the ids of the cells that
 * SHIFT, so the figure can read the change as a directional shift: cells before
 * the change keep their slot (no motion); only the tail slides one slot over.
 * No DOM, no React, so the index math is unit-tested in node.
 */

export interface PlayCell {
  id: number
  label: string
}

export interface MutateResult {
  cells: PlayCell[]
  /** Ids of the cells that slide one slot to open or close the gap. */
  movingIds: Set<number>
}

const clampIndex = (index: number, length: number): number =>
  Math.max(0, Math.min(index, length))

/** The first pool label not already on the row, or null when the pool is spent. */
export function freeLabel(cells: PlayCell[], pool: readonly string[]): string | null {
  const used = new Set(cells.map((c) => c.label))
  return pool.find((label) => !used.has(label)) ?? null
}

/**
 * Insert `cell` at index k. Cells 0..k-1 keep their slot (no motion); cells
 * k..end slide one slot to the right (returned as `movingIds`) to open the gap
 * the new cell lands in at index k. The index is clamped to [0, length].
 */
export function applyInsert(cells: PlayCell[], index: number, cell: PlayCell): MutateResult {
  const at = clampIndex(index, cells.length)
  return {
    cells: [...cells.slice(0, at), cell, ...cells.slice(at)],
    movingIds: new Set(cells.slice(at).map((c) => c.id)),
  }
}

/**
 * Delete the cell at index k. Cells 0..k-1 keep their slot (no motion); cells
 * k+1..end slide one slot to the left (returned as `movingIds`) to close the
 * gap. An out-of-range index leaves the row untouched.
 */
export function applyDelete(cells: PlayCell[], index: number): MutateResult {
  if (index < 0 || index >= cells.length) {
    return { cells, movingIds: new Set() }
  }
  return {
    cells: cells.filter((_, j) => j !== index),
    movingIds: new Set(cells.slice(index + 1).map((c) => c.id)),
  }
}
