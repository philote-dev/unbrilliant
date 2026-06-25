import { cn } from "@/lib/utils"
import type { PathLayoutProps } from "../CoursePath"
import { PathNodeButton, labelClass } from "./node"

/**
 * Graphs → a small node-and-edge network. The lessons are vertices in a loose
 * layout, joined by edges (sequential links plus a couple of cross-connections).
 */

const WIDTH = 320
const HEIGHT = 300
const NODE = 40

const POS = [
  { x: 0.5, y: 0.12 },
  { x: 0.19, y: 0.31 },
  { x: 0.81, y: 0.29 },
  { x: 0.34, y: 0.55 },
  { x: 0.69, y: 0.57 },
  { x: 0.18, y: 0.83 },
  { x: 0.6, y: 0.85 },
]
const EDGES = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 4],
  [1, 4],
  [3, 4],
  [3, 5],
  [4, 6],
  [5, 6],
]

function at(i: number) {
  return { x: POS[i].x * WIDTH, y: POS[i].y * HEIGHT }
}

export function GraphPath({ nodes, onSelect, className }: PathLayoutProps) {
  const items = nodes.slice(0, POS.length)
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="relative mx-auto" style={{ width: WIDTH, height: HEIGHT }}>
        <svg className="absolute inset-0" width={WIDTH} height={HEIGHT} aria-hidden>
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
                opacity={0.35}
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
                  "absolute max-w-[84px] -translate-x-1/2 truncate text-center text-[10px] font-medium leading-tight",
                  labelClass(node.state),
                )}
                style={{ left: p.x, top: p.y + NODE / 2 + 2 }}
              >
                {node.name}
              </span>
            </div>
          )
        })}
      </div>
      <p className="mt-1 text-center text-xs text-muted-foreground">Vertices joined by edges</p>
    </div>
  )
}
