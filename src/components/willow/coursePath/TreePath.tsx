import { cn } from "@/lib/utils"
import type { PathLayoutProps } from "../CoursePath"
import { BinaryTree } from "./binaryTree"

/**
 * Trees → a binary tree. The lessons branch out from a root, two children per
 * node, read top-down by level.
 */
export function TreePath({ nodes, onSelect, className }: PathLayoutProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <BinaryTree nodes={nodes} onSelect={onSelect} />
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Branches from a root, left and right children
      </p>
    </div>
  )
}
