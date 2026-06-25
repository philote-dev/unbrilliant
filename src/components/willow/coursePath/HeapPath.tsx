import { cn } from "@/lib/utils"
import type { PathLayoutProps } from "../CoursePath"
import { BinaryTree, TREE_CAPACITY } from "./binaryTree"
import { nodeSurface } from "./node"

/**
 * Heaps → a complete binary tree paired with its backing array. The tree shows
 * the heap shape; the strip below shows the level-order array it really lives in.
 */
export function HeapPath({ nodes, onSelect, className }: PathLayoutProps) {
  const items = nodes.slice(0, TREE_CAPACITY)
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <BinaryTree nodes={nodes} onSelect={onSelect} />

      <div>
        <p className="mb-1.5 text-center text-xs text-muted-foreground">
          Backed by an array (level order)
        </p>
        <div className="flex justify-center gap-1">
          {items.map((node, i) => {
            const enterable = node.state !== "locked"
            return (
              <button
                key={node.id}
                type="button"
                disabled={!enterable}
                onClick={() => enterable && onSelect?.(node)}
                aria-label={enterable ? node.name : `${node.name} (locked)`}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md text-[11px] font-bold outline-none transition-transform hover:scale-110",
                  "focus-visible:ring-2 focus-visible:ring-lilac-strong/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  node.state === "current" && "ring-2 ring-lilac-strong/30",
                  nodeSurface(node.state),
                  enterable ? "cursor-pointer" : "cursor-default",
                )}
              >
                {i}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
