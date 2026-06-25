import { cn } from "@/lib/utils"
import type { PathLayoutProps } from "../CoursePath"
import { PathNodeButton, labelClass } from "./node"

/**
 * Arrays → an indexed, contiguous array. The lessons are cells packed in one
 * block with running indices [0..n], evoking O(1) indexed access. Reading
 * top→bottom is the lesson order.
 */
export function ArrayPath({ nodes, onSelect, className }: PathLayoutProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="overflow-hidden rounded-2xl border-2 border-lilac-strong/30">
        {nodes.map((node, i) => (
          <div
            key={node.id}
            className={cn(
              "flex items-center gap-3 px-3 py-2",
              i > 0 && "border-t border-lilac-strong/15",
            )}
          >
            <span className="w-7 shrink-0 text-center font-mono text-xs font-semibold text-muted-foreground">
              [{i}]
            </span>
            <PathNodeButton node={node} onSelect={onSelect} shape="square" size={42} />
            <span className={cn("text-[15px] leading-tight", labelClass(node.state))}>
              {node.name}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Contiguous · indexed for O(1) access
      </p>
    </div>
  )
}
