import { cn } from "@/lib/utils"
import type { PathNode } from "../CoursePath"
import { PathNodeButton, labelClass } from "./node"

/**
 * Shared complete-binary-tree diagram for Trees (BST) and Heaps. Lays the seven
 * lessons across three levels (1 / 2 / 4) by index, draws parent→child edges,
 * and labels each node. Used by TreePath and HeapPath.
 */

const WIDTH = 320
const LEVEL_Y = [42, 130, 218]
const TREE_HEIGHT = 252
const NODE = 38

// x fraction of width + level, by node index (level-order / complete tree).
const POS: { x: number; level: number }[] = [
  { x: 0.5, level: 0 },
  { x: 0.28, level: 1 },
  { x: 0.72, level: 1 },
  { x: 0.13, level: 2 },
  { x: 0.38, level: 2 },
  { x: 0.62, level: 2 },
  { x: 0.87, level: 2 },
]
const EDGES = [
  [0, 1],
  [0, 2],
  [1, 3],
  [1, 4],
  [2, 5],
  [2, 6],
]

/**
 * How many lessons this fixed-shape diagram can place. The Data Structures
 * catalog is exactly this many, so the diagram layouts (tree/heap/graph) target
 * it directly; any nodes beyond this are not drawn. Linear layouts (queue/array/
 * list/hash) render all nodes, so revisit these tables if the catalog grows.
 */
export const TREE_CAPACITY = POS.length

function at(i: number) {
  return { x: POS[i].x * WIDTH, y: LEVEL_Y[POS[i].level] }
}

export function BinaryTree({
  nodes,
  onSelect,
}: {
  nodes: PathNode[]
  onSelect?: (node: PathNode) => void
}) {
  const items = nodes.slice(0, POS.length)
  return (
    <div className="relative mx-auto" style={{ width: WIDTH, height: TREE_HEIGHT }}>
      <svg className="absolute inset-0" width={WIDTH} height={TREE_HEIGHT} aria-hidden>
        {EDGES.map(([a, b]) => {
          if (a >= items.length || b >= items.length) return null
          const A = at(a)
          const B = at(b)
          return (
            <line
              key={`${a}-${b}`}
              x1={A.x}
              y1={A.y}
              x2={B.x}
              y2={B.y}
              stroke="var(--lilac-strong)"
              strokeWidth={2}
              opacity={0.4}
              strokeLinecap="round"
            />
          )
        })}
      </svg>

      {items.map((node, i) => {
        const p = at(i)
        return (
          <div key={node.id}>
            <div className="absolute" style={{ left: p.x, top: p.y, transform: "translate(-50%, -50%)" }}>
              <PathNodeButton node={node} onSelect={onSelect} shape="round" size={NODE} />
            </div>
            <span
              className={cn(
                "absolute max-w-[78px] -translate-x-1/2 truncate text-center text-[10px] font-medium leading-tight",
                labelClass(node.state),
              )}
              style={{ left: p.x, top: p.y + NODE / 2 + 3 }}
            >
              {node.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}
